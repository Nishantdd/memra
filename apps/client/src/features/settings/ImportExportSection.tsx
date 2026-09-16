import { Download } from "@carbon/icons-react";
import {
  Button,
  FileUploaderDropContainer,
  InlineLoading,
  InlineNotification,
  Stack,
  UnorderedList,
  ListItem,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, orpc } from "../../data/api/orpc.ts";
import { useFolders } from "../../data/queries.ts";
import { syncNow } from "../../data/sync/engine.ts";
import { FolderField } from "../notes/NoteMetaFields.tsx";

export function ImportExportSection({ readOnly }: { readOnly: boolean }) {
  const folders = useFolders() ?? [];
  const [exportFolder, setExportFolder] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const bulk = useMutation(orpc.import.bulk.mutationOptions({ onSuccess: () => void syncNow() }));

  const runExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const file = await api.import.export({ folderId: exportFolder });
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || "memra-export.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const importError = bulk.isError
    ? isDefinedError(bulk.error) && bulk.error.code === "BAD_REQUEST"
      ? bulk.error.data.reason
      : "Import failed. Try again."
    : null;

  return (
    <Stack gap={6}>
      <section>
        <h3 className="memra-settings__heading">Import notes</h3>
        <p className="memra-settings__help">
          Upload a .zip of Markdown files. Top-level folders in the archive become note folders;
          YAML front matter (title, tags, colour, folder, pinned) is honoured. Identical notes are
          skipped.
        </p>
        <FileUploaderDropContainer
          labelText="Drag and drop a .zip here or click to upload"
          accept={[".zip", "application/zip"]}
          disabled={readOnly || bulk.isPending}
          onAddFiles={(_e, { addedFiles }) => {
            const file = addedFiles[0];
            if (file) bulk.mutate({ file });
          }}
        />
        {bulk.isPending && <InlineLoading description="Importing…" />}
        {importError && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="Couldn't import"
            subtitle={importError}
          />
        )}
        {bulk.data && (
          <InlineNotification
            kind="success"
            lowContrast
            title={`Imported ${bulk.data.imported} ${bulk.data.imported === 1 ? "note" : "notes"}`}
            subtitle={[
              bulk.data.skipped ? `${bulk.data.skipped} duplicate(s) skipped` : null,
              bulk.data.foldersCreated.length
                ? `folders created: ${bulk.data.foldersCreated.join(", ")}`
                : null,
              bulk.data.tagsCreated.length
                ? `tags created: ${bulk.data.tagsCreated.join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            onClose={() => bulk.reset()}
          />
        )}
        {bulk.data && bulk.data.warnings.length > 0 && (
          <UnorderedList className="memra-settings__warnings">
            {bulk.data.warnings.slice(0, 20).map((w, i) => (
              <ListItem key={i}>
                <strong>{w.file}</strong>: {w.message}
              </ListItem>
            ))}
          </UnorderedList>
        )}
      </section>

      <section>
        <h3 className="memra-settings__heading">Export notes</h3>
        <p className="memra-settings__help">
          Download your notes as Markdown files with front matter, grouped by folder.
        </p>
        <div className="memra-settings__row">
          {folders.length > 0 && (
            <FolderField
              id="export-folder"
              value={exportFolder}
              onChange={setExportFolder}
              size="md"
            />
          )}
          <Button
            kind="tertiary"
            renderIcon={Download}
            onClick={() => void runExport()}
            disabled={exporting || readOnly}
          >
            {exporting ? "Preparing…" : "Export .zip"}
          </Button>
        </div>
        {exportError && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={exportError} />
        )}
      </section>
    </Stack>
  );
}
