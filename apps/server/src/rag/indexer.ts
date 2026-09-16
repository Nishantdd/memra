import { createHash } from "node:crypto";
import { chunkNote, type NoteColor } from "shared";
import { INDEX_MAX_ATTEMPTS, UNFILED_FOLDER_KEY } from "../constants/index.ts";
import { type Database, now } from "../db/database.ts";
import type { EmbeddingProvider } from "./embedding/provider.ts";
import { fromBlob, toBlob } from "./rag-db.ts";

interface NoteRow {
  id: string;
  version: number;
  folder_id: string | null;
  folder_name: string | null;
  display_title: string;
  body_md: string;
  body_plain: string;
  deleted_at: number | null;
  color: NoteColor;
  tags: string | null;
}

export interface IndexJob {
  note_id: string;
  version: number;
  enqueued_at: number;
  attempts: number;
}

export class Indexer {
  readonly #app: Database;
  readonly #rag: Database;
  readonly #embed: EmbeddingProvider;

  constructor(app: Database, rag: Database, embed: EmbeddingProvider) {
    this.#app = app;
    this.#rag = rag;
    this.#embed = embed;
  }

  nextJob(quietMs: number): IndexJob | undefined {
    return this.#app.get<IndexJob>(
      "SELECT note_id, version, enqueued_at, attempts FROM index_jobs WHERE enqueued_at <= ? AND attempts < ? ORDER BY enqueued_at LIMIT 1",
      now() - quietMs,
      INDEX_MAX_ATTEMPTS,
    );
  }

  pending(): { pending: number; failed: number } {
    return this.#app.get<{ pending: number; failed: number | null }>(
      "SELECT count(*) AS pending, sum(CASE WHEN attempts >= ? THEN 1 ELSE 0 END) AS failed FROM index_jobs",
      INDEX_MAX_ATTEMPTS,
    ) as { pending: number; failed: number };
  }

  enqueueAll(): number {
    this.#app.run("UPDATE notes SET indexed_version = 0");
    this.#app.run(
      `INSERT INTO index_jobs(note_id, version, enqueued_at, attempts, last_error)
       SELECT id, version, ?, 0, NULL FROM notes WHERE deleted_at IS NULL
       ON CONFLICT(note_id) DO UPDATE SET version = excluded.version, enqueued_at = excluded.enqueued_at, attempts = 0, last_error = NULL`,
      now(),
    );
    return this.#app.get<{ c: number }>("SELECT count(*) AS c FROM index_jobs")!.c;
  }

  enqueueStale(): number {
    const result = this.#app.run(
      `INSERT INTO index_jobs(note_id, version, enqueued_at, attempts, last_error)
       SELECT id, version, ?, 0, NULL FROM notes WHERE indexed_version < version AND deleted_at IS NULL
       ON CONFLICT(note_id) DO NOTHING`,
      now(),
    );
    return Number(result.changes);
  }

  clearRagData(): void {
    this.#rag.transaction(() => {
      this.#rag.exec("DELETE FROM vec_chunks; DELETE FROM chunks;");
    });
  }

  async process(job: IndexJob): Promise<"indexed" | "deleted" | "stale"> {
    const note = this.#app.get<NoteRow>(
      `SELECT n.id, n.version, n.folder_id, f.name AS folder_name, n.display_title, n.body_md, n.body_plain, n.deleted_at, n.color,
              (SELECT group_concat(t.name, ',') FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id) AS tags
       FROM notes n LEFT JOIN folders f ON f.id = n.folder_id WHERE n.id = ?`,
      job.note_id,
    );

    if (!note || note.deleted_at !== null) {
      this.removeNote(job.note_id);
      this.#app.run("DELETE FROM index_jobs WHERE note_id = ?", job.note_id);
      return "deleted";
    }

    const chunks = chunkNote(note.body_md, note.body_plain, {
      displayTitle: note.display_title,
      folderName: note.folder_name,
      tags: note.tags ? note.tags.split(",") : [],
    });
    const hashes = chunks.map((c) =>
      createHash("sha256").update(`${this.#embed.id}\n${c.text}`).digest("hex"),
    );
    const cached = this.lookupCache(hashes);
    const missing = chunks.map((c, i) => ({ c, i })).filter(({ i }) => !cached.has(hashes[i]!));
    const fresh = await this.#embed.embedDocuments(missing.map(({ c }) => c.text));
    missing.forEach(({ i }, k) => cached.set(hashes[i]!, fresh[k]!));

    this.#rag.transaction(() => {
      this.removeNote(note.id);
      const t = now();
      for (const [i, chunk] of chunks.entries()) {
        const vector = cached.get(hashes[i]!)!;
        const { lastInsertRowid } = this.#rag.run(
          "INSERT INTO chunks(note_id, note_version, ord, heading_path, text, display_text, token_count, content_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          note.id,
          note.version,
          chunk.ord,
          chunk.headingPath,
          chunk.text,
          chunk.displayText,
          chunk.tokenCount,
          hashes[i]!,
        );
        this.#rag.run(
          "INSERT INTO vec_chunks(chunk_id, embedding, note_id, folder_id) VALUES (?, ?, ?, ?)",
          BigInt(lastInsertRowid),
          toBlob(vector),
          note.id,
          note.folder_id ?? UNFILED_FOLDER_KEY,
        );
        this.#rag.run(
          "INSERT INTO embedding_cache(content_hash, embedding, created_at) VALUES (?, ?, ?) ON CONFLICT(content_hash) DO NOTHING",
          hashes[i]!,
          toBlob(vector),
          t,
        );
      }
    });

    return this.#app.transaction(() => {
      const current = this.#app.get<{ version: number }>(
        "SELECT version FROM notes WHERE id = ?",
        note.id,
      );
      if (!current || current.version !== note.version) return "stale";
      this.#app.run("UPDATE notes SET indexed_version = ? WHERE id = ?", note.version, note.id);
      this.#app.run(
        "DELETE FROM index_jobs WHERE note_id = ? AND version = ?",
        note.id,
        job.version,
      );
      return "indexed";
    });
  }

  fail(job: IndexJob, error: unknown): void {
    this.#app.run(
      "UPDATE index_jobs SET attempts = attempts + 1, last_error = ? WHERE note_id = ?",
      String(error instanceof Error ? error.message : error).slice(0, 500),
      job.note_id,
    );
  }

  private removeNote(noteId: string): void {
    this.#rag.run(
      "DELETE FROM vec_chunks WHERE chunk_id IN (SELECT id FROM chunks WHERE note_id = ?)",
      noteId,
    );
    this.#rag.run("DELETE FROM chunks WHERE note_id = ?", noteId);
  }

  private lookupCache(hashes: string[]): Map<string, Float32Array> {
    const map = new Map<string, Float32Array>();
    if (hashes.length === 0) return map;
    const rows = this.#rag.all<{ content_hash: string; embedding: Uint8Array }>(
      `SELECT content_hash, embedding FROM embedding_cache WHERE content_hash IN (${hashes.map(() => "?").join(",")})`,
      ...hashes,
    );
    for (const r of rows) map.set(r.content_hash, fromBlob(r.embedding));
    return map;
  }
}
