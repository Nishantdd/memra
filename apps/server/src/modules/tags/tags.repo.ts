import type { Tag } from "shared";
import { v7 as uuidv7 } from "uuid";
import { type Database, now } from "../../db/database.ts";
import { nextSeq } from "../../db/meta.ts";

interface TagRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_seq: number;
}

const SELECT = "SELECT id, name, created_at, updated_at, deleted_at, server_seq FROM tags";

function toTag(r: TagRow): Tag {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    serverSeq: r.server_seq,
  };
}

export class DuplicateTagName extends Error {
  constructor(readonly existing: Tag) {
    super();
  }
}
export class TagNotFound extends Error {}

export class TagsRepo {
  constructor(private readonly db: Database) {}

  list(): Tag[] {
    return this.db.all<TagRow>(`${SELECT} WHERE deleted_at IS NULL ORDER BY lower(name)`).map(toTag);
  }

  get(id: string): Tag | null {
    const row = this.db.get<TagRow>(`${SELECT} WHERE id = ? AND deleted_at IS NULL`, id);
    return row ? toTag(row) : null;
  }

  findByName(name: string): Tag | null {
    const row = this.db.get<TagRow>(`${SELECT} WHERE lower(name) = lower(?) AND deleted_at IS NULL`, name);
    return row ? toTag(row) : null;
  }

  allExist(ids: string[]): boolean {
    if (ids.length === 0) return true;
    const placeholders = ids.map(() => "?").join(",");
    const row = this.db.get<{ c: number }>(
      `SELECT count(*) AS c FROM tags WHERE deleted_at IS NULL AND id IN (${placeholders})`,
      ...ids,
    );
    return row!.c === new Set(ids).size;
  }

  create(name: string): Tag {
    return this.db.transaction(() => {
      const existing = this.findByName(name);
      if (existing) throw new DuplicateTagName(existing);
      const id = uuidv7();
      const t = now();
      this.db.run(
        "INSERT INTO tags(id, name, created_at, updated_at, deleted_at, server_seq) VALUES (?, ?, ?, ?, NULL, ?)",
        id, name, t, t, nextSeq(this.db),
      );
      return this.get(id)!;
    });
  }

  rename(id: string, name: string): { tag: Tag; noteIds: string[] } {
    return this.db.transaction(() => {
      if (!this.get(id)) throw new TagNotFound();
      const existing = this.findByName(name);
      if (existing && existing.id !== id) throw new DuplicateTagName(existing);
      this.db.run("UPDATE tags SET name = ?, updated_at = ?, server_seq = ? WHERE id = ?", name, now(), nextSeq(this.db), id);
      return { tag: this.get(id)!, noteIds: this.noteIdsFor(id) };
    });
  }

  softDelete(id: string): { tag: Tag; noteIds: string[] } {
    return this.db.transaction(() => {
      if (!this.get(id)) throw new TagNotFound();
      const noteIds = this.noteIdsFor(id);
      const t = now();
      this.db.run("DELETE FROM note_tags WHERE tag_id = ?", id);
      for (const noteId of noteIds) {
        this.db.run("UPDATE notes SET updated_at = ?, server_seq = ? WHERE id = ?", t, nextSeq(this.db), noteId);
      }
      this.db.run("UPDATE tags SET deleted_at = ?, updated_at = ?, server_seq = ? WHERE id = ?", t, t, nextSeq(this.db), id);
      return { tag: toTag(this.db.get<TagRow>(`${SELECT} WHERE id = ?`, id)!), noteIds };
    });
  }

  private noteIdsFor(tagId: string): string[] {
    return this.db
      .all<{ note_id: string }>(
        "SELECT nt.note_id FROM note_tags nt JOIN notes n ON n.id = nt.note_id WHERE nt.tag_id = ? AND n.deleted_at IS NULL",
        tagId,
      )
      .map((r) => r.note_id);
  }
}
