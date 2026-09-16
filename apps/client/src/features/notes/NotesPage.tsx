import {
  Button,
  Column,
  Grid,
  OverflowMenu,
  OverflowMenuItem,
  SkeletonPlaceholder,
  Tag,
} from "@carbon/react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import type { Note } from "shared";
import { useUpdateNote } from "../../data/mutations.ts";
import { useFolders, useNotes } from "../../data/queries.ts";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { DeleteFolderModal, RenameFolderModal } from "../folders/FolderDialogs.tsx";
import { SearchBar } from "../search/SearchBar.tsx";
import { Composer } from "./Composer.tsx";
import { NoteCard } from "./NoteCard.tsx";
import { MoveNoteModal, RecolorNoteModal } from "./NoteDialogs.tsx";
import { useDeleteWithUndo } from "./useDeleteWithUndo.tsx";

export function NotesPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const folders = useFolders();
  const notes = useNotes(folderId);
  const { connectivity } = useConnectivity();
  const readOnly = connectivity === "offline";
  const update = useUpdateNote();
  const [moving, setMoving] = useState<Note | null>(null);
  const [recoloring, setRecoloring] = useState<Note | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const { requestDelete, confirmModal, undoToast } = useDeleteWithUndo();

  const folder = folderId ? folders?.find((f) => f.id === folderId) : undefined;
  if (folderId && folders && !folder) return <Navigate to="/" replace />;

  const togglePin = (note: Note) =>
    update.mutate({ id: note.id, expectedVersion: note.version, pinned: !note.pinned });
  const pinned = notes?.filter((n) => n.pinned) ?? [];
  const others = notes?.filter((n) => !n.pinned) ?? [];

  const renderGrid = (items: Note[]) => (
    <Grid narrow className="memra-notes-grid">
      {items.map((note) => (
        <Column key={note.id} sm={4} md={4} lg={4}>
          <NoteCard
            note={note}
            readOnly={readOnly}
            showFolder={!folderId}
            onTogglePin={togglePin}
            onMove={setMoving}
            onRecolor={setRecoloring}
            onDelete={requestDelete}
          />
        </Column>
      ))}
    </Grid>
  );

  return (
    <Grid className="memra-page">
      <Column sm={4} md={8} lg={16} className="memra-page__title-row">
        <h1 className="memra-page-title">{folder?.name ?? "All notes"}</h1>
        {notes && (
          <Tag type="gray" size="sm" className="memra-page__count">
            {notes.length}
          </Tag>
        )}
        {folder && !readOnly && (
          <OverflowMenu
            aria-label="Folder actions"
            iconDescription="Folder actions"
            flipped
            size="sm"
          >
            <OverflowMenuItem itemText="Rename folder…" onClick={() => setRenaming(true)} />
            <OverflowMenuItem
              itemText="Delete folder…"
              isDelete
              hasDivider
              onClick={() => setDeletingFolder(true)}
            />
          </OverflowMenu>
        )}
      </Column>

      <Column sm={4} md={8} lg={10} className="memra-page__search">
        <SearchBar folderId={folder?.id ?? null} />
      </Column>

      <Column sm={4} md={8} lg={10} className="memra-page__composer">
        <Composer folderId={folder?.id ?? null} readOnly={readOnly} />
      </Column>

      {notes === undefined && (
        <Column sm={4} md={8} lg={16}>
          <Grid narrow className="memra-notes-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Column key={i} sm={4} md={4} lg={4}>
                <SkeletonPlaceholder className="memra-note-skeleton" />
              </Column>
            ))}
          </Grid>
        </Column>
      )}

      {notes && notes.length === 0 && (
        <Column sm={4} md={8} lg={8} className="memra-empty">
          <h2 className="memra-empty__heading">No notes {folder ? "in this folder" : ""} yet</h2>
          <p className="memra-empty__body">
            {readOnly
              ? "You're offline. Notes you create when back online will appear here."
              : "Capture something with the composer above."}
          </p>
          {!readOnly && (
            <Button
              kind="tertiary"
              size="md"
              onClick={() => document.querySelector<HTMLElement>(".memra-composer")?.click()}
            >
              Create a note
            </Button>
          )}
        </Column>
      )}

      {pinned.length > 0 && (
        <Column sm={4} md={8} lg={16} className="memra-section">
          <h2 className="memra-section__heading">Pinned</h2>
          {renderGrid(pinned)}
        </Column>
      )}
      {others.length > 0 && (
        <Column sm={4} md={8} lg={16} className="memra-section">
          {pinned.length > 0 && <h2 className="memra-section__heading">Others</h2>}
          {renderGrid(others)}
        </Column>
      )}

      <MoveNoteModal note={moving} onClose={() => setMoving(null)} />
      <RecolorNoteModal note={recoloring} onClose={() => setRecoloring(null)} />
      {confirmModal}
      {undoToast}
      {folder && (
        <>
          <RenameFolderModal folder={folder} open={renaming} onClose={() => setRenaming(false)} />
          <DeleteFolderModal
            folder={folder}
            noteCount={notes?.length ?? 0}
            open={deletingFolder}
            onClose={() => setDeletingFolder(false)}
            onDeleted={() => navigate("/")}
          />
        </>
      )}
    </Grid>
  );
}
