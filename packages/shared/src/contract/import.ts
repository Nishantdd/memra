import { oc } from "@orpc/contract";
import { z } from "zod";
import { IMPORT } from "../constants/import.ts";
import { NoteColor, Uuid } from "../schemas/common.ts";

export const ParsedMarkdown = z.object({
  filename: z.string(),
  title: z.string().nullable(),
  bodyMd: z.string(),
  color: NoteColor.nullable(),
  tags: z.array(z.string()),
  folderName: z.string().nullable(),
  folderId: Uuid.nullable(),
  pinned: z.boolean(),
  warnings: z.array(z.string()),
});
export type ParsedMarkdown = z.infer<typeof ParsedMarkdown>;

export const ImportReport = z.object({
  imported: z.number().int(),
  skipped: z.number().int(),
  foldersCreated: z.array(z.string()),
  tagsCreated: z.array(z.string()),
  warnings: z.array(z.object({ file: z.string(), message: z.string() })),
});
export type ImportReport = z.infer<typeof ImportReport>;

export const importContract = {
  parse: oc
    .route({ method: "POST", path: "/import/parse" })
    .errors({ BAD_REQUEST: { data: z.object({ reason: z.string() }) } })
    .input(z.object({ file: z.file().max(IMPORT.markdownMaxBytes) }))
    .output(ParsedMarkdown),
  bulk: oc
    .route({ method: "POST", path: "/import" })
    .errors({ BAD_REQUEST: { data: z.object({ reason: z.string() }) } })
    .input(z.object({ file: z.file().max(IMPORT.zipMaxBytes) }))
    .output(ImportReport),
  export: oc
    .route({ method: "GET", path: "/export" })
    .input(z.object({ folderId: Uuid.nullable().default(null) }))
    .output(z.file()),
};
