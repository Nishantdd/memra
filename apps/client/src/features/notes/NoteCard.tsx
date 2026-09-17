import { Link, OverflowMenu, OverflowMenuItem, Tile } from "@carbon/react";
import type { Note } from "shared";
import { Link as RouterLink } from "react-router";
import { useTags } from "../../data/queries.ts";
import { formatAbsolute, formatRelative } from "../../lib/time.ts";
import { NoteTags } from "./NoteTags.tsx";

interface NoteCardProps {
  note: Note;
  onTogglePin: (note: Note) => void;
  onMove: (note: Note) => void;
  onRecolor: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NoteCard({ note, onTogglePin, onMove, onRecolor, onDelete }: NoteCardProps) {
  const tags = useTags() ?? [];
  const noteTags = note.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t) => !!t);

  return (
    <Tile className={`memra-note${note.color === "none" ? "" : ` memra-note--${note.color}`}`}>
      <div className="memra-note__head">
        <h3 className="memra-note__title">
          <Link as={RouterLink} to={`/n/${note.id}`}>
            {note.displayTitle}
          </Link>
        </h3>
        <OverflowMenu aria-label="Note actions" iconDescription="Note actions" size="sm" flipped>
          <OverflowMenuItem
            itemText={note.pinned ? "Unpin" : "Pin"}
            onClick={() => onTogglePin(note)}
          />
          <OverflowMenuItem itemText="Move to folder" onClick={() => onMove(note)} />
          <OverflowMenuItem itemText="Change colour" onClick={() => onRecolor(note)} />
          <OverflowMenuItem itemText="Delete" hasDivider isDelete onClick={() => onDelete(note)} />
        </OverflowMenu>
      </div>
      {note.excerpt && <p className="memra-note__excerpt">{note.excerpt}</p>}
      <div className="memra-note__foot">
        <NoteTags tags={noteTags} color={note.color} />
        <time
          className="memra-note__time"
          dateTime={new Date(note.updatedAt).toISOString()}
          title={formatAbsolute(note.updatedAt)}
        >
          {formatRelative(note.updatedAt)}
        </time>
      </div>
    </Tile>
  );
}
