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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, orpc } from "../../data/api/orpc.ts";
import { noteKeys, useFolders } from "../../data/queries.ts";
import { FolderField } from "../notes/NoteMetaFields.tsx";

export function DataSettings() {
  const qc = useQueryClient();
  const folders = useFolders() ?? [];
  const status = useQuery(orpc.status.queryOptions({ staleTime: 60_000 }));
  const [exportFolder, setExportFolder] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const bulk = useMutation(
    orpc.import.bulk.mutationOptions({
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: noteKeys.all() });
        void qc.invalidateQueries({ queryKey: noteKeys.folders() });
        void qc.invalidateQueries({ queryKey: noteKeys.tags() });
      },
    }),
  );

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
    <Stack gap={8}>
      <Stack gap={5} className="memra-form">
        <h3 className="memra-section__heading">Import</h3>
        <p>
          A .zip of Markdown files. Top-level folders in the archive become note folders; front
          matter is honoured; duplicates are skipped.
        </p>
        <FileUploaderDropContainer
          labelText="Drag and drop a .zip here or click to upload"
          accept={[".zip", "application/zip"]}
          disabled={bulk.isPending}
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
            ]
              .filter(Boolean)
              .join(" · ")}
            onClose={() => bulk.reset()}
          />
        )}
        {bulk.data && bulk.data.warnings.length > 0 && (
          <UnorderedList>
            {bulk.data.warnings.slice(0, 20).map((w, i) => (
              <ListItem key={i}>
                {w.file}: {w.message}
              </ListItem>
            ))}
          </UnorderedList>
        )}
      </Stack>

      <Stack gap={5} className="memra-form">
        <h3 className="memra-section__heading">Export</h3>
        {folders.length > 0 && (
          <FolderField
            id="export-folder"
            value={exportFolder}
            onChange={setExportFolder}
            size="md"
          />
        )}
        <div className="memra-form__actions">
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Download}
            onClick={() => void runExport()}
            disabled={exporting}
          >
            {exporting ? "Preparing…" : "Export .zip"}
          </Button>
        </div>
        {exportError && (
          <InlineNotification kind="error" lowContrast hideCloseButton title={exportError} />
        )}
      </Stack>

      <Stack gap={3} className="memra-form">
        <h3 className="memra-section__heading">About</h3>
        <p>Memra {status.data?.version ?? ""}</p>
      </Stack>
    </Stack>
  );
}
