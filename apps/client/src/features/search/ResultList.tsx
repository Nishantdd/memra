import type { ReactNode } from "react";

interface ResultListProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}

/** Carbon ContainedList markup with a listbox role so the search input can own it as a combobox popup. */
export function ResultList({ id, label, className, children }: ResultListProps) {
  const labelId = `${id}-label`;
  return (
    <div
      className={`cds--contained-list cds--contained-list--on-page cds--contained-list--lg cds--layout--size-lg${className ? ` ${className}` : ""}`}
    >
      <div className="cds--contained-list__header">
        <div id={labelId} className="cds--contained-list__label">
          {label}
        </div>
      </div>
      <ul id={id} role="listbox" aria-labelledby={labelId}>
        {children}
      </ul>
    </div>
  );
}
