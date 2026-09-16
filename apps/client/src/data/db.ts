import Dexie, { type EntityTable } from "dexie";
import type { Folder, Note, Tag } from "shared";
import { LOCAL_DB_NAME } from "../constants/index.ts";

export interface MetaEntry {
  key: string;
  value: unknown;
}

export const db = new Dexie(LOCAL_DB_NAME) as Dexie & {
  notes: EntityTable<Note, "id">;
  folders: EntityTable<Folder, "id">;
  tags: EntityTable<Tag, "id">;
  meta: EntityTable<MetaEntry, "key">;
};

db.version(1).stores({
  notes: "id, folderId, pinned, updatedAt, serverSeq",
  folders: "id, sortOrder, serverSeq",
  tags: "id, serverSeq",
  meta: "key",
});

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function wipeLocalData(): Promise<void> {
  await db.transaction("rw", [db.notes, db.folders, db.tags, db.meta], async () => {
    await Promise.all([db.notes.clear(), db.folders.clear(), db.tags.clear(), db.meta.clear()]);
  });
}
