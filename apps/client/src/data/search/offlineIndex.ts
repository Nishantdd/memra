import MiniSearch, { type Options } from "minisearch";
import type { Folder, Note, SearchOutput, SearchResult, SnippetSegment } from "shared";
import { OFFLINE_SNIPPET_CHARS } from "../../constants/index.ts";
import { db, getMeta, setMeta } from "../db.ts";

interface Doc {
  id: string;
  displayTitle: string;
  bodyPlain: string;
  tags: string;
  folderName: string;
}

const META_KEY = "miniSearchIndex";

const options: Options<Doc> = {
  fields: ["displayTitle", "tags", "bodyPlain", "folderName"],
  storeFields: [],
  searchOptions: {
    boost: { displayTitle: 3, tags: 2 },
    prefix: true,
    fuzzy: 0.15,
    combineWith: "AND",
  },
};

let index: MiniSearch<Doc> | null = null;
let loading: Promise<MiniSearch<Doc>> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function toDoc(
  note: Note,
  folders: Map<string, Folder>,
  tagNames: Map<string, string>,
): Promise<Doc> {
  return {
    id: note.id,
    displayTitle: note.displayTitle,
    bodyPlain: note.bodyPlain,
    tags: note.tagIds.map((id) => tagNames.get(id) ?? "").join(" "),
    folderName: note.folderId ? (folders.get(note.folderId)?.name ?? "") : "",
  };
}

async function lookups() {
  const [folders, tags] = await Promise.all([db.folders.toArray(), db.tags.toArray()]);
  return {
    folders: new Map(folders.map((f) => [f.id, f])),
    tagNames: new Map(tags.map((t) => [t.id, t.name])),
  };
}

export async function rebuildOfflineIndex(): Promise<MiniSearch<Doc>> {
  const fresh = new MiniSearch<Doc>(options);
  const { folders, tagNames } = await lookups();
  const notes = await db.notes.toArray();
  fresh.addAll(await Promise.all(notes.map((n) => toDoc(n, folders, tagNames))));
  index = fresh;
  schedulePersist();
  return fresh;
}

export function getOfflineIndex(): Promise<MiniSearch<Doc>> {
  if (index) return Promise.resolve(index);
  loading ??= (async () => {
    const saved = await getMeta<string>(META_KEY);
    if (saved) {
      try {
        index = await MiniSearch.loadJSONAsync<Doc>(saved, options);
        return index;
      } catch {
        // Corrupt or incompatible snapshot; rebuild from the mirror.
      }
    }
    return rebuildOfflineIndex();
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Applies a sync delta to the in-memory index (no-op until the index is loaded). */
export async function applyDeltaToOfflineIndex(
  changed: Note[],
  deletedIds: string[],
): Promise<void> {
  if (!index) return;
  const { folders, tagNames } = await lookups();
  for (const id of deletedIds) if (index.has(id)) index.discard(id);
  for (const note of changed) {
    const doc = await toDoc(note, folders, tagNames);
    if (index.has(note.id)) index.replace(doc);
    else index.add(doc);
  }
  schedulePersist();
}

export function clearOfflineIndex(): void {
  index = null;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (index) void setMeta(META_KEY, JSON.stringify(index.toJSON()));
  }, 2000);
}

function snippetFor(text: string, terms: string[]): SnippetSegment[] {
  const lower = text.toLowerCase();
  const hit =
    terms
      .map((t) => lower.indexOf(t.toLowerCase()))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0] ?? -1;
  const start = Math.max(0, hit - Math.floor(OFFLINE_SNIPPET_CHARS / 3));
  const window = text.slice(start, start + OFFLINE_SNIPPET_CHARS).replace(/\n+/g, " ");
  const prefix = start > 0 ? "…" : "";
  const suffix = start + OFFLINE_SNIPPET_CHARS < text.length ? "…" : "";
  const segments: SnippetSegment[] = [];
  const pattern = terms.length
    ? new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi")
    : null;
  let last = 0;
  if (pattern) {
    for (const m of window.matchAll(pattern)) {
      if (m.index > last) segments.push({ text: window.slice(last, m.index), highlight: false });
      segments.push({ text: m[0], highlight: true });
      last = m.index + m[0].length;
    }
  }
  if (last < window.length) segments.push({ text: window.slice(last), highlight: false });
  if (prefix) segments.unshift({ text: prefix, highlight: false });
  if (suffix) segments.push({ text: suffix, highlight: false });
  return segments;
}

export async function searchOffline(
  q: string,
  folderId: string | null,
  limit: number,
  offset: number,
): Promise<SearchOutput> {
  const started = performance.now();
  const idx = await getOfflineIndex();
  let hits = idx.search(q);
  if (hits.length === 0) hits = idx.search(q, { combineWith: "OR" });

  const { folders } = await lookups();
  const ids = hits.map((h) => h.id as string);
  const notes = new Map(
    (await db.notes.bulkGet(ids)).filter((n): n is Note => !!n).map((n) => [n.id, n]),
  );
  const scoped = hits.filter((h) => {
    const n = notes.get(h.id as string);
    return n && (!folderId || n.folderId === folderId);
  });
  const top = scoped[0]?.score ?? 0;
  const results: SearchResult[] = scoped.slice(offset, offset + limit).map((h) => {
    const n = notes.get(h.id as string)!;
    return {
      noteId: n.id,
      displayTitle: n.displayTitle,
      folderId: n.folderId,
      folderName: n.folderId ? (folders.get(n.folderId)?.name ?? null) : null,
      color: n.color,
      snippet: snippetFor(n.bodyPlain || n.displayTitle, h.terms),
      relevance: top > 0 ? Math.round((100 * h.score) / top) : 0,
      matchedBy: ["keyword"],
    };
  });
  return {
    results,
    total: scoped.length,
    tookMs: Math.round(performance.now() - started),
    semanticAvailable: false,
    indexedRatio: 1,
  };
}
