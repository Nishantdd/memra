import { useMutation } from "@tanstack/react-query";
import type { Folder, Note, Tag } from "shared";
import { orpc } from "./api/orpc.ts";
import { applyServerRow, syncNow } from "./sync/engine.ts";

const afterNote = async (note: Note) => {
  await applyServerRow("note", note);
  void syncNow();
};
const afterFolder = async (folder: Folder) => {
  await applyServerRow("folder", folder);
  void syncNow();
};
const afterTag = async (tag: Tag) => {
  await applyServerRow("tag", tag);
  void syncNow();
};

export const useCreateNote = () =>
  useMutation(orpc.notes.create.mutationOptions({ onSuccess: afterNote }));
export const useUpdateNote = () =>
  useMutation(orpc.notes.update.mutationOptions({ onSuccess: afterNote }));
export const useDeleteNote = () =>
  useMutation(orpc.notes.delete.mutationOptions({ onSuccess: afterNote }));
export const useRestoreNote = () =>
  useMutation(orpc.notes.restore.mutationOptions({ onSuccess: afterNote }));

export const useCreateFolder = () =>
  useMutation(orpc.folders.create.mutationOptions({ onSuccess: afterFolder }));
export const useRenameFolder = () =>
  useMutation(orpc.folders.rename.mutationOptions({ onSuccess: afterFolder }));
export const useDeleteFolder = () =>
  useMutation(orpc.folders.delete.mutationOptions({ onSuccess: afterFolder }));
export const useReorderFolders = () =>
  useMutation(
    orpc.folders.reorder.mutationOptions({
      onSuccess: async (folders) => {
        for (const f of folders) await applyServerRow("folder", f);
        void syncNow();
      },
    }),
  );

export const useCreateTag = () =>
  useMutation(orpc.tags.create.mutationOptions({ onSuccess: afterTag }));
