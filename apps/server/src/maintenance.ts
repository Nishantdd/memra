import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import {
  BACKUP_DIR,
  BACKUP_KEEP,
  DATA_DIR_MODE,
  TOMBSTONE_RETENTION_MS,
} from "./constants/index.ts";
import { type Database, now } from "./db/database.ts";

export async function backupDatabase(
  db: Database,
  dataDir: string,
  label = new Date().toISOString().slice(0, 10),
): Promise<string> {
  const dir = path.join(dataDir, BACKUP_DIR);
  mkdirSync(dir, { recursive: true, mode: DATA_DIR_MODE });
  const dest = path.join(dir, `memra-${label}.sqlite`);
  await db.backup(dest);
  pruneBackups(dir);
  return dest;
}

function pruneBackups(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => /^memra-.*\.sqlite$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP)))
    unlinkSync(path.join(dir, f));
}

/** Hard-deletes soft-deleted rows once the undo window has long passed. */
export function purgeTombstones(db: Database): number {
  const cutoff = now() - TOMBSTONE_RETENTION_MS;
  return db.transaction(() => {
    const removed =
      Number(
        db.run("DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?", cutoff).changes,
      ) +
      Number(
        db.run("DELETE FROM folders WHERE deleted_at IS NOT NULL AND deleted_at < ?", cutoff)
          .changes,
      ) +
      Number(
        db.run("DELETE FROM tags WHERE deleted_at IS NOT NULL AND deleted_at < ?", cutoff).changes,
      );
    return removed;
  });
}

export function optimize(db: Database): void {
  db.exec("PRAGMA optimize");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}
