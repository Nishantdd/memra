import { Modal, TextInput } from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { type FormEvent, useEffect, useState } from "react";
import { LIMITS, type Folder } from "shared";
import { useCreateFolder, useDeleteFolder, useRenameFolder } from "../../data/mutations.ts";

interface NameModalProps {
  open: boolean;
  heading: string;
  primaryLabel: string;
  initialName?: string;
  pending: boolean;
  errorText: string | null;
  onClose(): void;
  onSubmit(name: string): void;
}

function FolderNameModal({ open, heading, primaryLabel, initialName = "", pending, errorText, onClose, onSubmit }: NameModalProps) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (trimmed && !pending) onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
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
  if (isDefinedError(error)) {
    if (error.code === "CONFLICT") return "A folder with this name already exists.";
    if (error.code === "FORBIDDEN") return `You can have at most ${LIMITS.folderCount} folders.`;
  }
  return "Something went wrong. Try again.";
}

export function CreateFolderModal({ open, onClose, onCreated }: { open: boolean; onClose(): void; onCreated?(folder: Folder): void }) {
  const create = useCreateFolder();
  useEffect(() => {
    if (!open) create.reset();
  }, [open]);

  return (
    <FolderNameModal
      open={open}
      heading="New folder"
      primaryLabel="Create"
      pending={create.isPending}
      errorText={folderErrorText(create.error)}
      onClose={onClose}
      onSubmit={(name) =>
        create.mutate({ name }, { onSuccess: (folder) => { onClose(); onCreated?.(folder); } })
      }
    />
  );
}

export function RenameFolderModal({ folder, open, onClose }: { folder: Folder; open: boolean; onClose(): void }) {
  const rename = useRenameFolder();
  useEffect(() => {
    if (!open) rename.reset();
  }, [open]);

  return (
    <FolderNameModal
      open={open}
      heading="Rename folder"
      primaryLabel="Rename"
      initialName={folder.name}
      pending={rename.isPending}
      errorText={folderErrorText(rename.error)}
      onClose={onClose}
      onSubmit={(name) => rename.mutate({ id: folder.id, name }, { onSuccess: onClose })}
    />
  );
}

export function DeleteFolderModal({ folder, noteCount, open, onClose, onDeleted }: { folder: Folder; noteCount: number; open: boolean; onClose(): void; onDeleted(): void }) {
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
      onRequestSubmit={() => remove.mutate({ id: folder.id }, { onSuccess: () => { onClose(); onDeleted(); } })}
    >
      <p>
        {noteCount === 0
          ? "This folder is empty."
          : `${noteCount} ${noteCount === 1 ? "note" : "notes"} in this folder will be kept and moved to All notes.`}
      </p>
    </Modal>
  );
}
