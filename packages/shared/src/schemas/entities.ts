import { z } from "zod";
import { LIMITS, NoteColor, Timestamp, Uuid } from "./common.ts";

const Synced = {
  id: Uuid,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  deletedAt: Timestamp.nullable(),
  serverSeq: z.number().int().positive(),
};

export const Folder = z.object({
  ...Synced,
  name: z.string().min(1).max(LIMITS.folderNameMax),
  sortOrder: z.number().int(),
});
export type Folder = z.infer<typeof Folder>;

export const Tag = z.object({
  ...Synced,
  name: z.string().min(1).max(LIMITS.tagNameMax),
});
export type Tag = z.infer<typeof Tag>;

export const Note = z.object({
  ...Synced,
  folderId: Uuid.nullable(),
  title: z.string().max(LIMITS.titleMax),
  displayTitle: z.string(),
  bodyMd: z.string().max(LIMITS.bodyMax),
  bodyPlain: z.string(),
  excerpt: z.string(),
  color: NoteColor,
  pinned: z.boolean(),
  tagIds: z.array(Uuid),
  version: z.number().int().positive(),
  indexedVersion: z.number().int().nonnegative(),
  sourceFilename: z.string().nullable(),
});
export type Note = z.infer<typeof Note>;

export const NoteCreate = z.object({
  folderId: Uuid.nullable().default(null),
  title: z.string().trim().max(LIMITS.titleMax).default(""),
  bodyMd: z.string().max(LIMITS.bodyMax).default(""),
  color: NoteColor.default("none"),
  pinned: z.boolean().default(false),
  tagIds: z.array(Uuid).max(50).default([]),
  sourceFilename: z.string().max(255).nullable().default(null),
});
export type NoteCreate = z.infer<typeof NoteCreate>;

export const NotePatch = z.object({
  id: Uuid,
  expectedVersion: z.number().int().positive(),
  folderId: Uuid.nullable().optional(),
  title: z.string().trim().max(LIMITS.titleMax).optional(),
  bodyMd: z.string().max(LIMITS.bodyMax).optional(),
  color: NoteColor.optional(),
  pinned: z.boolean().optional(),
  tagIds: z.array(Uuid).max(50).optional(),
});
export type NotePatch = z.infer<typeof NotePatch>;

export const FolderName = z.string().trim().min(1).max(LIMITS.folderNameMax);
export const TagName = z.string().trim().min(1).max(LIMITS.tagNameMax);
