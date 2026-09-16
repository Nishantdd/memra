import { Modal, TextInput } from "@carbon/react";
import { ORPCError } from "@orpc/client";
import { type FormEvent, useState } from "react";
import { LIMITS, type Folder } from "shared";
import { useCreateFolder, useDeleteFolder, useRenameFolder } from "../../data/mutations.ts";

interface NameModalProps {
  heading: string;
  primaryLabel: string;
  initialName?: string;
  pending: boolean;
  errorText: string | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

function FolderNameModal({
  heading,
  primaryLabel,
  initialName = "",
  pending,
  errorText,
  onClose,
  onSubmit,
}: NameModalProps) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (trimmed && !pending) onSubmit(trimmed);
  };

  return (
    <Modal
      open
      size="xs"
      modalHeading={heading}
      primaryButtonText={primaryLabel}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!trimmed || pending}
      onRequestClose={onClose}
      onRequestSubmit={() => submit()}
      selectorPrimaryFocus="#folder-name"
    >
      <form onSubmit={submit}>
        <TextInput
          id="folder-name"
          labelText="Folder name"
          value={name}
          maxLength={LIMITS.folderNameMax}
          onChange={(e) => setName(e.target.value)}
          invalid={errorText !== null}
          invalidText={errorText ?? ""}
        />
      </form>
    </Modal>
  );
}

function folderErrorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ORPCError) {
    if (error.code === "CONFLICT") return "A folder with this name already exists.";
    if (error.code === "FORBIDDEN") return `You can have at most ${LIMITS.folderCount} folders.`;
  }
  return "Something went wrong. Try again.";
}

interface CreateFolderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
}

export function CreateFolderModal({ open, onClose, onCreated }: CreateFolderModalProps) {
  const create = useCreateFolder();
  if (!open) return null;
  const close = () => {
    create.reset();
    onClose();
  };
  return (
    <FolderNameModal
      heading="New folder"
      primaryLabel="Create"
      pending={create.isPending}
      errorText={folderErrorText(create.error)}
      onClose={close}
      onSubmit={(name) =>
        create.mutate(
          { name },
          {
            onSuccess: (folder) => {
              close();
              onCreated?.(folder);
            },
          },
        )
      }
    />
  );
}

interface RenameFolderModalProps {
  folder: Folder;
  open: boolean;
  onClose: () => void;
}

export function RenameFolderModal({ folder, open, onClose }: RenameFolderModalProps) {
  const rename = useRenameFolder();
  if (!open) return null;
  const close = () => {
    rename.reset();
    onClose();
  };
  return (
    <FolderNameModal
      heading="Rename folder"
      primaryLabel="Rename"
      initialName={folder.name}
      pending={rename.isPending}
      errorText={folderErrorText(rename.error)}
      onClose={close}
      onSubmit={(name) => rename.mutate({ id: folder.id, name }, { onSuccess: close })}
    />
  );
}

interface DeleteFolderModalProps {
  folder: Folder;
  noteCount: number;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteFolderModal({
  folder,
  noteCount,
  open,
  onClose,
  onDeleted,
}: DeleteFolderModalProps) {
  const remove = useDeleteFolder();
  return (
    <Modal
      open={open}
      danger
      size="sm"
      modalHeading={`Delete “${folder.name}”?`}
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={remove.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        remove.mutate(
          { id: folder.id },
          {
            onSuccess: () => {
              onClose();
              onDeleted();
            },
          },
        )
      }
    >
      <p>
        {noteCount === 0
          ? "This folder is empty."
          : `${noteCount} ${noteCount === 1 ? "note" : "notes"} in this folder will be kept and moved to All notes.`}
      </p>
    </Modal>
  );
}
