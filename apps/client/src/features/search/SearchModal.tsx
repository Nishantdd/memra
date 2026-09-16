import { Button, ComposedModal, ModalBody, ModalHeader, Search } from "@carbon/react";
import { useState } from "react";
import type { SearchMode } from "shared";
import { useIndexStatus } from "../../data/indexStatus.ts";
import { SearchResults } from "./SearchResults.tsx";

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
          <div className="memra-search-row__mode" role="group" aria-label="Search mode">
            <Button
              size="lg"
              kind={mode === "keyword" ? "primary" : "tertiary"}
              aria-pressed={mode === "keyword"}
              onClick={() => setMode("keyword")}
            >
              Keyword
            </Button>
            <Button
              size="lg"
              kind={mode === "semantic" ? "primary" : "tertiary"}
              aria-pressed={mode === "semantic"}
              disabled={!status?.ready}
              onClick={() => setMode("semantic")}
            >
              Semantic
            </Button>
          </div>
        </div>
        {q.trim() && <SearchResults q={q} mode={mode} folderId={folderId} onNavigate={onClose} />}
      </ModalBody>
    </ComposedModal>
  );
}
