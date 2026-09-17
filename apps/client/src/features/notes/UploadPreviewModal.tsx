import {
  Button,
  Column,
  ComposedModal,
  Grid,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tag,
  TextArea,
  TextInput,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LIMITS, type NoteColor, type ParsedMarkdown } from "shared";
import { UPLOAD_ROWS } from "../../constants/index.ts";
import { orpc } from "../../data/api/orpc.ts";
import { useCreateNote } from "../../data/mutations.ts";
import { useTags } from "../../data/queries.ts";
import { ColorField, FolderField, TagsField } from "./NoteMetaFields.tsx";

interface UploadPreviewModalProps {
  file: File | null;
  defaultFolderId: string | null;
  onClose: () => void;
  onCreated: (noteId: string) => void;
}

interface Draft {
  title: string;
  bodyMd: string;
  folderId: string | null;
  color: NoteColor;
  tagIds: string[];
}

export function UploadPreviewModal({
  file,
  defaultFolderId,
  onClose,
  onCreated,
}: UploadPreviewModalProps) {
  return file ? (
    <UploadPreview
      key={`${file.name}-${file.lastModified}`}
      file={file}
      defaultFolderId={defaultFolderId}
      onClose={onClose}
      onCreated={onCreated}
    />
  ) : null;
}

function UploadPreview({
  file,
  defaultFolderId,
  onClose,
  onCreated,
}: UploadPreviewModalProps & { file: File }) {
  const parse = useMutation(orpc.import.parse.mutationOptions());
  const create = useCreateNote();
  const tags = useTags();
  const [overrides, setOverrides] = useState<Partial<Draft>>({});
  const { mutate } = parse;

  useEffect(() => mutate({ file }), [mutate, file]);

  const parsed: ParsedMarkdown | undefined = parse.data;
  const knownTags = useMemo(
    () =>
      parsed && tags
        ? tags.filter((t) => parsed.tags.some((n) => n.toLowerCase() === t.name.toLowerCase()))
        : [],
    [parsed, tags],
  );
  const pendingTags = parsed
    ? parsed.tags.filter((n) => !knownTags.some((t) => t.name.toLowerCase() === n.toLowerCase()))
    : [];
  const draft: Draft = {
    title: overrides.title ?? parsed?.title ?? "",
    bodyMd: overrides.bodyMd ?? parsed?.bodyMd ?? "",
    folderId:
      overrides.folderId !== undefined ? overrides.folderId : (parsed?.folderId ?? defaultFolderId),
    color: overrides.color ?? parsed?.color ?? "none",
    tagIds: overrides.tagIds ?? knownTags.map((t) => t.id),
  };
  const patch = (p: Partial<Draft>) => setOverrides((o) => ({ ...o, ...p }));

  const parseError = parse.isError
    ? isDefinedError(parse.error) && parse.error.code === "BAD_REQUEST"
      ? parse.error.data.reason
      : "The file could not be read."
    : null;

  const save = () => {
    if (!parsed) return;
    create.mutate(
      {
        title: draft.title.trim(),
        bodyMd: draft.bodyMd,
        folderId: draft.folderId,
        color: draft.color,
        pinned: parsed.pinned,
        tagIds: draft.tagIds,
        sourceFilename: parsed.filename,
      },
      { onSuccess: (note) => onCreated(note.id) },
    );
  };

  return (
    <ComposedModal
      open
      size="lg"
      onClose={onClose}
      preventCloseOnClickOutside
      selectorPrimaryFocus="#upload-title"
    >
      <ModalHeader title="Save file as note" label={file.name} />
      <ModalBody hasForm>
        {parseError && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="Couldn't use this file"
            subtitle={parseError}
          />
        )}
        {parsed && (
          <Grid className="memra-upload">
            <Column sm={4} md={4} lg={8} className="memra-upload__content">
              <TextArea
                id="upload-body"
                labelText="Content"
                rows={UPLOAD_ROWS}
                maxCount={LIMITS.bodyMax}
                value={draft.bodyMd}
                onChange={(e) => patch({ bodyMd: e.target.value })}
              />
            </Column>
            <Column sm={4} md={4} lg={8} className="memra-upload__fields">
              {parsed.warnings.map((w) => (
                <InlineNotification
                  key={w}
                  kind="warning"
                  lowContrast
                  hideCloseButton
                  title={w}
                  className="memra-upload__warning"
                />
              ))}
              <TextInput
                id="upload-title"
                labelText="Title (optional)"
                value={draft.title}
                maxLength={LIMITS.titleMax}
                onChange={(e) => patch({ title: e.target.value })}
              />
              <FolderField
                id="upload-folder"
                value={draft.folderId}
                onChange={(folderId) => patch({ folderId })}
                size="md"
              />
              <ColorField
                id="upload-color"
                value={draft.color}
                onChange={(color) => patch({ color })}
                size="md"
              />
              <TagsField
                id="upload-tags"
                value={draft.tagIds}
                onChange={(tagIds) => patch({ tagIds })}
                size="md"
              />
              {pendingTags.length > 0 && (
                <p className="memra-upload__pending">
                  Tags from the file that don't exist yet:{" "}
                  {pendingTags.map((t) => (
                    <Tag key={t} type="outline" size="sm">
                      {t}
                    </Tag>
                  ))}{" "}
                  — add them above to keep them.
                </p>
              )}
            </Column>
          </Grid>
        )}
        {create.isError && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="Couldn't save the note"
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button kind="primary" onClick={save} disabled={!parsed || create.isPending}>
          Save note
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
