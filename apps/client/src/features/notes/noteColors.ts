import type { NoteColor } from "shared";

export const COLOR_LABELS: Record<NoteColor, string> = {
  none: "No colour",
  red: "Red",
  magenta: "Magenta",
  purple: "Purple",
  blue: "Blue",
  cyan: "Cyan",
  teal: "Teal",
  green: "Green",
  gray: "Gray",
  "cool-gray": "Cool gray",
  "warm-gray": "Warm gray",
};

export const tagType = (color: NoteColor) => (color === "none" ? "gray" : color);
