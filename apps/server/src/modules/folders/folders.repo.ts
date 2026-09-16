import { LIMITS, type Folder } from "shared";
import { v7 as uuidv7 } from "uuid";
import { type Database, now } from "../../db/database.ts";
import { nextSeq } from "../../db/meta.ts";

interface FolderRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_seq: number;
}

const SELECT = "SELECT id, name, sort_order, created_at, updated_at, deleted_at, server_seq FROM folders";

function toFolder(r: FolderRow): Folder {
  return {
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    serverSeq: r.server_seq,
  };
}

export class DuplicateFolderName extends Error {}
export class FolderLimitReached extends Error {}
export class FolderNotFound extends Error {}
export class FolderOrderMismatch extends Error {}

export class FoldersRepo {
  constructor(private readonly db: Database) {}

  list(): Folder[] {
    return this.db
      .all<FolderRow>(`${SELECT} WHERE deleted_at IS NULL ORDER BY sort_order, lower(name)`)
      .map(toFolder);
  }

  get(id: string): Folder | null {
    const row = this.db.get<FolderRow>(`${SELECT} WHERE id = ? AND deleted_at IS NULL`, id);
    return row ? toFolder(row) : null;
  }

  private nameTaken(name: string, exceptId?: string): boolean {
    return !!this.db.get(
      "SELECT 1 AS x FROM folders WHERE lower(name) = lower(?) AND deleted_at IS NULL AND id IS NOT ?",
      name,
      exceptId ?? null,
    );
  }

  create(name: string): Folder {
    return this.db.transaction(() => {
      const count = this.db.get<{ c: number }>("SELECT count(*) AS c FROM folders WHERE deleted_at IS NULL")!.c;
      if (count >= LIMITS.folderCount) throw new FolderLimitReached();
      if (this.nameTaken(name)) throw new DuplicateFolderName();
      const maxOrder = this.db.get<{ m: number | null }>("SELECT max(sort_order) AS m FROM folders WHERE deleted_at IS NULL")!.m;
      const id = uuidv7();
      const t = now();
      this.db.run(
        "INSERT INTO folders(id, name, sort_order, created_at, updated_at, deleted_at, server_seq) VALUES (?, ?, ?, ?, ?, NULL, ?)",
        id, name, (maxOrder ?? -1) + 1, t, t, nextSeq(this.db),
      );
      return this.get(id)!;
    });
  }

  rename(id: string, name: string): { folder: Folder; noteIds: string[] } {
    return this.db.transaction(() => {
      if (!this.get(id)) throw new FolderNotFound();
      if (this.nameTaken(name, id)) throw new DuplicateFolderName();
      this.db.run("UPDATE folders SET name = ?, updated_at = ?, server_seq = ? WHERE id = ?", name, now(), nextSeq(this.db), id);
      const noteIds = this.db
        .all<{ id: string }>("SELECT id FROM notes WHERE folder_id = ? AND deleted_at IS NULL", id)
        .map((r) => r.id);
      return { folder: this.get(id)!, noteIds };
    });
  }

  softDelete(id: string): { folder: Folder; noteIds: string[] } {
    return this.db.transaction(() => {
      if (!this.get(id)) throw new FolderNotFound();
      const t = now();
      const noteIds = this.db
        .all<{ id: string }>("SELECT id FROM notes WHERE folder_id = ? AND deleted_at IS NULL", id)
        .map((r) => r.id);
      for (const noteId of noteIds) {
        this.db.run("UPDATE notes SET folder_id = NULL, updated_at = ?, server_seq = ? WHERE id = ?", t, nextSeq(this.db), noteId);
      }
      this.db.run("UPDATE folders SET deleted_at = ?, updated_at = ?, server_seq = ? WHERE id = ?", t, t, nextSeq(this.db), id);
      const row = this.db.get<FolderRow>(`${SELECT} WHERE id = ?`, id)!;
      return { folder: toFolder(row), noteIds };
    });
  }

  reorder(ids: string[]): Folder[] {
    return this.db.transaction(() => {
      const current = this.list().map((f) => f.id);
      if (current.length !== ids.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) {
        throw new FolderOrderMismatch();
      }
      const t = now();
      ids.forEach((id, i) => {
        this.db.run("UPDATE folders SET sort_order = ?, updated_at = ?, server_seq = ? WHERE id = ?", i, t, nextSeq(this.db), id);
      });
      return this.list();
    });
  }
}
