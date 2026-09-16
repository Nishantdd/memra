import { ComboBox, DismissibleTag, Dropdown, Tag } from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useState } from "react";
import { NOTE_COLORS, type NoteColor, type Tag as TagEntity } from "shared";
import { useCreateTag } from "../../data/mutations.ts";
import { useFolders, useTags } from "../../data/queries.ts";
import { COLOR_LABELS, tagType } from "./noteColors.ts";

interface FolderFieldProps {
  id: string;
  value: string | null;
  onChange: (folderId: string | null) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function FolderField({ id, value, onChange, disabled, size = "sm" }: FolderFieldProps) {
  const folders = useFolders() ?? [];
  const items = [
    { id: null as string | null, name: "All notes" },
    ...folders.map((f) => ({ id: f.id as string | null, name: f.name })),
  ];
  return (
    <Dropdown
      id={id}
      titleText="Folder"
      label="Folder"
      size={size}
      disabled={disabled}
      items={items}
      itemToString={(item) => item?.name ?? ""}
      selectedItem={items.find((i) => i.id === value) ?? items[0]}
      onChange={({ selectedItem }) => onChange(selectedItem?.id ?? null)}
    />
  );
}

interface ColorFieldProps {
  id: string;
  value: NoteColor;
  onChange: (color: NoteColor) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ColorField({ id, value, onChange, disabled, size = "sm" }: ColorFieldProps) {
  return (
    <Dropdown
      id={id}
      titleText="Colour"
      label="Colour"
      size={size}
      disabled={disabled}
      items={[...NOTE_COLORS]}
      itemToString={(c) => (c ? COLOR_LABELS[c] : "")}
      itemToElement={(c) => (
        <Tag type={tagType(c)} size="sm">
          {COLOR_LABELS[c]}
        </Tag>
      )}
      renderSelectedItem={(c) => (
        <Tag type={tagType(c)} size="sm">
          {COLOR_LABELS[c]}
        </Tag>
      )}
      selectedItem={value}
      onChange={({ selectedItem }) => selectedItem && onChange(selectedItem)}
    />
  );
}

interface TagsFieldProps {
  id: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  color: NoteColor;
}

export function TagsField({ id, value, onChange, disabled, color }: TagsFieldProps) {
  const tags = useTags() ?? [];
  const createTag = useCreateTag();
  const [error, setError] = useState<string | null>(null);
  const selected = value
    .map((tid) => tags.find((t) => t.id === tid))
    .filter((t): t is TagEntity => !!t);
  const available = tags.filter((t) => !value.includes(t.id));

  const add = (tag: TagEntity | null, typed?: string) => {
    setError(null);
    if (tag) return onChange([...value, tag.id]);
    const name = typed?.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return !value.includes(existing.id) && onChange([...value, existing.id]);
    createTag.mutate(
      { name },
      {
        onSuccess: (created) => onChange([...value, created.id]),
        onError: (e) => {
          if (isDefinedError(e) && e.code === "CONFLICT") onChange([...value, e.data.existing.id]);
          else setError("Couldn't create tag.");
        },
      },
    );
  };

  return (
    <div className="memra-tags-field">
      <ComboBox
        id={id}
        titleText="Tags"
        placeholder="Add tag"
        size="sm"
        disabled={disabled}
        items={available}
        itemToString={(t) => t?.name ?? ""}
        selectedItem={null}
        allowCustomValue
        onChange={({ selectedItem, inputValue }) =>
          add(selectedItem ?? null, inputValue ?? undefined)
        }
        invalid={error !== null}
        invalidText={error ?? ""}
      />
      {selected.length > 0 && (
        <div className="memra-tags-field__list">
          {selected.map((t) =>
            disabled ? (
              <Tag key={t.id} type={tagType(color)} size="sm">
                {t.name}
              </Tag>
            ) : (
              <DismissibleTag
                key={t.id}
                type={tagType(color)}
                size="sm"
                text={t.name}
                dismissTooltipLabel={`Remove ${t.name}`}
                onClose={() => onChange(value.filter((id) => id !== t.id))}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
