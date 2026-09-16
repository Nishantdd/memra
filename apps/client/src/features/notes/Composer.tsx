import {
  Button,
  ButtonSet,
  ClickableTile,
  ContentSwitcher,
  InlineNotification,
  Switch,
  TextInput,
  Tile,
} from "@carbon/react";
import { Upload } from "@carbon/icons-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { LIMITS, type NoteColor } from "shared";
import { COMPOSER_ROWS } from "../../constants/index.ts";
import { useCreateNote } from "../../data/mutations.ts";
import { useUnsavedGuard } from "../../data/unsaved.ts";
import { Editor, type EditorApi } from "./editor/Editor.tsx";
import { EditorToolbar } from "./editor/EditorToolbar.tsx";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { ColorField, FolderField, TagsField } from "./NoteMetaFields.tsx";
import { UploadPreviewModal } from "./UploadPreviewModal.tsx";

const MARKDOWN_FILE = /\.(md|markdown)$/i;

interface ComposerProps {
  folderId: string | null;
  readOnly: boolean;
  onCreated?: (noteId: string) => void;
}

export function Composer({ folderId, readOnly, onCreated }: ComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<NoteColor>("none");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [targetFolder, setTargetFolder] = useState<string | null>(folderId);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const editorApi = useRef<EditorApi>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const create = useCreateNote();
  useUnsavedGuard("composer", open && (title.trim() !== "" || body.trim() !== ""));

  const acceptFile = (files: FileList | File[] | null) => {
    const file = files ? Array.from(files).find((f) => MARKDOWN_FILE.test(f.name)) : undefined;
    if (file) setUpload(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!readOnly) acceptFile(e.dataTransfer.files);
  };
  const onDragOver = (e: DragEvent) => {
    if (readOnly || !Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) return;
    e.preventDefault();
    setDragging(true);
  };

  const uploadUi = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(e) => {
          acceptFile(e.target.files);
          e.target.value = "";
        }}
      />
      <UploadPreviewModal
        file={upload}
        defaultFolderId={folderId}
        onClose={() => setUpload(null)}
        onCreated={(id) => {
          setUpload(null);
          onCreated?.(id);
        }}
      />
    </>
  );

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const openComposer = () => {
    setTargetFolder(folderId);
    setOpen(true);
  };

  const reset = () => {
    setOpen(false);
    setTitle("");
    setBody("");
    setColor("none");
    setTagIds([]);
    setMode("write");
    create.reset();
  };

  const save = () => {
    if (!title.trim() && !body.trim()) return reset();
    create.mutate(
      {
        title: title.trim(),
        bodyMd: body,
        color,
        tagIds,
        folderId: targetFolder,
        pinned: false,
        sourceFilename: null,
      },
      {
        onSuccess: (note) => {
          reset();
          onCreated?.(note.id);
        },
      },
    );
  };

  if (!open) {
    return (
      <div
        className={`memra-composer-row${dragging ? " memra-composer-row--dragging" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
      >
        <ClickableTile
          className="memra-composer memra-composer--collapsed"
          onClick={() => !readOnly && openComposer()}
          disabled={readOnly}
          aria-label="Take a note"
        >
          <span className="memra-composer__placeholder">
            {dragging ? "Drop a Markdown file to save it as a note" : "Take a note…"}
          </span>
        </ClickableTile>
        <Button
          kind="ghost"
          size="lg"
          renderIcon={Upload}
          disabled={readOnly}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload .md
        </Button>
        {uploadUi}
      </div>
    );
  }

  return (
    <Tile
      className="memra-composer memra-composer--expanded"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
    >
      {uploadUi}
      <TextInput
        ref={titleRef}
        id="composer-title"
        labelText="Title (optional)"
        hideLabel
        placeholder="Title (optional)"
        size="lg"
        maxLength={LIMITS.titleMax}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && reset()}
        className="memra-composer__title"
      />
      <div className="memra-composer__meta">
        <FolderField id="composer-folder" value={targetFolder} onChange={setTargetFolder} />
        <ColorField id="composer-color" value={color} onChange={setColor} />
        <TagsField id="composer-tags" value={tagIds} onChange={setTagIds} color={color} />
      </div>
      <ContentSwitcher
        size="sm"
        selectedIndex={mode === "write" ? 0 : 1}
        onChange={({ index }) => setMode(index === 0 ? "write" : "preview")}
        className="memra-composer__switcher"
      >
        <Switch name="write" text="Write" />
        <Switch name="preview" text="Preview" />
      </ContentSwitcher>
      {mode === "write" ? (
        <>
          <Editor
            id="composer-body"
            ariaLabel="Note"
            value={body}
            onChange={setBody}
            onSave={save}
            placeholder="Take a note in Markdown… **bold**, *italic*, - lists, `code`"
            maxLength={LIMITS.bodyMax}
            apiRef={editorApi}
            rows={COMPOSER_ROWS}
          />
          <EditorToolbar apiRef={editorApi} />
        </>
      ) : (
        <MarkdownPreview
          markdown={body || "*Nothing to preview yet*"}
          className="memra-composer__preview"
        />
      )}
      {create.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Couldn't save the note"
          subtitle="Check your connection and try again."
        />
      )}
      <ButtonSet className="memra-composer__footer">
        <Button kind="secondary" size="md" onClick={reset} disabled={create.isPending}>
          Cancel
        </Button>
        <Button kind="primary" size="md" onClick={save} disabled={create.isPending}>
          Save note
        </Button>
      </ButtonSet>
    </Tile>
  );
}
