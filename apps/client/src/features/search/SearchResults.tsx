import { Button, InlineLoading, SkeletonText } from "@carbon/react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { SEARCH, type SearchMode } from "shared";
import { useIndexStatus } from "../../data/indexStatus.ts";
import { AiAnswer } from "./AiAnswer.tsx";
import { resultOptionId } from "./resultIds.ts";
import { ResultList } from "./ResultList.tsx";
import { ResultRow } from "./ResultRow.tsx";
import { useAsk } from "./useAsk.ts";
import { minQueryLength, useSearchResults } from "./useSearch.ts";

interface SearchResultsProps {
  q: string;
  mode: SearchMode;
  folderId: string | null;
  onNavigate?: () => void;
}

const LIST_ID = "search-results";

export function SearchResults({ q, mode, folderId, onNavigate }: SearchResultsProps) {
  const navigate = useNavigate();
  const open = useCallback(
    (noteId: string) => {
      void navigate(`/n/${noteId}`);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );
  const [limit, setLimit] = useState<number>(SEARCH.pageResults);
  const [activeIndex, setActiveIndex] = useState(-1);
  const search = useSearchResults({ q, mode, folderId, limit });
  const status = useIndexStatus();
  const results = useMemo(() => search.data?.results ?? [], [search.data]);
  const askEnabled = mode === "semantic" && !!status?.ready && results.length > 0;
  const ask = useAsk(search.debouncedQ, folderId, askEnabled);

  const onCitation = useCallback(
    (n: number) => {
      const source = ask.sources.find((s) => s.n === n);
      const index = source ? results.findIndex((r) => r.noteId === source.noteId) : -1;
      if (index >= 0) {
        setActiveIndex(index);
        document
          .getElementById(resultOptionId(LIST_ID, index))
          ?.scrollIntoView({ block: "nearest" });
      } else if (source) {
        open(source.noteId);
      }
    },
    [ask.sources, results, open],
  );

  if (q.trim().length < minQueryLength(mode)) {
    return (
      <p className="memra-empty">Type at least {minQueryLength(mode)} characters to search.</p>
    );
  }
  if (search.isPending) return <SkeletonText paragraph lineCount={4} />;
  if (search.isError) return <p className="memra-empty">Search failed. Try again.</p>;

  return (
    <div className="memra-section">
      {askEnabled && <AiAnswer {...ask} onStop={ask.stop} onCitation={onCitation} />}
      {results.length === 0 ? (
        <p className="memra-empty">No matches for “{search.debouncedQ}”.</p>
      ) : (
        <ResultList
          id={LIST_ID}
          label={`${search.data!.total} ${search.data!.total === 1 ? "result" : "results"}`}
        >
          {results.map((r, i) => (
            <ResultRow
              key={r.noteId}
              id={resultOptionId(LIST_ID, i)}
              result={r}
              index={i}
              active={i === activeIndex}
              onSelect={(res) => open(res.noteId)}
              onHover={setActiveIndex}
            />
          ))}
        </ResultList>
      )}
      {search.data && search.data.total > results.length && (
        <Button
          kind="ghost"
          size="md"
          onClick={() => setLimit((l) => Math.min(l + SEARCH.pageResults, SEARCH.maxResults))}
        >
          Show more
        </Button>
      )}
      {search.isFetching && !search.isPending && <InlineLoading description="Updating…" />}
    </div>
  );
}
