import {
  SEARCH,
  type NoteColor,
  type SearchInput,
  type SearchOutput,
  type SearchResult,
  type SnippetSegment,
} from "shared";
import {
  FTS_CANDIDATES,
  FTS_WEIGHTS,
  RRF_K,
  RRF_WEIGHT_KEYWORD,
  RRF_WEIGHT_SEMANTIC,
  SEMANTIC_EXTRA_CHUNK_BONUS,
  SEMANTIC_EXTRA_CHUNK_CAP,
  SNIPPET_ELLIPSIS,
  SNIPPET_END,
  SNIPPET_START,
  VEC_CANDIDATES,
  VEC_OVERFETCH_SCOPED,
} from "../../constants/index.ts";
import { type Database, now } from "../../db/database.ts";
import { toBlob } from "../../rag/rag-db.ts";
import type { IndexSupervisor } from "../../rag/supervisor.ts";
import { buildFtsQuery } from "./fts-query.ts";
import { plainSegments, toSegments } from "./snippet.ts";

interface Candidate {
  noteId: string;
  score: number;
  matchedBy: SearchResult["matchedBy"];
  snippet: SnippetSegment[] | null;
}

interface FtsRow {
  id: string;
  rank: number;
  snippet: string;
}

interface VecRow {
  note_id: string;
  display_text: string;
  distance: number;
}

interface NoteMeta {
  id: string;
  display_title: string;
  folder_id: string | null;
  folder_name: string | null;
  color: NoteColor;
  excerpt: string;
  updated_at: number;
}

const cutSnippet = (text: string) =>
  text.length > SEARCH.semanticSnippetChars
    ? `${text.slice(0, SEARCH.semanticSnippetChars).trimEnd()}…`
    : text;

export class SearchService {
  readonly #db: Database;
  readonly #rag: Database;
  readonly #index: IndexSupervisor;
  readonly #minSimilarity: number;

  constructor(db: Database, rag: Database, index: IndexSupervisor, minSimilarity: number) {
    this.#db = db;
    this.#rag = rag;
    this.#index = index;
    this.#minSimilarity = minSimilarity;
  }

  async search(input: SearchInput): Promise<SearchOutput> {
    const started = performance.now();
    const lists: { candidates: Candidate[]; weight: number }[] = [
      { candidates: this.keywordCandidates(input.q, input.folderId), weight: RRF_WEIGHT_KEYWORD },
    ];
    let semanticUsed = false;
    if (input.mode === "semantic" && this.#index.ready) {
      const semantic = await this.semanticCandidates(input.q, input.folderId);
      if (semantic) {
        lists.push({ candidates: semantic, weight: RRF_WEIGHT_SEMANTIC });
        semanticUsed = true;
      }
    }
    const fused = this.fuse(lists);
    const page = fused.slice(input.offset, input.offset + input.limit);
    const results = this.hydrate(page, fused[0]?.score ?? 0);
    const tookMs = Math.round(performance.now() - started);
    this.#db.run(
      "INSERT INTO search_log(query, mode, hits, latency_ms, at) VALUES (?, ?, ?, ?, ?)",
      input.q.slice(0, 200),
      semanticUsed ? "semantic" : "keyword",
      fused.length,
      tookMs,
      now(),
    );
    return {
      results,
      total: fused.length,
      tookMs,
      semanticAvailable: this.#index.ready,
      indexedRatio: this.indexedRatio(),
    };
  }

  private keywordCandidates(q: string, folderId: string | null): Candidate[] {
    const fts = buildFtsQuery(q);
    if (!fts) return [];
    const rows = this.runFts(fts.strict, folderId);
    const hits = rows.length > 0 ? rows : this.runFts(fts.loose, folderId);
    return hits.map((r) => ({
      noteId: r.id,
      score: -r.rank,
      matchedBy: ["keyword"],
      snippet: toSegments(r.snippet),
    }));
  }

  private runFts(match: string, folderId: string | null): FtsRow[] {
    const scope = folderId ? "AND n.folder_id = ?" : "";
    const params: (string | number)[] = [...FTS_WEIGHTS, match];
    if (folderId) params.push(folderId);
    params.push(FTS_CANDIDATES);
    return this.#db.all<FtsRow>(
      `SELECT n.id AS id, bm25(notes_fts, ?, ?, ?, ?) AS rank,
              snippet(notes_fts, 2, '${SNIPPET_START}', '${SNIPPET_END}', '${SNIPPET_ELLIPSIS}', ${SEARCH.snippetTokens}) AS snippet
       FROM notes_fts
       JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ? AND n.deleted_at IS NULL ${scope}
       ORDER BY rank, n.updated_at DESC, n.id
       LIMIT ?`,
      ...params,
    );
  }

  /** Returns null when the query embedding is unavailable so callers can fall back to keyword-only. */
  private async semanticCandidates(
    q: string,
    folderId: string | null,
  ): Promise<Candidate[] | null> {
    let vector: Float32Array;
    try {
      vector = await this.#index.embedQuery(q);
    } catch {
      return null;
    }
    const k = folderId ? VEC_OVERFETCH_SCOPED : VEC_CANDIDATES;
    const rows = this.#rag.all<VecRow>(
      `SELECT c.note_id, c.display_text, v.distance
       FROM vec_chunks v JOIN chunks c ON c.id = v.chunk_id
       WHERE v.embedding MATCH ? AND k = ? ${folderId ? "AND v.folder_id = ?" : ""}
       ORDER BY v.distance`,
      toBlob(vector),
      k,
      ...(folderId ? [folderId] : []),
    );

    const indexed = new Set(
      this.#db
        .all<{ id: string }>(
          "SELECT id FROM notes WHERE deleted_at IS NULL AND indexed_version = version",
        )
        .map((r) => r.id),
    );
    const byNote = new Map<string, { best: number; extra: number; snippet: string }>();
    for (const r of rows) {
      const similarity = 1 - r.distance;
      if (similarity < this.#minSimilarity || !indexed.has(r.note_id)) continue;
      const entry = byNote.get(r.note_id);
      if (!entry) byNote.set(r.note_id, { best: similarity, extra: 0, snippet: r.display_text });
      else entry.extra = Math.min(entry.extra + 1, SEMANTIC_EXTRA_CHUNK_CAP);
    }
    return [...byNote.entries()]
      .map(([noteId, e]): Candidate => ({
        noteId,
        score: e.best + SEMANTIC_EXTRA_CHUNK_BONUS * e.extra,
        matchedBy: ["semantic"],
        snippet: plainSegments(cutSnippet(e.snippet)),
      }))
      .sort((a, b) => b.score - a.score || a.noteId.localeCompare(b.noteId))
      .slice(0, VEC_CANDIDATES);
  }

  private fuse(lists: { candidates: Candidate[]; weight: number }[]): Candidate[] {
    const merged = new Map<string, Candidate>();
    for (const { candidates, weight } of lists) {
      candidates.forEach((c, rank) => {
        const contribution = weight / (RRF_K + rank + 1);
        const existing = merged.get(c.noteId);
        if (existing) {
          existing.score += contribution;
          existing.matchedBy = [...new Set([...existing.matchedBy, ...c.matchedBy])];
          existing.snippet ??= c.snippet;
        } else {
          merged.set(c.noteId, { ...c, score: contribution });
        }
      });
    }
    return [...merged.values()].sort(
      (a, b) => b.score - a.score || a.noteId.localeCompare(b.noteId),
    );
  }

  private hydrate(candidates: Candidate[], topScore: number): SearchResult[] {
    if (candidates.length === 0) return [];
    const placeholders = candidates.map(() => "?").join(",");
    const rows = this.#db.all<NoteMeta>(
      `SELECT n.id, n.display_title, n.folder_id, f.name AS folder_name, n.color, n.excerpt, n.updated_at
       FROM notes n LEFT JOIN folders f ON f.id = n.folder_id
       WHERE n.id IN (${placeholders})`,
      ...candidates.map((c) => c.noteId),
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return candidates.flatMap((c) => {
      const meta = byId.get(c.noteId);
      if (!meta) return [];
      return [
        {
          noteId: c.noteId,
          displayTitle: meta.display_title,
          folderId: meta.folder_id,
          folderName: meta.folder_name,
          color: meta.color,
          snippet: c.snippet ?? plainSegments(meta.excerpt),
          relevance: topScore > 0 ? Math.round((100 * c.score) / topScore) : 0,
          matchedBy: c.matchedBy,
        },
      ];
    });
  }

  private indexedRatio(): number {
    const row = this.#db.get<{ total: number; indexed: number | null }>(
      "SELECT count(*) AS total, sum(CASE WHEN indexed_version = version THEN 1 ELSE 0 END) AS indexed FROM notes WHERE deleted_at IS NULL",
    )!;
    return row.total ? (row.indexed ?? 0) / row.total : 1;
  }
}
