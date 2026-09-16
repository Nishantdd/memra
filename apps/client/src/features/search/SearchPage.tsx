import { Column, Grid, InlineNotification, Pagination, SkeletonText } from "@carbon/react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SEARCH } from "shared";
import { useFolders } from "../../data/queries.ts";
import { ResultList } from "./ResultList.tsx";
import { ResultRow } from "./ResultRow.tsx";
import { SearchBar } from "./SearchBar.tsx";
import { minQueryLength, useSearchResults, useSearchState } from "./useSearch.ts";

export function SearchPage() {
  const { q, mode } = useSearchState();
  const [params] = useSearchParams();
  const folderId = params.get("folder");
  const folders = useFolders();
  const folder = folderId ? folders?.find((f) => f.id === folderId) : undefined;
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SEARCH.pageResults);
  const search = useSearchResults({
    q,
    mode,
    folderId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const tooShort = q.trim().length < minQueryLength(mode);

  return (
    <Grid className="memra-page">
      <Column sm={4} md={8} lg={16} className="memra-page__title-row">
        <h1 className="memra-page-title">Search{folder ? ` in ${folder.name}` : ""}</h1>
      </Column>
      <Column sm={4} md={8} lg={10} className="memra-page__composer">
        <SearchBar folderId={folderId} />
      </Column>
      <Column sm={4} md={8} lg={10}>
        {search.offline && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title="You're offline."
            subtitle="Showing keyword matches from notes stored on this device."
          />
        )}
        {tooShort && (
          <p className="memra-empty__body">
            Type at least {minQueryLength(mode)} characters to search.
          </p>
        )}
        {search.isPending && search.active && <SkeletonText paragraph lineCount={6} />}
        {search.data && search.data.results.length === 0 && (
          <p className="memra-empty__body">No matches for “{search.debouncedQ}”.</p>
        )}
        {search.data && search.data.results.length > 0 && (
          <>
            <p className="memra-search-panel__status" aria-live="polite">
              {search.data.total} {search.data.total === 1 ? "result" : "results"} ·{" "}
              {search.data.tookMs} ms
            </p>
            <ResultList
              id="search-page-results"
              label="Results"
              className="memra-search-page__list"
            >
              {search.data.results.map((r, i) => (
                <ResultRow
                  key={r.noteId}
                  id={`search-page-option-${i}`}
                  result={r}
                  index={(page - 1) * pageSize + i}
                  active={false}
                  onSelect={(res) => void navigate(`/n/${res.noteId}`)}
                  onHover={() => {}}
                />
              ))}
            </ResultList>
            <Pagination
              page={page}
              pageSize={pageSize}
              pageSizes={[10, 20, 50]}
              totalItems={search.data.total}
              onChange={({ page: p, pageSize: s }) => {
                setPage(s !== pageSize ? 1 : p);
                setPageSize(s);
              }}
            />
          </>
        )}
      </Column>
    </Grid>
  );
}
