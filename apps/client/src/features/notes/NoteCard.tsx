import { Pin, PinFilled } from "@carbon/icons-react";
import { IconButton, Link, OverflowMenu, OverflowMenuItem, Tag, Tile } from "@carbon/react";
import type { Note } from "shared";
import { Link as RouterLink } from "react-router";
import { useFolders, useTags } from "../../data/queries.ts";
import { formatAbsolute, formatRelative } from "../../lib/time.ts";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { COLOR_LABELS, tagType } from "./NoteMetaFields.tsx";

interface NoteCardProps {
  note: Note;
  readOnly: boolean;
  showFolder: boolean;
  onTogglePin(note: Note): void;
  onMove(note: Note): void;
  onRecolor(note: Note): void;
  onDelete(note: Note): void;
}

export function NoteCard({ note, readOnly, showFolder, onTogglePin, onMove, onRecolor, onDelete }: NoteCardProps) {
  const tags = useTags() ?? [];
  const folders = useFolders() ?? [];
  const noteTags = note.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t) => !!t);
  const folder = showFolder && note.folderId ? folders.find((f) => f.id === note.folderId) : undefined;
  const derivedTitle = !note.title.trim();

  return (
    <Tile className="memra-note" id={`note-${note.id}`} data-note-id={note.id}>
      <div className="memra-note__head">
        <h3 className={`memra-note__title${derivedTitle ? " memra-note__title--derived" : ""}`}>
          <Link as={RouterLink} to={`/n/${note.id}`}>
            {note.displayTitle}
          </Link>
        </h3>
        <div className="memra-note__actions">
          <IconButton
            label={note.pinned ? "Unpin" : "Pin"}
            kind="ghost"
            size="sm"
            align="bottom"
            disabled={readOnly}
            onClick={() => onTogglePin(note)}
          >
            {note.pinned ? <PinFilled size={16} /> : <Pin size={16} />}
          </IconButton>
          <OverflowMenu size="sm" flipped aria-label="Note actions" iconDescription="Note actions" disabled={readOnly}>
            <OverflowMenuItem itemText="Move to folder…" onClick={() => onMove(note)} />
            <OverflowMenuItem itemText="Change colour…" onClick={() => onRecolor(note)} />
            <OverflowMenuItem itemText="Delete" isDelete hasDivider onClick={() => onDelete(note)} />
          </OverflowMenu>
        </div>
      </div>
      {note.bodyMd && <MarkdownPreview markdown={note.bodyMd} className="memra-note__body" />}
      <div className="memra-note__foot">
        <div className="memra-note__tags">
          {noteTags.map((t) => (
            <Tag key={t.id} type={tagType(note.color)} size="sm">
              {t.name}
            </Tag>
          ))}
          {noteTags.length === 0 && note.color !== "none" && (
            <Tag type={tagType(note.color)} size="sm">
              {COLOR_LABELS[note.color]}
            </Tag>
          )}
        </div>
        <div className="memra-note__meta">
          {folder && <span className="memra-note__folder">{folder.name}</span>}
          <time className="memra-note__time" dateTime={new Date(note.updatedAt).toISOString()} title={formatAbsolute(note.updatedAt)}>
            {formatRelative(note.updatedAt)}
          </time>
        </div>
      </div>
    </Tile>
  );
}
