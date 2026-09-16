import { Checkmark, Edit, InProgress, WarningAlt } from "@carbon/icons-react";
import { Tag } from "@carbon/react";
import { useSaveStatus } from "../data/saveStatus.ts";

const LABELS = {
  saved: { text: "Saved", icon: Checkmark },
  unsaved: { text: "Unsaved changes", icon: Edit },
  saving: { text: "Saving…", icon: InProgress },
  error: { text: "Not saved", icon: WarningAlt },
} as const;

export function StatusTag() {
  const status = useSaveStatus();
  const { text, icon } = LABELS[status];
  return (
    <Tag
      type={status === "error" ? "red" : "gray"}
      size="md"
      renderIcon={icon}
      className="memra-status"
    >
      {text}
    </Tag>
  );
}
