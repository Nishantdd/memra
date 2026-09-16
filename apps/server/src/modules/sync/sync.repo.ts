import type { Folder, Note, SyncPage, Tag } from "shared";
import type { Database } from "../../db/database.ts";
import { currentSeq, getMeta } from "../../db/meta.ts";
import { toNote } from "../notes/notes.repo.ts";

export class CursorTooOld extends Error {
  constructor(readonly oldestSeq: number) {
    super();
  }
}

export class SyncRepo {
  constructor(private readonly db: Database) {}

  pull(cursor: number, limit: number): SyncPage {
    const oldest = Number(getMeta(this.db, "oldest_tombstone_seq") ?? "0");
    if (cursor > 0 && cursor < oldest) throw new CursorTooOld(oldest);

    const seqs = this.db
      .all<{ server_seq: number }>(
        `SELECT server_seq FROM (
           SELECT server_seq FROM folders WHERE server_seq > ?
           UNION ALL SELECT server_seq FROM tags WHERE server_seq > ?
           UNION ALL SELECT server_seq FROM notes WHERE server_seq > ?
         ) ORDER BY server_seq LIMIT ?`,
        cursor, cursor, cursor, limit + 1,
      )
      .map((r) => r.server_seq);

    const hasMore = seqs.length > limit;
    const upTo = hasMore ? seqs[limit - 1]! : (seqs.at(-1) ?? currentSeq(this.db));

    const folders = this.db
      .all<{ id: string; name: string; sort_order: number; created_at: number; updated_at: number; deleted_at: number | null; server_seq: number }>(
        "SELECT id, name, sort_order, created_at, updated_at, deleted_at, server_seq FROM folders WHERE server_seq > ? AND server_seq <= ? ORDER BY server_seq",
        cursor, upTo,
      )
      .map<Folder>((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, serverSeq: r.server_seq }));

    const tags = this.db
      .all<{ id: string; name: string; created_at: number; updated_at: number; deleted_at: number | null; server_seq: number }>(
        "SELECT id, name, created_at, updated_at, deleted_at, server_seq FROM tags WHERE server_seq > ? AND server_seq <= ? ORDER BY server_seq",
        cursor, upTo,
      )
      .map<Tag>((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at, serverSeq: r.server_seq }));

    const notes: Note[] = this.db
      .all(
        `SELECT n.rowid AS rowid, n.id, n.folder_id, n.title, n.display_title, n.body_md, n.body_plain, n.excerpt,
                n.color, n.pinned, n.version, n.indexed_version, n.source_filename,
                n.created_at, n.updated_at, n.deleted_at, n.server_seq,
                (SELECT group_concat(nt.tag_id, ',') FROM note_tags nt WHERE nt.note_id = n.id) AS tag_ids
         FROM notes n WHERE n.server_seq > ? AND n.server_seq <= ? ORDER BY n.server_seq`,
        cursor, upTo,
      )
      .map((r) => toNote(r as never));

    return { cursor: upTo, hasMore, folders, tags, notes };
  }
}
