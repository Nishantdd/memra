import { AddLarge, Search } from "@carbon/icons-react";
import {
  Column,
  Grid,
  IconButton,
  OverflowMenu,
  OverflowMenuItem,
  SkeletonPlaceholder,
  Tag,
} from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import type { Note } from "shared";
import { useUpdateNote } from "../../data/mutations.ts";
import { useFolders, useNotes } from "../../data/queries.ts";
import { usePageTitle } from "../../lib/usePageTitle.ts";

import { DeleteFolderModal, RenameFolderModal } from "../folders/FolderDialogs.tsx";
import { SearchModal } from "../search/SearchModal.tsx";
import { NoteCard } from "./NoteCard.tsx";
import { MoveNoteModal, RecolorNoteModal } from "./NoteDialogs.tsx";
import { UploadPreviewModal } from "./UploadPreviewModal.tsx";
import { useDeleteWithUndo } from "./useDeleteWithUndo.tsx";

export function NotesPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const folders = useFolders();
  const notes = useNotes(folderId);
  const update = useUpdateNote();
  const [moving, setMoving] = useState<Note | null>(null);
  const [recoloring, setRecoloring] = useState<Note | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [upload, setUpload] = useState<File | null>(null);
  const [searching, setSearching] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { requestDelete, confirmModal, undoToast } = useDeleteWithUndo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const folder = folderId ? folders?.find((f) => f.id === folderId) : undefined;
  usePageTitle(folder?.name ?? "All Notes");
  if (folderId && folders && !folder) return <Navigate to="/" replace />;

  const items = notes.data?.items ?? [];
  const pinned = items.filter((n) => n.pinned);
  const others = items.filter((n) => !n.pinned);
  const togglePin = (note: Note) =>
    update.mutate({ id: note.id, expectedVersion: note.version, pinned: !note.pinned });

  const grid = (list: Note[]) => (
    <Grid className="memra-notes-grid" condensed={false}>
      {list.map((note) => (
        <Column key={note.id} sm={4} md={4} lg={4}>
          <NoteCard
            note={note}
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
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h1 className="memra-page-title">
          {folder?.name ?? "All notes"}
          {notes.data && (
            <Tag type="gray" size="sm">
              {notes.data.total}
            </Tag>
          )}
          <span className="memra-page-title__actions">
            <IconButton
              label="Search (Ctrl+K)"
              kind="ghost"
              size="md"
              align="bottom-end"
              onClick={() => setSearching(true)}
            >
              <Search />
            </IconButton>
            <OverflowMenu
              aria-label="New"
              iconDescription="New"
              renderIcon={AddLarge}
              size="md"
              flipped
            >
              <OverflowMenuItem
                itemText="Create new note"
                onClick={() => void navigate(folder ? `/n/new?folder=${folder.id}` : "/n/new")}
              />
              <OverflowMenuItem
                itemText="Upload Markdown file"
                onClick={() => fileInput.current?.click()}
              />
            </OverflowMenu>
            {folder && (
              <OverflowMenu
                aria-label="Folder actions"
                iconDescription="Folder actions"
                size="md"
                flipped
              >
                <OverflowMenuItem itemText="Rename folder" onClick={() => setRenaming(true)} />
                <OverflowMenuItem
                  itemText="Delete folder"
                  isDelete
                  onClick={() => setDeletingFolder(true)}
                />
              </OverflowMenu>
            )}
          </span>
        </h1>
      </Column>

      <Column sm={4} md={8} lg={16}>
        {notes.isPending ? (
          <Grid className="memra-notes-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Column key={i} sm={4} md={4} lg={4}>
                <SkeletonPlaceholder style={{ inlineSize: "100%", blockSize: "12rem" }} />
              </Column>
            ))}
          </Grid>
        ) : items.length === 0 ? (
          <p className="memra-empty">
            No notes {folder ? "in this folder " : ""}yet. Use <strong>New</strong> to create one.
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="memra-section">
                <h2 className="memra-section__heading">Pinned</h2>
                {grid(pinned)}
              </section>
            )}
            {others.length > 0 && (
              <section className="memra-section">
                {pinned.length > 0 && <h2 className="memra-section__heading">Others</h2>}
                {grid(others)}
              </section>
            )}
          </>
        )}
      </Column>

      <input
        ref={fileInput}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(e) => {
          setUpload(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <UploadPreviewModal
        file={upload}
        defaultFolderId={folder?.id ?? null}
        onClose={() => setUpload(null)}
        onCreated={() => setUpload(null)}
      />
      <SearchModal
        open={searching}
        folderId={folder?.id ?? null}
        onClose={() => setSearching(false)}
      />
      <MoveNoteModal note={moving} onClose={() => setMoving(null)} />
      <RecolorNoteModal note={recoloring} onClose={() => setRecoloring(null)} />
      {confirmModal}
      {undoToast}
      {folder && (
        <>
          <RenameFolderModal folder={folder} open={renaming} onClose={() => setRenaming(false)} />
          <DeleteFolderModal
            folder={folder}
            noteCount={notes.data?.total ?? 0}
            open={deletingFolder}
            onClose={() => setDeletingFolder(false)}
            onDeleted={() => void navigate("/")}
          />
        </>
      )}
    </Grid>
  );
}
