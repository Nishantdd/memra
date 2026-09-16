import path from "node:path";
import { getLoadablePath } from "sqlite-vec";
import { CHUNKING } from "shared";
import { RAG_DB_FILE } from "../constants/index.ts";
import { type Database, NodeSqliteDatabase } from "../db/database.ts";

export interface RagIdentity {
  provider: string;
  model: string;
  dims: number;
  chunkerVersion: number;
}

export function openRagDatabase(
  dataDir: string,
  options: { readonly?: boolean } = {},
): NodeSqliteDatabase {
  const db = new NodeSqliteDatabase(path.join(dataDir, RAG_DB_FILE), {
    allowExtension: true,
    readonly: options.readonly,
  });
  db.loadExtension(getLoadablePath());
  return db;
}

export function readRagIdentity(db: Database): RagIdentity | null {
  const hasMeta = db.get(
    "SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'rag_meta'",
  );
  if (!hasMeta) return null;
  const rows = db.all<{ key: string; value: string }>("SELECT key, value FROM rag_meta");
  const meta = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (
    !meta.embedding_provider ||
    !meta.embedding_model ||
    !meta.embedding_dims ||
    !meta.chunker_version
  )
    return null;
  return {
    provider: meta.embedding_provider,
    model: meta.embedding_model,
    dims: Number(meta.embedding_dims),
    chunkerVersion: Number(meta.chunker_version),
  };
}

export function sameIdentity(a: RagIdentity | null, b: RagIdentity): boolean {
  return (
    !!a &&
    a.provider === b.provider &&
    a.model === b.model &&
    a.dims === b.dims &&
    a.chunkerVersion === b.chunkerVersion
  );
}

/** (Re)creates the RAG schema for the given identity. Keeps the embedding cache when only the chunker changed. */
export function ensureRagSchema(db: Database, identity: RagIdentity): { rebuilt: boolean } {
  const current = readRagIdentity(db);
  if (sameIdentity(current, identity)) return { rebuilt: false };
  const modelChanged =
    !current ||
    current.provider !== identity.provider ||
    current.model !== identity.model ||
    current.dims !== identity.dims;

  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS vec_chunks;
      DROP TABLE IF EXISTS chunks;
      CREATE TABLE IF NOT EXISTS rag_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE chunks (
        id            INTEGER PRIMARY KEY,
        note_id       TEXT NOT NULL,
        note_version  INTEGER NOT NULL,
        ord           INTEGER NOT NULL,
        heading_path  TEXT NOT NULL DEFAULT '',
        text          TEXT NOT NULL,
        display_text  TEXT NOT NULL,
        token_count   INTEGER NOT NULL,
        content_hash  TEXT NOT NULL,
        UNIQUE (note_id, ord)
      );
      CREATE INDEX chunks_note ON chunks(note_id);
      CREATE VIRTUAL TABLE vec_chunks USING vec0(
        chunk_id  INTEGER PRIMARY KEY,
        embedding float[${identity.dims}] distance_metric=cosine,
        note_id   TEXT,
        folder_id TEXT
      );
      CREATE TABLE IF NOT EXISTS embedding_cache (
        content_hash TEXT PRIMARY KEY,
        embedding    BLOB NOT NULL,
        created_at   INTEGER NOT NULL
      );
    `);
    if (modelChanged) db.exec("DELETE FROM embedding_cache");
    const set = (k: string, v: string) =>
      db.run(
        "INSERT INTO rag_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        k,
        v,
      );
    set("embedding_provider", identity.provider);
    set("embedding_model", identity.model);
    set("embedding_dims", String(identity.dims));
    set("chunker_version", String(identity.chunkerVersion));
    set("built_at", String(Date.now()));
  });
  return { rebuilt: true };
}

export const chunkerVersion = CHUNKING.version;

export const toBlob = (v: Float32Array): Uint8Array =>
  new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
export const fromBlob = (b: Uint8Array): Float32Array =>
  new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);

export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum) || 1;
  return v.map((x) => x / n);
}
