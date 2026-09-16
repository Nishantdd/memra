import { useLiveQuery } from "dexie-react-hooks";
import type { Folder, Note, Tag } from "shared";
import { db } from "./db.ts";

export function useFolders(): Folder[] | undefined {
  return useLiveQuery(() => db.folders.orderBy("sortOrder").toArray(), []);
}

export function useTags(): Tag[] | undefined {
  return useLiveQuery(() => db.tags.toArray().then((t) => t.sort((a, b) => a.name.localeCompare(b.name))), []);
}

export function useNotes(folderId: string | undefined): Note[] | undefined {
  return useLiveQuery(async () => {
    const notes = folderId === undefined ? await db.notes.toArray() : await db.notes.where("folderId").equals(folderId).toArray();
    return notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [folderId]);
}

export function useNote(id: string | undefined): Note | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.notes.get(id)) ?? null) : null), [id]);
}

export function useNoteCounts(): Record<string, number> | undefined {
  return useLiveQuery(async () => {
    const counts: Record<string, number> = { all: 0 };
    await db.notes.each((n) => {
      counts.all = (counts.all ?? 0) + 1;
      if (n.folderId) counts[n.folderId] = (counts[n.folderId] ?? 0) + 1;
    });
    return counts;
  }, []);
}
