import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SEARCH, type SearchMode } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import { useDebounced } from "../../lib/useDebounced.ts";

export function minQueryLength(mode: SearchMode): number {
  return mode === "semantic" ? SEARCH.minQuerySemantic : SEARCH.minQueryKeyword;
}

interface UseSearchResultsOptions {
  q: string;
  mode: SearchMode;
  folderId: string | null;
  limit: number;
  offset?: number;
  enabled?: boolean;
}

export function useSearchResults({
  q,
  mode,
  folderId,
  limit,
  offset = 0,
  enabled = true,
}: UseSearchResultsOptions) {
  const debounceMs = mode === "semantic" ? SEARCH.debounceSemanticMs : SEARCH.debounceKeywordMs;
  const debouncedQ = useDebounced(q.trim(), debounceMs);
  const active = enabled && debouncedQ.length >= minQueryLength(mode);

  const query = useQuery(
    orpc.search.query.queryOptions({
      input: { q: debouncedQ, mode, folderId, limit, offset },
      enabled: active,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    }),
  );

  return { ...query, active, debouncedQ };
}
