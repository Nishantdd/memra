import { TextArea } from "@carbon/react";
import { type KeyboardEvent, type Ref, useImperativeHandle, useRef } from "react";

export interface EditorApi {
  wrapSelection: (before: string, after: string) => void;
  insertAtLineStart: (prefix: string) => void;
  focus: () => void;
  getSelection: () => { start: number; end: number; text: string };
}

export interface EditorProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel: string;
  maxLength?: number;
  rows?: number;
  apiRef?: Ref<EditorApi>;
}

export function Editor({
  id,
  value,
  onChange,
  onSave,
  readOnly,
  placeholder,
  ariaLabel,
  maxLength,
  rows = 8,
  apiRef,
}: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const replaceRange = (start: number, end: number, text: string, cursor: [number, number]) => {
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor[0], cursor[1]);
    });
  };

  const api: EditorApi = {
    focus: () => ref.current?.focus(),
    getSelection() {
      const el = ref.current;
      const start = el?.selectionStart ?? 0;
      const end = el?.selectionEnd ?? 0;
      return { start, end, text: value.slice(start, end) };
    },
    wrapSelection(before, after) {
      const { start, end, text } = api.getSelection();
      const wrapped =
        text.startsWith(before) &&
        text.endsWith(after) &&
        text.length >= before.length + after.length;
      if (wrapped) {
        const inner = text.slice(before.length, text.length - after.length);
        replaceRange(start, end, inner, [start, start + inner.length]);
      } else {
        replaceRange(start, end, `${before}${text}${after}`, [
          start + before.length,
          start + before.length + text.length,
        ]);
      }
    },
    insertAtLineStart(prefix) {
      const { start, end } = api.getSelection();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = end === start ? value.indexOf("\n", end) : end;
      const block = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const lines = block.split("\n");
      const allPrefixed = lines.every((l) => l.startsWith(prefix));
      const next = lines.map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l)).join("\n");
      replaceRange(lineStart, lineStart + block.length, next, [lineStart, lineStart + next.length]);
    },
  };
  useImperativeHandle(apiRef, () => api);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      api.wrapSelection("**", "**");
    } else if (key === "i") {
      e.preventDefault();
      api.wrapSelection("*", "*");
    } else if (key === "s" && onSave) {
      e.preventDefault();
      onSave();
    }
  };

  return (
    <TextArea
      id={id}
      ref={ref}
      labelText={ariaLabel}
      hideLabel
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      readOnly={readOnly}
      placeholder={placeholder}
      rows={rows}
      maxCount={maxLength}
      enableCounter={maxLength !== undefined && value.length > maxLength * 0.9}
      className="memra-editor"
      spellCheck
    />
  );
}
