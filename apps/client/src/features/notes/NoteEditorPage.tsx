import { View } from "@carbon/icons-react";
import {
  ActionableNotification,
  Breadcrumb,
  BreadcrumbItem,
  Column,
  Grid,
  IconButton,
  Loading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  TextInput,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { LIMITS, type Note, type NoteColor } from "shared";
import { AUTOSAVE_MS, EDITOR_ROWS } from "../../constants/index.ts";
import { useCreateNote, useUpdateNote } from "../../data/mutations.ts";
import { useFolders, useNote } from "../../data/queries.ts";
import { useReportSaveStatus } from "../../data/saveStatus.ts";
import { Editor, type EditorApi } from "./editor/Editor.tsx";
import { EditorToolbar } from "./editor/EditorToolbar.tsx";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { ColorField, FolderField, TagsField } from "./NoteMetaFields.tsx";
import { usePageTitle } from "../../lib/usePageTitle.ts";

interface Draft {
  title: string;
  bodyMd: string;
  color: NoteColor;
  folderId: string | null;
  tagIds: string[];
}

const toDraft = (n: Note): Draft => ({
  title: n.title,
  bodyMd: n.bodyMd,
  color: n.color,
  folderId: n.folderId,
  tagIds: n.tagIds,
});
const isDirty = (d: Draft, n: Draft) =>
  d.title !== n.title ||
  d.bodyMd !== n.bodyMd ||
  d.color !== n.color ||
  d.folderId !== n.folderId ||
  d.tagIds.join() !== n.tagIds.join();

export function NoteEditorPage() {
  const { noteId } = useParams();
  const [params] = useSearchParams();
  if (!noteId) return <NewNote folderId={params.get("folder")} />;
  return <ExistingNote id={noteId} />;
}

function ExistingNote({ id }: { id: string }) {
  const note = useNote(id);
  if (note.isPending)
    return (
      <div className="memra-loading">
        <Loading small withOverlay={false} description="Loading note" />
      </div>
    );
  if (note.isError || !note.data) return <Navigate to="/" replace />;
  return <NoteEditor key={note.data.id} note={note.data} />;
}

function NewNote({ folderId }: { folderId: string | null }) {
  const create = useCreateNote();
  const navigate = useNavigate();
  usePageTitle("New Note");
  const [draft, setDraft] = useState<Draft>({
    title: "",
    bodyMd: "",
    color: "none",
    folderId,
    tagIds: [],
  });
  const empty = !draft.title.trim() && !draft.bodyMd.trim();
  useReportSaveStatus(
    "new-note",
    empty || create.isSuccess ? "saved" : create.isPending ? "saving" : "unsaved",
  );

  useEffect(() => {
    if (empty || create.isPending || create.isSuccess) return;
    const t = setTimeout(() => {
      create.mutate(
        {
          title: draft.title.trim(),
          bodyMd: draft.bodyMd,
          color: draft.color,
          folderId: draft.folderId,
          tagIds: draft.tagIds,
          pinned: false,
          sourceFilename: null,
        },
        { onSuccess: (n) => void navigate(`/n/${n.id}/edit`, { replace: true }) },
      );
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <EditorForm draft={draft} onChange={setDraft} folderId={draft.folderId} title="New note" />
  );
}

function NoteEditor({ note }: { note: Note }) {
  const update = useUpdateNote();
  const [draft, setDraft] = useState<Draft>(() => toDraft(note));
  const [baseVersion, setBaseVersion] = useState(note.version);
  const [conflict, setConflict] = useState<Note | null>(null);
  const dirty = isDirty(draft, toDraft(note));
  usePageTitle(`Edit · ${note.displayTitle}`);
  useReportSaveStatus(
    `note:${note.id}`,
    update.isPending
      ? "saving"
      : update.isError && !conflict
        ? "error"
        : dirty
          ? "unsaved"
          : "saved",
  );

  const save = (expectedVersion = baseVersion) => {
    if (!dirty || update.isPending) return;
    update.mutate(
      { id: note.id, expectedVersion, ...draft, title: draft.title.trim() },
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

  return (
    <EditorForm
      draft={draft}
      onChange={setDraft}
      folderId={note.folderId}
      title={note.displayTitle}
      viewHref={`/n/${note.id}`}
      onSave={() => save()}
    >
      {conflict && (
        <ActionableNotification
          kind="warning"
          lowContrast
          inline
          title="This note changed elsewhere."
          subtitle="Reload to see the latest version, or overwrite it with your changes."
          actionButtonLabel="Overwrite"
          onActionButtonClick={() => {
            setConflict(null);
            save(conflict.version);
          }}
          onClose={() => {
            setDraft(toDraft(conflict));
            setBaseVersion(conflict.version);
            setConflict(null);
          }}
          closeOnEscape={false}
          statusIconDescription="Conflict"
        />
      )}
    </EditorForm>
  );
}

interface EditorFormProps {
  draft: Draft;
  onChange: (d: Draft) => void;
  folderId: string | null;
  title: string;
  viewHref?: string;
  onSave?: () => void;
  children?: React.ReactNode;
}

function EditorForm({
  draft,
  onChange,
  folderId,
  title,
  viewHref,
  onSave,
  children,
}: EditorFormProps) {
  const navigate = useNavigate();
  const folders = useFolders() ?? [];
  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const editorApi = useRef<EditorApi>(null);
  const patch = (p: Partial<Draft>) => onChange({ ...draft, ...p });

  return (
    <Grid>
      <Column sm={4} md={8} lg={{ span: 12, offset: 0 }}>
        <Breadcrumb noTrailingSlash className="memra-breadcrumb">
          <BreadcrumbItem>
            <Link to="/">All notes</Link>
          </BreadcrumbItem>
          {folder && (
            <BreadcrumbItem>
              <Link to={`/f/${folder.id}`}>{folder.name}</Link>
            </BreadcrumbItem>
          )}
          <BreadcrumbItem isCurrentPage>{title}</BreadcrumbItem>
        </Breadcrumb>
        {children}
        <div className="memra-editor-title">
          <TextInput
            id="note-title"
            labelText="Title"
            placeholder="Untitled"
            size="lg"
            maxLength={LIMITS.titleMax}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          {viewHref && (
            <IconButton
              label="View note"
              kind="ghost"
              size="lg"
              align="bottom-end"
              onClick={() => void navigate(viewHref)}
            >
              <View />
            </IconButton>
          )}
        </div>
        <div className="memra-editor-meta">
          <FolderField
            id="note-folder"
            value={draft.folderId}
            onChange={(folderId) => patch({ folderId })}
            size="md"
          />
          <ColorField
            id="note-color"
            value={draft.color}
            onChange={(color) => patch({ color })}
            size="md"
          />
          <TagsField
            id="note-tags"
            value={draft.tagIds}
            onChange={(tagIds) => patch({ tagIds })}
            size="md"
          />
        </div>
        <Tabs>
          <TabList aria-label="Editor mode" contained>
            <Tab>Write</Tab>
            <Tab>Preview</Tab>
          </TabList>
          <TabPanels>
            <TabPanel className="memra-tab-panel">
              <div className="memra-editor-frame">
                <EditorToolbar apiRef={editorApi} />
                <Editor
                  id="note-body"
                  ariaLabel="Note body"
                  value={draft.bodyMd}
                  onChange={(bodyMd) => patch({ bodyMd })}
                  onSave={onSave}
                  maxLength={LIMITS.bodyMax}
                  apiRef={editorApi}
                  rows={EDITOR_ROWS}
                />
              </div>
            </TabPanel>
            <TabPanel className="memra-tab-panel">
              <MarkdownPreview
                markdown={draft.bodyMd || "*Nothing to preview yet.*"}
                className="memra-preview"
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Column>
    </Grid>
  );
}
