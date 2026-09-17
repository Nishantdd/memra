import { OperationalTag, Popover, PopoverContent, Tag } from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import type { NoteColor, Tag as TagEntity } from "shared";
import { tagType } from "./noteColors.ts";

interface NoteTagsProps {
  tags: TagEntity[];
  color: NoteColor;
}

const MORE = "\u2026";

/** Single-line tag row; tags that don't fit collapse behind a "…" toggletip. */
export function NoteTags({ tags, color }: NoteTagsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(tags.length);
  const [open, setOpen] = useState(false);
  const type = tagType(color);

  useEffect(() => {
    const row = rowRef.current;
    const probe = measureRef.current;
    if (!row || !probe) return;
    const observer = new ResizeObserver(() => {
      const [more, ...items] = Array.from(probe.children) as HTMLElement[];
      const gap = parseFloat(getComputedStyle(probe).columnGap) || 0;
      const available = row.clientWidth;
      const widths = items.map((el) => el.offsetWidth);
      const total = widths.reduce((sum, w, i) => sum + w + (i ? gap : 0), 0);
      if (total <= available) return setVisible(items.length);
      let used = more!.offsetWidth;
      let fit = 0;
      for (const w of widths) {
        if (used + gap + w > available) break;
        used += gap + w;
        fit++;
      }
      setVisible(fit);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [tags]);

  if (tags.length === 0) return null;
  const hidden = tags.slice(visible);

  return (
    <div className="memra-note__tags" ref={rowRef}>
      <div className="memra-note__tags-probe" ref={measureRef} aria-hidden>
        <Tag type={type} size="sm">
          {MORE}
        </Tag>
        {tags.map((t) => (
          <Tag key={t.id} type={type} size="sm">
            {t.name}
          </Tag>
        ))}
      </div>
      {tags.slice(0, visible).map((t) => (
        <Tag key={t.id} type={type} size="sm">
          {t.name}
        </Tag>
      ))}
      {hidden.length > 0 && (
        <Popover open={open} align="bottom-left" onRequestClose={() => setOpen(false)}>
          <OperationalTag
            type={type}
            size="sm"
            text={MORE}
            aria-label={`Show ${hidden.length} more tags`}
            onClick={() => setOpen((o) => !o)}
          />
          <PopoverContent className="memra-note__tags-all">
            {hidden.map((t) => (
              <Tag key={t.id} type={type} size="sm">
                {t.name}
              </Tag>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
