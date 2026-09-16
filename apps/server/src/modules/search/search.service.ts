import {
  SEARCH,
  type NoteColor,
  type SearchInput,
  type SearchOutput,
  type SearchResult,
} from "shared";
import {
  FTS_CANDIDATES,
  FTS_WEIGHTS,
  RRF_K,
  RRF_WEIGHT_KEYWORD,
  SNIPPET_ELLIPSIS,
  SNIPPET_END,
  SNIPPET_START,
} from "../../constants/search.ts";
import { type Database, now } from "../../db/database.ts";
import { buildFtsQuery } from "./fts-query.ts";
import { plainSegments, toSegments } from "./snippet.ts";

interface Candidate {
  noteId: string;
  score: number;
  matchedBy: SearchResult["matchedBy"];
  snippet: string | null;
}

interface FtsRow {
  id: string;
  rank: number;
  snippet: string;
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

export class SearchService {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  search(input: SearchInput): SearchOutput {
    const started = performance.now();
    const keyword = this.keywordCandidates(input.q, input.folderId);
    const fused = this.fuse([{ candidates: keyword, weight: RRF_WEIGHT_KEYWORD }]);
    const page = fused.slice(input.offset, input.offset + input.limit);
    const results = this.hydrate(page, fused[0]?.score ?? 0);
    const tookMs = Math.round(performance.now() - started);
    this.#db.run(
      "INSERT INTO search_log(query, mode, hits, latency_ms, at) VALUES (?, ?, ?, ?, ?)",
      input.q.slice(0, 200),
      input.mode,
      fused.length,
      tookMs,
      now(),
    );
    return {
      results,
      total: fused.length,
      tookMs,
      semanticAvailable: false,
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
      snippet: r.snippet,
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
          snippet: c.snippet ? toSegments(c.snippet) : plainSegments(meta.excerpt),
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
