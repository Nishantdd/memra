import type { Database } from "./database.ts";
import { sql as m0001 } from "./migrations/0001_init.ts";

const MIGRATIONS: readonly string[] = [m0001];

export function currentSchemaVersion(db: Database): number {
  const hasMeta = db.get("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'meta'");
  if (!hasMeta) return 0;
  const row = db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'");
  return row ? Number(row.value) : 0;
}

export function pendingMigrations(db: Database): number {
  return Math.max(0, MIGRATIONS.length - currentSchemaVersion(db));
}

export function migrate(db: Database): { from: number; to: number } {
  const from = currentSchemaVersion(db);
  if (from > MIGRATIONS.length) {
    throw new Error(
      `Database schema version ${from} is newer than this build supports (${MIGRATIONS.length}).`,
    );
  }
  for (let v = from; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.run(
        "INSERT INTO meta(key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        String(v + 1),
      );
    });
  }
  return { from, to: MIGRATIONS.length };
}
