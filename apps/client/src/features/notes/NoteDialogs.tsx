import { Modal, RadioButton, RadioButtonGroup, Tag } from "@carbon/react";
import { useState } from "react";
import { NOTE_COLORS, type Note, type NoteColor } from "shared";
import { useUpdateNote } from "../../data/mutations.ts";
import { useFolders } from "../../data/queries.ts";
import { COLOR_LABELS, tagType } from "./noteColors.ts";

interface NoteModalProps {
  note: Note | null;
  onClose: () => void;
}

const UNFILED = "";

export function MoveNoteModal({ note, onClose }: NoteModalProps) {
  return note ? <MoveNoteForm key={note.id} note={note} onClose={onClose} /> : null;
}

function MoveNoteForm({ note, onClose }: { note: Note; onClose: () => void }) {
  const update = useUpdateNote();
  const folders = useFolders() ?? [];
  const [folderId, setFolderId] = useState(note.folderId ?? UNFILED);

  return (
    <Modal
      open
      size="xs"
      modalHeading="Move to folder"
      primaryButtonText="Move"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={update.isPending || folderId === (note.folderId ?? UNFILED)}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        update.mutate(
          { id: note.id, expectedVersion: note.version, folderId: folderId || null },
          { onSuccess: onClose },
        )
      }
    >
      <RadioButtonGroup
        name="move-folder"
        legendText="Folder"
        orientation="vertical"
        valueSelected={folderId}
        onChange={(value) => setFolderId(String(value))}
      >
        <RadioButton id="move-folder-all" value={UNFILED} labelText="All notes" />
        {folders.map((f) => (
          <RadioButton key={f.id} id={`move-folder-${f.id}`} value={f.id} labelText={f.name} />
        ))}
      </RadioButtonGroup>
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
      <RadioButtonGroup
        name="recolor"
        legendText="Colour"
        orientation="vertical"
        valueSelected={color}
        onChange={(value) => setColor(value as NoteColor)}
      >
        {NOTE_COLORS.map((c) => (
          <RadioButton
            key={c}
            id={`recolor-${c}`}
            value={c}
            labelText={
              <Tag type={tagType(c)} size="sm">
                {COLOR_LABELS[c]}
              </Tag>
            }
          />
        ))}
      </RadioButtonGroup>
    </Modal>
  );
}
