import {
  ComposedModal,
  ContentSwitcher,
  ModalBody,
  ModalHeader,
  Search,
  Switch,
} from "@carbon/react";
import { useState } from "react";
import type { SearchMode } from "shared";
import { useIndexStatus } from "../../data/indexStatus.ts";
import { SearchResults } from "./SearchResults.tsx";

const MODES: SearchMode[] = ["keyword", "semantic"];

interface SearchModalProps {
  open: boolean;
  folderId: string | null;
  onClose: () => void;
}

export function SearchModal({ open, folderId, onClose }: SearchModalProps) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("keyword");
  const status = useIndexStatus();

  return (
    <ComposedModal open={open} onClose={onClose} size="lg" selectorPrimaryFocus="#search-input">
      <ModalHeader label={folderId ? "This folder" : "All notes"} title="Search" />
      <ModalBody hasScrollingContent>
        <div className="memra-search-row">
          <Search
            id="search-input"
            size="lg"
            labelText="Search notes"
            placeholder={mode === "semantic" ? "Ask your notes anything…" : "Search notes"}
            closeButtonLabelText="Clear search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ("")}
            autoComplete="off"
          />
          <ContentSwitcher
            size="lg"
            selectedIndex={MODES.indexOf(mode)}
            onChange={({ index }) => setMode(MODES[index ?? 0] ?? "keyword")}
            className="memra-search-row__mode"
          >
            <Switch name="keyword" text="Keyword" />
            <Switch name="semantic" text="Semantic" disabled={!status?.ready} />
          </ContentSwitcher>
        </div>
        {q.trim() && <SearchResults q={q} mode={mode} folderId={folderId} onNavigate={onClose} />}
      </ModalBody>
    </ComposedModal>
  );
}
