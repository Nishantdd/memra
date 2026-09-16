import type { SnippetSegment } from "shared";
import { SNIPPET_END, SNIPPET_START } from "../../constants/search.ts";

export function toSegments(marked: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let highlight = false;
  for (const piece of marked.split(new RegExp(`(${SNIPPET_START}|${SNIPPET_END})`))) {
    if (piece === SNIPPET_START) highlight = true;
    else if (piece === SNIPPET_END) highlight = false;
    else if (piece) segments.push({ text: piece, highlight });
  }
  return segments;
}

export function plainSegments(text: string): SnippetSegment[] {
  return text ? [{ text, highlight: false }] : [];
}
