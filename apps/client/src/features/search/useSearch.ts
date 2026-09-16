import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { SEARCH, type SearchMode } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import { searchOffline } from "../../data/search/offlineIndex.ts";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { useDebounced } from "../../lib/useDebounced.ts";

const isMode = (v: string | null): v is SearchMode => v === "keyword" || v === "semantic";

export function useSearchState() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const rawMode = params.get("mode");
  const mode: SearchMode = isMode(rawMode) ? rawMode : "keyword";

  const update = useCallback(
    (patch: { q?: string; mode?: SearchMode }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.q !== undefined) {
            if (patch.q) next.set("q", patch.q);
            else next.delete("q");
          }
          if (patch.mode !== undefined) next.set("mode", patch.mode);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    q,
    mode,
    setQuery: (q: string) => update({ q }),
    setMode: (mode: SearchMode) => update({ mode }),
  };
}

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
  const { connectivity } = useConnectivity();
  const debounceMs = mode === "semantic" ? SEARCH.debounceSemanticMs : SEARCH.debounceKeywordMs;
  const debouncedQ = useDebounced(q.trim(), debounceMs);
  const offline = connectivity === "offline";
  const longEnough = debouncedQ.length >= minQueryLength(offline ? "keyword" : mode);
  const active = enabled && longEnough;

  const online = useQuery(
    orpc.search.query.queryOptions({
      input: { q: debouncedQ, mode, folderId, limit, offset },
      enabled: active && !offline,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    }),
  );
  const local = useQuery({
    queryKey: ["offline-search", debouncedQ, folderId, limit, offset],
    queryFn: () => searchOffline(debouncedQ, folderId, limit, offset),
    enabled: active && offline,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const query = offline ? local : online;
  return {
    ...query,
    active,
    debouncedQ,
    offline,
    effectiveMode: offline ? ("keyword" as SearchMode) : mode,
  };
}
