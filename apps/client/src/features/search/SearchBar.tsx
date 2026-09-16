import { ContentSwitcher, Search, Switch } from "@carbon/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { SEARCH, type SearchMode, type SearchResult } from "shared";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { resultOptionId } from "./resultIds.ts";
import { SearchResultsPanel } from "./SearchResultsPanel.tsx";
import { minQueryLength, useSearchResults, useSearchState } from "./useSearch.ts";

const MODES: SearchMode[] = ["keyword", "semantic"];

export function SearchBar({ folderId }: { folderId: string | null }) {
  const { q, mode, setQuery, setMode } = useSearchState();
  const { connectivity } = useConnectivity();
  const offline = connectivity === "offline";
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [activeState, setActiveState] = useState<{ key: string; index: number }>({
    key: "",
    index: -1,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const listboxId = `${uid}-listbox`;

  const search = useSearchResults({
    q,
    mode,
    folderId,
    limit: SEARCH.panelResults,
    enabled: focused,
  });
  const results = search.data?.results ?? [];
  const open = focused && !offline && q.trim().length >= minQueryLength(mode);
  const resultsKey = `${mode}:${search.debouncedQ}`;
  const activeIndex = activeState.key === resultsKey ? activeState.index : -1;
  const setActiveIndex = (next: number | ((i: number) => number)) =>
    setActiveState({
      key: resultsKey,
      index: typeof next === "function" ? next(activeIndex) : next,
    });

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const select = (result: SearchResult) => {
    setFocused(false);
    void navigate(`/n/${result.noteId}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    } else if (open && e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (open && e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (open && target) select(target);
    }
  };

  return (
    <div ref={rootRef} className="memra-search">
      <div className="memra-search__row">
        <Search
          ref={inputRef}
          id={`${uid}-input`}
          size="lg"
          labelText="Search notes"
          placeholder={offline ? "Search is unavailable offline" : "Ask your notes anything…"}
          closeButtonLabelText="Clear search"
          value={q}
          disabled={offline}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? resultOptionId(listboxId, activeIndex) : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
        />
        <ContentSwitcher
          size="lg"
          selectedIndex={MODES.indexOf(mode)}
          onChange={({ index }) => setMode(MODES[index ?? 0] ?? "keyword")}
          className="memra-search__mode"
        >
          <Switch name="keyword" text="Keyword" disabled={offline} />
          <Switch
            name="semantic"
            text="Semantic"
            disabled={offline || search.data?.semanticAvailable === false}
          />
        </ContentSwitcher>
      </div>
      {open && (
        <SearchResultsPanel
          id={panelId}
          listboxId={listboxId}
          data={search.data}
          isFetching={search.isFetching}
          isError={search.isError}
          q={search.debouncedQ}
          mode={mode}
          folderId={folderId}
          activeIndex={activeIndex}
          onActiveIndex={setActiveIndex}
          onSelect={select}
          onSwitchMode={setMode}
        />
      )}
    </div>
  );
}
