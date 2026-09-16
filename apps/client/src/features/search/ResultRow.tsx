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
      <div className="memra-result__main">
        <Tag type="outline" size="sm" className="memra-result__index">
          {index + 1}
        </Tag>
        <div className="memra-result__text">
          <div className="memra-result__title">
            {result.displayTitle}
            {result.color !== "none" && (
              <span
                className={`memra-result__dot cds--tag--${tagType(result.color)}`}
                aria-hidden
              />
            )}
          </div>
          <div className="memra-result__snippet">
            {result.snippet.map((seg, i) =>
              seg.highlight ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
            )}
          </div>
          {result.folderName && <div className="memra-result__folder">{result.folderName}</div>}
        </div>
      </div>
      <div className="memra-result__relevance" title={`Relevance ${result.relevance}%`}>
        <meter
          className="memra-result__meter"
          min={0}
          max={100}
          value={result.relevance}
          aria-label="Relevance"
        />
        <span className="memra-result__pct">{result.relevance}%</span>
      </div>
    </ContainedListItem>
  );
}
