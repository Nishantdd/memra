import { oc } from "@orpc/contract";
import { z } from "zod";
import { SEARCH, SEARCH_MODES } from "../constants/search.ts";
import { NoteColor, Uuid } from "../schemas/common.ts";

export const SearchMode = z.enum(SEARCH_MODES);
export type SearchMode = z.infer<typeof SearchMode>;

export const SnippetSegment = z.object({ text: z.string(), highlight: z.boolean() });
export type SnippetSegment = z.infer<typeof SnippetSegment>;

export const SearchResult = z.object({
  noteId: Uuid,
  displayTitle: z.string(),
  folderId: Uuid.nullable(),
  folderName: z.string().nullable(),
  color: NoteColor,
  snippet: z.array(SnippetSegment),
  relevance: z.number().int().min(0).max(100),
  matchedBy: z.array(SearchMode),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const SearchInput = z.object({
  q: z.string().trim().min(1).max(SEARCH.maxQueryLength),
  mode: SearchMode.default("keyword"),
  folderId: Uuid.nullable().default(null),
  limit: z.number().int().min(1).max(SEARCH.maxResults).default(SEARCH.panelResults),
  offset: z.number().int().min(0).default(0),
});
export type SearchInput = z.infer<typeof SearchInput>;

export const SearchOutput = z.object({
  results: z.array(SearchResult),
  total: z.number().int(),
  tookMs: z.number().int(),
  semanticAvailable: z.boolean(),
  indexedRatio: z.number().min(0).max(1),
});
export type SearchOutput = z.infer<typeof SearchOutput>;

export const searchContract = {
  query: oc.route({ method: "POST", path: "/search" }).input(SearchInput).output(SearchOutput),
};
