import { ArrowLeft } from "@carbon/icons-react";
import { ActionableNotification, Button, Column, ContentSwitcher, Grid, InlineLoading, Loading, Switch, TextInput } from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { LIMITS, type Note, type NoteColor } from "shared";
import { useUpdateNote } from "../../data/mutations.ts";
import { useNote } from "../../data/queries.ts";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { Editor, type EditorApi } from "./editor/Editor.tsx";
import { EditorToolbar } from "./editor/EditorToolbar.tsx";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { ColorField, FolderField, TagsField } from "./NoteMetaFields.tsx";

const AUTOSAVE_MS = 1000;

interface Draft {
  title: string;
  bodyMd: string;
  color: NoteColor;
  folderId: string | null;
  tagIds: string[];
}

const toDraft = (n: Note): Draft => ({ title: n.title, bodyMd: n.bodyMd, color: n.color, folderId: n.folderId, tagIds: n.tagIds });
const isDirty = (d: Draft, n: Note) =>
  d.title !== n.title || d.bodyMd !== n.bodyMd || d.color !== n.color || d.folderId !== n.folderId || d.tagIds.join() !== n.tagIds.join();

export function NoteEditorPage() {
  const { noteId } = useParams();
  const note = useNote(noteId);
  if (note === undefined) return <Loading withOverlay description="Loading note" />;
  if (note === null) return <Navigate to="/" replace />;
  return <NoteEditor key={note.id} note={note} />;
}

function NoteEditor({ note }: { note: Note }) {
  const { connectivity } = useConnectivity();
  const readOnly = connectivity === "offline";
  const update = useUpdateNote();
  const [draft, setDraft] = useState<Draft>(() => toDraft(note));
  const [baseVersion, setBaseVersion] = useState(note.version);
  const [conflict, setConflict] = useState<Note | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const editorApi = useRef<EditorApi>(null);
  const dirty = isDirty(draft, note);

  const save = (expectedVersion = baseVersion) => {
    if (!dirty || readOnly || update.isPending) return;
    update.mutate(
      { id: note.id, expectedVersion, ...draft },
      {
        onSuccess: (saved) => setBaseVersion(saved.version),
        onError: (error) => {
          if (isDefinedError(error) && error.code === "CONFLICT") setConflict(error.data.current);
        },
      },
    );
  };

  useEffect(() => {
    if (!dirty || conflict) return;
    const t = setTimeout(() => save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, conflict]);

  useEffect(() => {
    if (!dirty) setBaseVersion(note.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.version]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const status = update.isPending
    ? { status: "active" as const, description: "Saving…" }
    : update.isError && !conflict
      ? { status: "error" as const, description: "Couldn't save" }
      : dirty
        ? { status: "inactive" as const, description: "Unsaved changes" }
        : { status: "finished" as const, description: "Saved" };

  return (
    <Grid className="memra-page memra-editor-page">
      <Column sm={4} md={8} lg={10}>
        <Button as={Link} to={note.folderId ? `/f/${note.folderId}` : "/"} kind="ghost" size="sm" renderIcon={ArrowLeft}>
          Back
        </Button>
        {conflict && (
          <ActionableNotification
            kind="warning"
            lowContrast
            inline
            title="This note changed elsewhere."
            subtitle="Reload to see the latest version, or overwrite it with your changes."
            actionButtonLabel="Overwrite"
            onActionButtonClick={() => { setConflict(null); save(conflict.version); }}
            onClose={() => { setDraft(toDraft(conflict)); setBaseVersion(conflict.version); setConflict(null); }}
            closeOnEscape={false}
            statusIconDescription="Conflict"
          />
        )}
        <TextInput
          id="note-title"
          labelText="Title (optional)"
          hideLabel
          placeholder="Title (optional)"
          size="lg"
          maxLength={LIMITS.titleMax}
          value={draft.title}
          readOnly={readOnly}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <div className="memra-editor-page__meta">
          <FolderField id="note-folder" value={draft.folderId} onChange={(folderId) => patch({ folderId })} disabled={readOnly} />
          <ColorField id="note-color" value={draft.color} onChange={(color) => patch({ color })} disabled={readOnly} />
          <TagsField id="note-tags" value={draft.tagIds} onChange={(tagIds) => patch({ tagIds })} disabled={readOnly} color={draft.color} />
        </div>
        <ContentSwitcher size="sm" selectedIndex={mode === "write" ? 0 : 1} onChange={({ index }) => setMode(index === 0 ? "write" : "preview")} className="memra-composer__switcher">
          <Switch name="write" text="Write" />
          <Switch name="preview" text="Preview" />
        </ContentSwitcher>
        {mode === "write" ? (
          <>
            <Editor
              id="note-body"
              ariaLabel="Note body"
              value={draft.bodyMd}
              onChange={(bodyMd) => patch({ bodyMd })}
              onSave={() => save()}
              readOnly={readOnly}
              maxLength={LIMITS.bodyMax}
              apiRef={editorApi}
              rows={16}
            />
            <EditorToolbar apiRef={editorApi} disabled={readOnly} />
          </>
        ) : (
          <MarkdownPreview markdown={draft.bodyMd || "*Nothing to preview yet*"} className="memra-editor-page__preview" />
        )}
        <div className="memra-editor-page__status">
          {readOnly ? <span className="memra-note__time">Read-only while offline</span> : <InlineLoading {...status} />}
        </div>
      </Column>
    </Grid>
  );
}
