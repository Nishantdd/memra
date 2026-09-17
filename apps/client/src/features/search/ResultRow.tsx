import { ContainedListItem, Tag } from "@carbon/react";
import type { SearchResult } from "shared";
import { tagType } from "../notes/noteColors.ts";

interface ResultRowProps {
  result: SearchResult;
  index: number;
  active: boolean;
  id: string;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

export function ResultRow({ result, index, active, id, onSelect, onHover }: ResultRowProps) {
  const optionAttrs: Record<string, unknown> = {
    id,
    role: "option",
    "aria-selected": active,
    onMouseEnter: () => onHover(index),
  };
  return (
    <ContainedListItem
      className={`memra-result${active ? " memra-result--active" : ""}`}
      onClick={() => onSelect(result)}
      {...optionAttrs}
    >
      <div className="memra-result__title">{result.displayTitle}</div>
      <div className="memra-result__snippet">
        {result.snippet.map((seg, i) =>
          seg.highlight ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
        )}
      </div>
      <div className="memra-result__meta">
        {result.folderName && (
          <Tag type={tagType(result.color)} size="sm">
            {result.folderName}
          </Tag>
        )}
        <span>{result.relevance}% match</span>
      </div>
    </ContainedListItem>
  );
}
