import { Button, ButtonSet, ClickableTile, ContentSwitcher, InlineNotification, Switch, TextInput, Tile } from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { LIMITS, type NoteColor } from "shared";
import { useCreateNote } from "../../data/mutations.ts";
import { Editor, type EditorApi } from "./editor/Editor.tsx";
import { EditorToolbar } from "./editor/EditorToolbar.tsx";
import { MarkdownPreview } from "./MarkdownPreview.tsx";
import { ColorField, FolderField, TagsField } from "./NoteMetaFields.tsx";

interface ComposerProps {
  folderId: string | null;
  readOnly: boolean;
  onCreated?(noteId: string): void;
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
  const create = useCreateNote();

  useEffect(() => {
    if (!open) setTargetFolder(folderId);
  }, [folderId, open]);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

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
      { title: title.trim(), bodyMd: body, color, tagIds, folderId: targetFolder, pinned: false, sourceFilename: null },
      { onSuccess: (note) => { reset(); onCreated?.(note.id); } },
    );
  };

  if (!open) {
    return (
      <ClickableTile
        className="memra-composer memra-composer--collapsed"
        onClick={() => !readOnly && setOpen(true)}
        disabled={readOnly}
        aria-label="Take a note"
      >
        <span className="memra-composer__placeholder">Take a note…</span>
      </ClickableTile>
    );
  }

  return (
    <Tile className="memra-composer memra-composer--expanded">
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
      <ContentSwitcher size="sm" selectedIndex={mode === "write" ? 0 : 1} onChange={({ index }) => setMode(index === 0 ? "write" : "preview")} className="memra-composer__switcher">
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
            rows={6}
          />
          <EditorToolbar apiRef={editorApi} />
        </>
      ) : (
        <MarkdownPreview markdown={body || "*Nothing to preview yet*"} className="memra-composer__preview" />
      )}
      {create.isError && (
        <InlineNotification kind="error" lowContrast hideCloseButton title="Couldn't save the note" subtitle="Check your connection and try again." />
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
