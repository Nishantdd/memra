import type { Note, NoteCreate, NotePatch } from "shared";
import { deriveFields } from "shared/markdown";
import { v7 as uuidv7 } from "uuid";
import { type Database, now } from "../../db/database.ts";
import { nextSeq } from "../../db/meta.ts";

interface NoteRow {
  rowid: number;
  id: string;
  folder_id: string | null;
  title: string;
  display_title: string;
  body_md: string;
  body_plain: string;
  excerpt: string;
  color: Note["color"];
  pinned: number;
  version: number;
  indexed_version: number;
  source_filename: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_seq: number;
  tag_ids: string | null;
}

const SELECT = `
  SELECT n.rowid AS rowid, n.id, n.folder_id, n.title, n.display_title, n.body_md, n.body_plain, n.excerpt,
         n.color, n.pinned, n.version, n.indexed_version, n.source_filename,
         n.created_at, n.updated_at, n.deleted_at, n.server_seq,
         (SELECT group_concat(nt.tag_id, ',') FROM note_tags nt WHERE nt.note_id = n.id) AS tag_ids
  FROM notes n`;

export function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    folderId: r.folder_id,
    title: r.title,
    displayTitle: r.display_title,
    bodyMd: r.body_md,
    bodyPlain: r.body_plain,
    excerpt: r.excerpt,
    color: r.color,
    pinned: r.pinned === 1,
    tagIds: r.tag_ids ? r.tag_ids.split(",").sort() : [],
    version: r.version,
    indexedVersion: r.indexed_version,
    sourceFilename: r.source_filename,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    serverSeq: r.server_seq,
  };
}

export class NoteNotFound extends Error {}
export class NoteConflict extends Error {
  readonly current: Note;

  constructor(current: Note) {
    super();
    this.current = current;
  }
}

export class NotesRepo {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  get(id: string, includeDeleted = false): Note | null {
    const row = this.#db.get<NoteRow>(
      `${SELECT} WHERE n.id = ?${includeDeleted ? "" : " AND n.deleted_at IS NULL"}`,
      id,
    );
    return row ? toNote(row) : null;
  }

  list(
    folderId: string | null | undefined,
    limit: number,
    offset: number,
  ): { items: Note[]; total: number } {
    const where =
      folderId === undefined ? "n.deleted_at IS NULL" : "n.deleted_at IS NULL AND n.folder_id IS ?";
    const params = folderId === undefined ? [] : [folderId];
    const items = this.#db
      .all<NoteRow>(
        `${SELECT} WHERE ${where} ORDER BY n.pinned DESC, n.updated_at DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset,
      )
      .map(toNote);
    const total = this.#db.get<{ c: number }>(
      `SELECT count(*) AS c FROM notes n WHERE ${where}`,
      ...params,
    )!.c;
    return { items, total };
  }

  create(input: NoteCreate): Note {
    return this.#db.transaction(() => {
      const id = uuidv7();
      const t = now();
      const d = deriveFields(input.title, input.bodyMd);
      this.#db.run(
        `INSERT INTO notes(id, folder_id, title, body_md, body_plain, display_title, excerpt, color, pinned,
                           version, indexed_version, source_filename, created_at, updated_at, deleted_at, server_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, NULL, ?)`,
        id,
        input.folderId,
        input.title,
        input.bodyMd,
        d.bodyPlain,
        d.displayTitle,
        d.excerpt,
        input.color,
        input.pinned ? 1 : 0,
        input.sourceFilename,
        t,
        t,
        nextSeq(this.#db),
      );
      this.setTags(id, input.tagIds);
      this.refreshFts(id);
      this.enqueueIndex(id, 1);
      return this.get(id)!;
    });
  }

  update(patch: NotePatch): Note {
    return this.#db.transaction(() => {
      const current = this.get(patch.id);
      if (!current) throw new NoteNotFound();
      if (current.version !== patch.expectedVersion) throw new NoteConflict(current);

      const title = patch.title ?? current.title;
      const bodyMd = patch.bodyMd ?? current.bodyMd;
      const d = deriveFields(title, bodyMd);
      const contentChanged = title !== current.title || bodyMd !== current.bodyMd;
      const version = current.version + 1;
      this.#db.run(
        `UPDATE notes SET folder_id = ?, title = ?, body_md = ?, body_plain = ?, display_title = ?, excerpt = ?,
                          color = ?, pinned = ?, version = ?, updated_at = ?, server_seq = ?
         WHERE id = ?`,
        patch.folderId === undefined ? current.folderId : patch.folderId,
        title,
        bodyMd,
        d.bodyPlain,
        d.displayTitle,
        d.excerpt,
        patch.color ?? current.color,
        (patch.pinned ?? current.pinned) ? 1 : 0,
        version,
        now(),
        nextSeq(this.#db),
        patch.id,
      );
      if (patch.tagIds) this.setTags(patch.id, patch.tagIds);
      this.refreshFts(patch.id);
      const tagsChanged =
        patch.tagIds !== undefined && patch.tagIds.slice().sort().join() !== current.tagIds.join();
      const folderChanged = patch.folderId !== undefined && patch.folderId !== current.folderId;
      if (contentChanged || tagsChanged || folderChanged) this.enqueueIndex(patch.id, version);
      else
        this.#db.run(
          "UPDATE notes SET indexed_version = ? WHERE id = ? AND indexed_version = ?",
          version,
          patch.id,
          current.version,
        );
      return this.get(patch.id)!;
    });
  }

  softDelete(id: string): Note {
    return this.#db.transaction(() => {
      if (!this.get(id)) throw new NoteNotFound();
      const t = now();
      this.#db.run(
        "UPDATE notes SET deleted_at = ?, updated_at = ?, server_seq = ? WHERE id = ?",
        t,
        t,
        nextSeq(this.#db),
        id,
      );
      this.#db.run(
        "DELETE FROM notes_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?)",
        id,
      );
      this.enqueueIndex(id, this.get(id, true)!.version);
      return this.get(id, true)!;
    });
  }

  restore(id: string): Note {
    return this.#db.transaction(() => {
      const note = this.get(id, true);
      if (!note || note.deletedAt === null) throw new NoteNotFound();
      this.#db.run(
        "UPDATE notes SET deleted_at = NULL, updated_at = ?, server_seq = ? WHERE id = ?",
        now(),
        nextSeq(this.#db),
        id,
      );
      this.refreshFts(id);
      this.enqueueIndex(id, note.version);
      return this.get(id)!;
    });
  }

  private setTags(noteId: string, tagIds: string[]): void {
    this.#db.run("DELETE FROM note_tags WHERE note_id = ?", noteId);
    for (const tagId of new Set(tagIds)) {
      this.#db.run("INSERT INTO note_tags(note_id, tag_id) VALUES (?, ?)", noteId, tagId);
    }
  }

  refreshFts(noteId: string): void {
    const row = this.#db.get<{
      rowid: number;
      display_title: string;
      body_plain: string;
      deleted_at: number | null;
      folder: string | null;
      tags: string | null;
    }>(
      `SELECT n.rowid AS rowid, n.display_title, n.body_plain, n.deleted_at,
              (SELECT f.name FROM folders f WHERE f.id = n.folder_id) AS folder,
              (SELECT group_concat(t.name, ' ') FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id) AS tags
       FROM notes n WHERE n.id = ?`,
      noteId,
    );
    if (!row) return;
    this.#db.run("DELETE FROM notes_fts WHERE rowid = ?", BigInt(row.rowid));
    if (row.deleted_at !== null) return;
    this.#db.run(
      "INSERT INTO notes_fts(rowid, title, tags, body, folder) VALUES (?, ?, ?, ?, ?)",
      BigInt(row.rowid),
      row.display_title,
      row.tags ?? "",
      row.body_plain,
      row.folder ?? "",
    );
  }

  refreshFtsMany(noteIds: string[]): void {
    for (const id of noteIds) this.refreshFts(id);
  }

  enqueueIndex(noteId: string, version: number): void {
    this.#db.run(
      `INSERT INTO index_jobs(note_id, version, enqueued_at, attempts, last_error) VALUES (?, ?, ?, 0, NULL)
       ON CONFLICT(note_id) DO UPDATE SET version = excluded.version, enqueued_at = excluded.enqueued_at, attempts = 0, last_error = NULL`,
      noteId,
      version,
      now(),
    );
  }

  enqueueIndexMany(noteIds: string[]): void {
    for (const id of noteIds) {
      const v = this.#db.get<{ version: number }>("SELECT version FROM notes WHERE id = ?", id);
      if (v) this.enqueueIndex(id, v.version);
    }
  }
}
