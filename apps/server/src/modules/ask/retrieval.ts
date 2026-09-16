import { ASK, countTokens } from "shared";
import { ASK_VEC_CANDIDATES, UNFILED_FOLDER_KEY } from "../../constants/index.ts";
import type { Database } from "../../db/database.ts";
import { toBlob } from "../../rag/rag-db.ts";
import type { IndexSupervisor } from "../../rag/supervisor.ts";

export interface RetrievedChunk {
  chunkId: number;
  displayText: string;
  headingPath: string;
  similarity: number;
}

export interface RetrievedNote {
  noteId: string;
  displayTitle: string;
  folderName: string | null;
  similarity: number;
  chunks: RetrievedChunk[];
}

interface VecRow {
  chunk_id: number;
  note_id: string;
  display_text: string;
  heading_path: string;
  distance: number;
}

export class AskRetriever {
  readonly #app: Database;
  readonly #rag: Database;
  readonly #index: IndexSupervisor;

  constructor(app: Database, rag: Database, index: IndexSupervisor) {
    this.#app = app;
    this.#rag = rag;
    this.#index = index;
  }

  async retrieve(q: string, folderId: string | null): Promise<RetrievedNote[]> {
    const vector = await this.#index.embedQuery(q);
    const rows = this.#rag.all<VecRow>(
      `SELECT v.chunk_id, c.note_id, c.display_text, c.heading_path, v.distance
       FROM vec_chunks v JOIN chunks c ON c.id = v.chunk_id
       WHERE v.embedding MATCH ? AND k = ? ${folderId ? "AND v.folder_id = ?" : ""}
       ORDER BY v.distance`,
      toBlob(vector),
      ASK_VEC_CANDIDATES,
      ...(folderId ? [folderId === "" ? UNFILED_FOLDER_KEY : folderId] : []),
    );

    const grouped = new Map<string, RetrievedChunk[]>();
    for (const r of rows) {
      const list = grouped.get(r.note_id) ?? [];
      if (list.length < ASK.chunksPerNote) {
        list.push({
          chunkId: r.chunk_id,
          displayText: r.display_text,
          headingPath: r.heading_path,
          similarity: 1 - r.distance,
        });
      }
      grouped.set(r.note_id, list);
    }
    if (grouped.size === 0) return [];

    const ids = [...grouped.keys()];
    const meta = this.#app.all<{ id: string; display_title: string; folder_name: string | null }>(
      `SELECT n.id, n.display_title, f.name AS folder_name FROM notes n LEFT JOIN folders f ON f.id = n.folder_id
       WHERE n.deleted_at IS NULL AND n.indexed_version = n.version AND n.id IN (${ids.map(() => "?").join(",")})`,
      ...ids,
    );
    const byId = new Map(meta.map((m) => [m.id, m]));

    const notes: RetrievedNote[] = [];
    for (const [noteId, chunks] of grouped) {
      const m = byId.get(noteId);
      if (!m) continue;
      notes.push({
        noteId,
        displayTitle: m.display_title,
        folderName: m.folder_name,
        similarity: chunks[0]!.similarity,
        chunks,
      });
    }
    notes.sort((a, b) => b.similarity - a.similarity || a.noteId.localeCompare(b.noteId));
    return fitBudget(notes.slice(0, ASK.maxSourceNotes));
  }
}

/** Drops the lowest-ranked chunks until the context fits the token budget. */
function fitBudget(notes: RetrievedNote[]): RetrievedNote[] {
  const total = () =>
    notes.reduce((sum, n) => sum + n.chunks.reduce((s, c) => s + countTokens(c.displayText), 0), 0);
  while (total() > ASK.contextTokenBudget) {
    const last = [...notes].reverse().find((n) => n.chunks.length > 1) ?? notes.at(-1);
    if (!last) break;
    if (last.chunks.length > 1) last.chunks.pop();
    else notes.splice(notes.indexOf(last), 1);
  }
  return notes;
}
