import { useQuery } from "@tanstack/react-query";
import type { Folder, Tag } from "shared";
import { NOTES_PAGE_SIZE } from "../constants/index.ts";
import { orpc } from "./api/orpc.ts";
import { useSession } from "./session.ts";

function useAuthed(): boolean {
  return useSession().status === "authenticated";
}

export function useFolders(): Folder[] | undefined {
  return useQuery(orpc.folders.list.queryOptions({ enabled: useAuthed(), staleTime: 60_000 })).data;
}

export function useTags(): Tag[] | undefined {
  return useQuery(orpc.tags.list.queryOptions({ enabled: useAuthed(), staleTime: 60_000 })).data;
}

export function useNotes(folderId: string | undefined) {
  return useQuery(
    orpc.notes.list.queryOptions({
      input: { folderId, limit: NOTES_PAGE_SIZE, offset: 0 },
      enabled: useAuthed(),
      staleTime: 30_000,
    }),
  );
}

export function useNote(id: string | undefined) {
  return useQuery(
    orpc.notes.get.queryOptions({
      input: { id: id ?? "" },
      enabled: useAuthed() && !!id,
      staleTime: 30_000,
    }),
  );
}

export const noteKeys = {
  all: () => orpc.notes.key(),
  folders: () => orpc.folders.key(),
  tags: () => orpc.tags.key(),
  note: (id: string) => orpc.notes.get.queryKey({ input: { id } }),
};
