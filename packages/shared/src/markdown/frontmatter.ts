import matter from "gray-matter";
import { z } from "zod";
import { NOTE_COLORS, type NoteColor } from "../schemas/common.ts";
import { firstHeading, normalizeText, parseMarkdown } from "./parse.ts";

const FrontMatter = z.object({
  title: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  color: z.string().optional(),
  pinned: z.boolean().optional(),
  folder: z.string().optional(),
  created: z.union([z.string(), z.date()]).optional(),
  updated: z.union([z.string(), z.date()]).optional(),
});

export interface ParsedMarkdownFile {
  title: string | null;
  bodyMd: string;
  color: NoteColor | null;
  tags: string[];
  folderName: string | null;
  pinned: boolean;
  createdAt: number | null;
  updatedAt: number | null;
  warnings: string[];
}

function toEpoch(value: string | Date | undefined): number | null {
  if (value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function parseMarkdownFile(raw: string, filename?: string): ParsedMarkdownFile {
  const warnings: string[] = [];
  let data: Record<string, unknown> = {};
  let content = raw;
  try {
    const parsed = matter(raw);
    data = parsed.data;
    content = parsed.content;
  } catch {
    warnings.push("Front matter could not be parsed and was ignored.");
  }

  const fm = FrontMatter.safeParse(data);
  const meta = fm.success ? fm.data : {};
  if (!fm.success) warnings.push("Front matter has invalid fields; they were ignored.");
  const known = new Set(Object.keys(FrontMatter.shape));
  for (const key of Object.keys(data)) {
    if (!known.has(key)) warnings.push(`Unknown front matter key "${key}" ignored.`);
  }

  let color: NoteColor | null = null;
  if (meta.color !== undefined) {
    const normalized = meta.color.toLowerCase();
    if ((NOTE_COLORS as readonly string[]).includes(normalized)) color = normalized as NoteColor;
    else warnings.push(`Colour "${meta.color}" is not a Carbon colour; it was dropped.`);
  }

  const tags = (Array.isArray(meta.tags) ? meta.tags : (meta.tags?.split(",") ?? []))
    .map((t) => normalizeText(t))
    .filter(Boolean);

  const bodyMd = content.replace(/^\s*\n/, "").trimEnd();
  const title =
    (meta.title && normalizeText(meta.title)) ||
    firstHeading(parseMarkdown(bodyMd)) ||
    (filename ? normalizeText(filename.replace(/\.(md|markdown)$/i, "")) : null) ||
    null;

  return {
    title,
    bodyMd,
    color,
    tags,
    folderName: meta.folder ? normalizeText(meta.folder) : null,
    pinned: meta.pinned ?? false,
    createdAt: toEpoch(meta.created),
    updatedAt: toEpoch(meta.updated),
    warnings,
  };
}

export interface ExportableNote {
  title: string;
  bodyMd: string;
  tags: string[];
  color: NoteColor;
  pinned: boolean;
  folderName: string | null;
  createdAt: number;
  updatedAt: number;
}

export function toMarkdownFile(note: ExportableNote): string {
  const data: Record<string, unknown> = {
    tags: note.tags,
    pinned: note.pinned,
    created: new Date(note.createdAt).toISOString(),
    updated: new Date(note.updatedAt).toISOString(),
  };
  if (note.title) data.title = note.title;
  if (note.color !== "none") data.color = note.color;
  if (note.folderName) data.folder = note.folderName;
  return matter.stringify(`${note.bodyMd}\n`, data);
}
