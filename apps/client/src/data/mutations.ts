import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "shared";
import { orpc } from "./api/orpc.ts";
import { noteKeys } from "./queries.ts";

function useInvalidate() {
  const qc = useQueryClient();
  return {
    notes: (note?: Note) => {
      void qc.invalidateQueries({ queryKey: noteKeys.all() });
      if (note) qc.setQueryData(noteKeys.note(note.id), note);
    },
    folders: () => {
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
  return useMutation(orpc.folders.create.mutationOptions({ onSuccess: inv.folders }));
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
