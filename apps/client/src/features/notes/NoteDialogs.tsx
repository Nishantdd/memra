import { ActionableNotification, Modal } from "@carbon/react";
import { useEffect, useState } from "react";
import type { Note, NoteColor } from "shared";
import { useDeleteNote, useRestoreNote, useUpdateNote } from "../../data/mutations.ts";
import { ColorField, FolderField } from "./NoteMetaFields.tsx";

export function MoveNoteModal({ note, onClose }: { note: Note | null; onClose(): void }) {
  const update = useUpdateNote();
  const [folderId, setFolderId] = useState<string | null>(null);
  useEffect(() => setFolderId(note?.folderId ?? null), [note]);

  return (
    <Modal
      open={note !== null}
      size="xs"
      modalHeading="Move to folder"
      primaryButtonText="Move"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={update.isPending || folderId === (note?.folderId ?? null)}
      onRequestClose={onClose}
      onRequestSubmit={() => note && update.mutate({ id: note.id, expectedVersion: note.version, folderId }, { onSuccess: onClose })}
    >
      <FolderField id="move-folder" value={folderId} onChange={setFolderId} size="md" />
    </Modal>
  );
}

export function RecolorNoteModal({ note, onClose }: { note: Note | null; onClose(): void }) {
  const update = useUpdateNote();
  const [color, setColor] = useState<NoteColor>("none");
  useEffect(() => setColor(note?.color ?? "none"), [note]);

  return (
    <Modal
      open={note !== null}
      size="xs"
      modalHeading="Change colour"
      primaryButtonText="Apply"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={update.isPending || color === note?.color}
      onRequestClose={onClose}
      onRequestSubmit={() => note && update.mutate({ id: note.id, expectedVersion: note.version, color }, { onSuccess: onClose })}
    >
      <ColorField id="recolor" value={color} onChange={setColor} size="md" />
    </Modal>
  );
}

const UNDO_MS = 10_000;

export function useDeleteWithUndo() {
  const remove = useDeleteNote();
  const restore = useRestoreNote();
  const [pending, setPending] = useState<Note | null>(null);
  const [deleted, setDeleted] = useState<Note | null>(null);

  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [deleted]);

  const confirmModal = (
    <Modal
      open={pending !== null}
      danger
      size="sm"
      modalHeading="Delete note?"
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={remove.isPending}
      onRequestClose={() => setPending(null)}
      onRequestSubmit={() =>
        pending && remove.mutate({ id: pending.id }, { onSuccess: (n) => { setPending(null); setDeleted(n); } })
      }
    >
      <p>“{pending?.displayTitle}” will be deleted. You can undo this for a short while.</p>
    </Modal>
  );

  const undoToast = deleted ? (
    <div className="memra-toasts">
      <ActionableNotification
        kind="info"
        lowContrast
        hasFocus={false}
        title="Note deleted"
        subtitle={deleted.displayTitle}
        onClose={() => setDeleted(null)}
        actionButtonLabel="Undo"
        onActionButtonClick={() => restore.mutate({ id: deleted.id }, { onSuccess: () => setDeleted(null) })}
      />
    </div>
  ) : null;

  return { requestDelete: setPending, confirmModal, undoToast };
}
