import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Folder, Note } from "shared";
import { orpc } from "./api/orpc.ts";
import { noteKeys } from "./queries.ts";

function useInvalidate() {
  const qc = useQueryClient();
  return {
    notes: (note?: Note) => {
      void qc.invalidateQueries({ queryKey: noteKeys.all() });
      if (note) qc.setQueryData(noteKeys.note(note.id), note);
    },
    folders: (created?: Folder) => {
      // Seed the list so a route to the new folder isn't bounced as unknown before the refetch.
      if (created) {
        qc.setQueryData<Folder[]>(orpc.folders.list.queryKey(), (list) =>
          list && !list.some((f) => f.id === created.id) ? [...list, created] : list,
        );
      }
      void qc.invalidateQueries({ queryKey: noteKeys.folders() });
      void qc.invalidateQueries({ queryKey: noteKeys.all() });
    },
    tags: () => {
      void qc.invalidateQueries({ queryKey: noteKeys.tags() });
      void qc.invalidateQueries({ queryKey: noteKeys.all() });
    },
  };
}

export function useCreateNote() {
  const inv = useInvalidate();
  return useMutation(orpc.notes.create.mutationOptions({ onSuccess: (n) => inv.notes(n) }));
}
export function useUpdateNote() {
  const inv = useInvalidate();
  return useMutation(orpc.notes.update.mutationOptions({ onSuccess: (n) => inv.notes(n) }));
}
export function useDeleteNote() {
  const inv = useInvalidate();
  return useMutation(orpc.notes.delete.mutationOptions({ onSuccess: () => inv.notes() }));
}
export function useRestoreNote() {
  const inv = useInvalidate();
  return useMutation(orpc.notes.restore.mutationOptions({ onSuccess: (n) => inv.notes(n) }));
}

export function useCreateFolder() {
  const inv = useInvalidate();
  return useMutation(orpc.folders.create.mutationOptions({ onSuccess: (f) => inv.folders(f) }));
}
export function useRenameFolder() {
  const inv = useInvalidate();
  return useMutation(orpc.folders.rename.mutationOptions({ onSuccess: inv.folders }));
}
export function useDeleteFolder() {
  const inv = useInvalidate();
  return useMutation(orpc.folders.delete.mutationOptions({ onSuccess: inv.folders }));
}

export function useCreateTag() {
  const inv = useInvalidate();
  return useMutation(orpc.tags.create.mutationOptions({ onSuccess: inv.tags }));
}
export function useRenameTag() {
  const inv = useInvalidate();
  return useMutation(orpc.tags.rename.mutationOptions({ onSuccess: inv.tags }));
}
export function useDeleteTag() {
  const inv = useInvalidate();
  return useMutation(orpc.tags.delete.mutationOptions({ onSuccess: inv.tags }));
}
