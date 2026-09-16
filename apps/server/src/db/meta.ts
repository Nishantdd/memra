import { randomUUID } from "node:crypto";
import type { Database } from "./database.ts";

export function getMeta(db: Database, key: string): string | null {
  return db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", key)?.value ?? null;
}

export function setMeta(db: Database, key: string, value: string): void {
  db.run(
    "INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export function nextSeq(db: Database): number {
  const row = db.get<{ value: string }>(
    "UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'server_seq' RETURNING value",
  );
  return Number(row!.value);
}

export function currentSeq(db: Database): number {
  return Number(getMeta(db, "server_seq") ?? "0");
}

export function ensureInstanceId(db: Database): string {
  const existing = getMeta(db, "instance_id");
  if (existing) return existing;
  const id = randomUUID();
  setMeta(db, "instance_id", id);
  return id;
}
