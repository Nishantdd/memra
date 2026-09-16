import { z } from "zod";

export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

export const Timestamp = z.number().int().nonnegative();

export const NOTE_COLORS = [
  "none",
  "red",
  "magenta",
  "purple",
  "blue",
  "cyan",
  "teal",
  "green",
  "gray",
  "cool-gray",
  "warm-gray",
] as const;
export const NoteColor = z.enum(NOTE_COLORS);
export type NoteColor = z.infer<typeof NoteColor>;

export const LIMITS = {
  titleMax: 300,
  bodyMax: 1_048_576,
  folderNameMax: 40,
  folderCount: 20,
  tagNameMax: 50,
  passwordMin: 12,
  syncPageMax: 500,
} as const;
