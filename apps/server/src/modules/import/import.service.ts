import { createHash } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  IMPORT,
  LIMITS,
  type ImportReport,
  type ParsedMarkdown,
  parseMarkdownFile,
  toMarkdownFile,
} from "shared";
import { EXPORT_ZIP_NAME } from "../../constants/index.ts";
import type { Database } from "../../db/database.ts";
import { DuplicateFolderName, FolderLimitReached, FoldersRepo } from "../folders/folders.repo.ts";
import { NotesRepo } from "../notes/notes.repo.ts";
import { DuplicateTagName, TagsRepo } from "../tags/tags.repo.ts";

export class InvalidImportFile extends Error {}

const isMarkdown = (name: string) =>
  IMPORT.markdownExtensions.some((ext) => name.toLowerCase().endsWith(ext));
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "note";

export class ImportService {
  readonly #db: Database;
  readonly #notes: NotesRepo;
  readonly #folders: FoldersRepo;
  readonly #tags: TagsRepo;

  constructor(db: Database, notes: NotesRepo, folders: FoldersRepo, tags: TagsRepo) {
    this.#db = db;
    this.#notes = notes;
    this.#folders = folders;
    this.#tags = tags;
  }

  async parse(file: File): Promise<ParsedMarkdown> {
    if (!isMarkdown(file.name))
      throw new InvalidImportFile("Only .md or .markdown files are supported.");
    const parsed = parseMarkdownFile(await file.text(), file.name);
    const folder = parsed.folderName ? this.findFolder(parsed.folderName) : null;
    const warnings = [...parsed.warnings];
    if (parsed.folderName && !folder)
      warnings.push(
        `Folder "${parsed.folderName}" doesn't exist; the note will be unfiled unless you pick one.`,
      );
    return {
      filename: file.name,
      title: parsed.title,
      bodyMd: parsed.bodyMd,
      color: parsed.color,
      tags: parsed.tags,
      folderName: parsed.folderName,
      folderId: folder?.id ?? null,
      pinned: parsed.pinned,
      warnings,
    };
  }

  async bulk(file: File): Promise<ImportReport> {
    if (!file.name.toLowerCase().endsWith(".zip"))
      throw new InvalidImportFile("Upload a .zip archive of Markdown files.");
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => isMarkdown(f.name) && !f.name.includes("__MACOSX"),
      });
    } catch {
      throw new InvalidImportFile("The archive could not be read.");
    }
    const names = Object.keys(entries);
    if (names.length === 0) throw new InvalidImportFile("The archive contains no Markdown files.");
    if (names.length > IMPORT.zipMaxFiles)
      throw new InvalidImportFile(`The archive has more than ${IMPORT.zipMaxFiles} files.`);

    const report: ImportReport = {
      imported: 0,
      skipped: 0,
      foldersCreated: [],
      tagsCreated: [],
      warnings: [],
    };
    const existing = new Set(
      this.#db
        .all<{ key: string }>(
          "SELECT lower(display_title) || '|' || coalesce(folder_id, '') || '|' || body_md AS key FROM notes WHERE deleted_at IS NULL",
        )
        .map((r) => createHash("sha256").update(r.key).digest("hex")),
    );

    for (const name of names.sort()) {
      const parsed = parseMarkdownFile(strFromU8(entries[name]!), name.split("/").pop());
      for (const w of parsed.warnings) report.warnings.push({ file: name, message: w });

      const folderName = parsed.folderName ?? folderFromPath(name);
      const folderId = folderName ? this.ensureFolder(folderName, report, name) : null;
      const tagIds = parsed.tags
        .map((t) => this.ensureTag(t, report))
        .filter((id): id is string => id !== null);

      const title = parsed.title ?? "";
      const key = createHash("sha256")
        .update(`${(title || "untitled").toLowerCase()}|${folderId ?? ""}|${parsed.bodyMd}`)
        .digest("hex");
      if (existing.has(key)) {
        report.skipped++;
        continue;
      }
      existing.add(key);
      this.#notes.create({
        title: title.slice(0, LIMITS.titleMax),
        bodyMd: parsed.bodyMd.slice(0, LIMITS.bodyMax),
        folderId,
        color: parsed.color ?? "none",
        pinned: parsed.pinned,
        tagIds,
        sourceFilename: name.split("/").pop() ?? name,
      });
      report.imported++;
    }
    return report;
  }

  export(folderId: string | null): File {
    const notes = this.#db.all<{
      id: string;
      title: string;
      display_title: string;
      body_md: string;
      color: string;
      pinned: number;
      created_at: number;
      updated_at: number;
      folder_name: string | null;
      tags: string | null;
    }>(
      `SELECT n.id, n.title, n.display_title, n.body_md, n.color, n.pinned, n.created_at, n.updated_at, f.name AS folder_name,
              (SELECT group_concat(t.name, char(31)) FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = n.id) AS tags
       FROM notes n LEFT JOIN folders f ON f.id = n.folder_id
       WHERE n.deleted_at IS NULL ${folderId ? "AND n.folder_id = ?" : ""}
       ORDER BY f.name, n.updated_at DESC`,
      ...(folderId ? [folderId] : []),
    );
    const files: Record<string, Uint8Array> = {};
    for (const n of notes) {
      const md = toMarkdownFile({
        title: n.title,
        bodyMd: n.body_md,
        tags: n.tags ? n.tags.split("\u001f") : [],
        color: n.color as ParsedMarkdown["color"] & string,
        pinned: n.pinned === 1,
        folderName: n.folder_name,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      });
      const dir = n.folder_name ? `${slug(n.folder_name)}/` : "";
      files[`${dir}${slug(n.display_title)}-${n.id.slice(0, 8)}.md`] = strToU8(md);
    }
    const zipped = zipSync(files, { level: 6 });
    const stamp = new Date().toISOString().slice(0, 10);
    return new File([zipped], `${EXPORT_ZIP_NAME}-${stamp}.zip`, { type: "application/zip" });
  }

  private findFolder(name: string) {
    return this.#folders.list().find((f) => f.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  private ensureFolder(name: string, report: ImportReport, file: string): string | null {
    const trimmed = name.trim().slice(0, LIMITS.folderNameMax);
    const found = this.findFolder(trimmed);
    if (found) return found.id;
    try {
      const created = this.#folders.create(trimmed);
      report.foldersCreated.push(created.name);
      return created.id;
    } catch (e) {
      if (e instanceof FolderLimitReached)
        report.warnings.push({ file, message: `Folder limit reached; "${trimmed}" not created.` });
      else if (!(e instanceof DuplicateFolderName)) throw e;
      return this.findFolder(trimmed)?.id ?? null;
    }
  }

  private ensureTag(name: string, report: ImportReport): string | null {
    const trimmed = name.trim().slice(0, LIMITS.tagNameMax);
    if (!trimmed) return null;
    const found = this.#tags.findByName(trimmed);
    if (found) return found.id;
    try {
      const created = this.#tags.create(trimmed);
      report.tagsCreated.push(created.name);
      return created.id;
    } catch (e) {
      if (e instanceof DuplicateTagName) return e.existing.id;
      throw e;
    }
  }
}

/** `Recipes/banana.md` → "Recipes"; nested paths use the first segment only (folders are flat). */
function folderFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? (parts[0] ?? null) : null;
}
