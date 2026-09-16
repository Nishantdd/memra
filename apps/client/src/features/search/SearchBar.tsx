import { ContentSwitcher, Search, Switch } from "@carbon/react";
import { useEffect, useRef } from "react";
import type { SearchMode } from "shared";
import { useIndexStatus } from "../../data/indexStatus.ts";
import { useSearchState } from "./useSearch.ts";

const MODES: SearchMode[] = ["keyword", "semantic"];

export function SearchBar() {
  const { q, mode, setQuery, setMode } = useSearchState();
  const status = useIndexStatus();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="memra-search">
      <Search
        ref={inputRef}
        id="search"
        size="lg"
        labelText="Search notes"
        placeholder={mode === "semantic" ? "Ask your notes anything…" : "Search notes"}
        closeButtonLabelText="Clear search"
        value={q}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        autoComplete="off"
      />
      <ContentSwitcher
        size="sm"
        selectedIndex={MODES.indexOf(mode)}
        onChange={({ index }) => setMode(MODES[index ?? 0] ?? "keyword")}
        className="memra-search__mode"
      >
        <Switch name="keyword" text="Keyword" />
        <Switch name="semantic" text="Semantic" disabled={!status?.ready} />
      </ContentSwitcher>
    </div>
  );
}
