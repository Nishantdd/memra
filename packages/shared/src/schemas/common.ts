import { z } from "zod";
import { NOTE_COLORS } from "../constants/colors.ts";

export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

export const Timestamp = z.number().int().nonnegative();

export const NoteColor = z.enum(NOTE_COLORS);
export type NoteColor = z.infer<typeof NoteColor>;
