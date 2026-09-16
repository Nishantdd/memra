import { Code, Link, ListBulleted, ListChecked, TextBold, TextItalic } from "@carbon/icons-react";
import { IconButton } from "@carbon/react";
import type { RefObject } from "react";
import type { EditorApi } from "./Editor.tsx";

const ACTIONS = [
  { label: "Bold", icon: TextBold, run: (api: EditorApi) => api.wrapSelection("**", "**") },
  { label: "Italic", icon: TextItalic, run: (api: EditorApi) => api.wrapSelection("*", "*") },
  { label: "Code", icon: Code, run: (api: EditorApi) => api.wrapSelection("`", "`") },
  {
    label: "Bulleted list",
    icon: ListBulleted,
    run: (api: EditorApi) => api.insertAtLineStart("- "),
  },
  {
    label: "Checklist",
    icon: ListChecked,
    run: (api: EditorApi) => api.insertAtLineStart("- [ ] "),
  },
  { label: "Link", icon: Link, run: (api: EditorApi) => api.wrapSelection("[", "](https://)") },
] as const;

export function EditorToolbar({
  apiRef,
  disabled,
}: {
  apiRef: RefObject<EditorApi | null>;
  disabled?: boolean;
}) {
  return (
    <div className="memra-toolbar" role="toolbar" aria-label="Formatting">
      {ACTIONS.map(({ label, icon: Icon, run }) => (
        <IconButton
          key={label}
          label={label}
          kind="ghost"
          size="sm"
          align="bottom"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apiRef.current && run(apiRef.current)}
        >
          <Icon size={16} />
        </IconButton>
      ))}
    </div>
  );
}
