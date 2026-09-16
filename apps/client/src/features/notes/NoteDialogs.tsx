import { Modal } from "@carbon/react";
import { useState } from "react";
import type { Note, NoteColor } from "shared";
import { useUpdateNote } from "../../data/mutations.ts";
import { ColorField, FolderField } from "./NoteMetaFields.tsx";

interface NoteModalProps {
  note: Note | null;
  onClose: () => void;
}

export function MoveNoteModal({ note, onClose }: NoteModalProps) {
  return note ? <MoveNoteForm key={note.id} note={note} onClose={onClose} /> : null;
}

function MoveNoteForm({ note, onClose }: { note: Note; onClose: () => void }) {
  const update = useUpdateNote();
  const [folderId, setFolderId] = useState<string | null>(note.folderId);

  return (
    <Modal
      open
      size="xs"
      modalHeading="Move to folder"
      primaryButtonText="Move"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={update.isPending || folderId === note.folderId}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        update.mutate(
          { id: note.id, expectedVersion: note.version, folderId },
          { onSuccess: onClose },
        )
      }
    >
      <FolderField id="move-folder" value={folderId} onChange={setFolderId} size="md" />
    </Modal>
  );
}

export function RecolorNoteModal({ note, onClose }: NoteModalProps) {
  return note ? <RecolorNoteForm key={note.id} note={note} onClose={onClose} /> : null;
}

function RecolorNoteForm({ note, onClose }: { note: Note; onClose: () => void }) {
  const update = useUpdateNote();
  const [color, setColor] = useState<NoteColor>(note.color);

  return (
    <Modal
      open
      size="xs"
      modalHeading="Change colour"
      primaryButtonText="Apply"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={update.isPending || color === note.color}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        update.mutate({ id: note.id, expectedVersion: note.version, color }, { onSuccess: onClose })
      }
    >
      <ColorField id="recolor" value={color} onChange={setColor} size="md" />
    </Modal>
  );
}
