import { InlineLoading, InlineNotification, Layer, Link } from "@carbon/react";
import type { SearchMode, SearchOutput, SearchResult } from "shared";
import { useCallback, useMemo } from "react";
import { Link as RouterLink } from "react-router";
import { AiAnswer } from "./AiAnswer.tsx";
import { resultOptionId } from "./resultIds.ts";
import { useAsk } from "./useAsk.ts";
import { ResultList } from "./ResultList.tsx";
import { ResultRow } from "./ResultRow.tsx";

interface SearchResultsPanelProps {
  id: string;
  listboxId: string;
  data: SearchOutput | undefined;
  isFetching: boolean;
  isError: boolean;
  q: string;
  mode: SearchMode;
  folderId: string | null;
  activeIndex: number;
  onActiveIndex: (index: number) => void;
  onSelect: (result: SearchResult) => void;
  onSwitchMode: (mode: SearchMode) => void;
}

export function SearchResultsPanel({
  id,
  listboxId,
  data,
  isFetching,
  isError,
  q,
  mode,
  folderId,
  activeIndex,
  onActiveIndex,
  onSelect,
  onSwitchMode,
}: SearchResultsPanelProps) {
  const results = useMemo(() => data?.results ?? [], [data]);
  const showAll = new URLSearchParams({ q, mode, ...(folderId ? { folder: folderId } : {}) });
  const askEnabled = mode === "semantic" && !!data?.semanticAvailable && results.length > 0;
  const ask = useAsk(q, folderId, askEnabled);

  const onCitation = useCallback(
    (n: number) => {
      const source = ask.sources.find((s) => s.n === n);
      const index = source ? results.findIndex((r) => r.noteId === source.noteId) : -1;
      if (index >= 0) {
        onActiveIndex(index);
        document
          .getElementById(resultOptionId(listboxId, index))
          ?.scrollIntoView({ block: "nearest" });
      } else if (source) {
        onSelect({ ...results[0]!, noteId: source.noteId });
      }
    },
    [ask.sources, results, onActiveIndex, onSelect, listboxId],
  );

  return (
    <Layer level={1}>
      <div id={id} className="memra-search-panel">
        {askEnabled && <AiAnswer {...ask} onStop={ask.stop} onCitation={onCitation} />}
        {isError && (
          <p className="memra-search-panel__note">
            Search failed. Check your connection and try again.
          </p>
        )}
        {mode === "semantic" && data && (!data.semanticAvailable || data.indexedRatio < 1) && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            className="memra-search-panel__notice"
            title={
              data.semanticAvailable
                ? "Some notes are still being indexed."
                : "Semantic search is warming up."
            }
            subtitle={
              data.semanticAvailable
                ? "Semantic results may be incomplete."
                : "Showing keyword results for now."
            }
          />
        )}
        {!isError && data && results.length === 0 && (
          <div className="memra-search-panel__empty">
            <p className="memra-search-panel__empty-title">No matches for “{q}”</p>
            {mode === "keyword" ? (
              <p className="memra-search-panel__note">
                Try fewer words, or{" "}
                <Link as="button" type="button" onClick={() => onSwitchMode("semantic")}>
                  switch to Semantic mode
                </Link>{" "}
                for concept-based results.
              </p>
            ) : (
              <p className="memra-search-panel__note">
                Try different wording or Keyword mode for exact terms.
              </p>
            )}
          </div>
        )}
        {results.length > 0 && (
          <ResultList id={listboxId} label="Results" className="memra-search-panel__list">
            {results.map((r, i) => (
              <ResultRow
                key={r.noteId}
                id={resultOptionId(listboxId, i)}
                result={r}
                index={i}
                active={i === activeIndex}
                onSelect={onSelect}
                onHover={onActiveIndex}
              />
            ))}
          </ResultList>
        )}
        <div className="memra-search-panel__foot">
          <span className="memra-search-panel__status" aria-live="polite">
            {isFetching ? (
              <InlineLoading description="Searching…" />
            ) : data ? (
              `${data.total} ${data.total === 1 ? "result" : "results"} · ${data.tookMs} ms`
            ) : null}
          </span>
          {data && data.total > results.length && (
            <Link as={RouterLink} to={`/search?${showAll.toString()}`}>
              Show all results
            </Link>
          )}
        </div>
      </div>
    </Layer>
  );
}
