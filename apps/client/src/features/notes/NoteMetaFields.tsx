import { Dropdown, FilterableMultiSelect, Tag } from "@carbon/react";
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
  size?: "sm" | "md" | "lg";
}

const NEW_TAG_ID = "__new__";
type TagOption = Pick<TagEntity, "id" | "name">;

export function TagsField({ id, value, onChange, disabled, size = "sm" }: TagsFieldProps) {
  const tags = useTags() ?? [];
  const createTag = useCreateTag();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const name = typed.trim();
  const exists = tags.some((t) => t.name.toLowerCase() === name.toLowerCase());
  const items: TagOption[] =
    name && !exists ? [...tags, { id: NEW_TAG_ID, name: `Create \u201c${name}\u201d` }] : tags;
  const selected = items.filter((t) => value.includes(t.id));

  const apply = (picked: TagOption[]) => {
    setError(null);
    const ids = picked.filter((t) => t.id !== NEW_TAG_ID).map((t) => t.id);
    if (!picked.some((t) => t.id === NEW_TAG_ID)) return onChange(ids);
    createTag.mutate(
      { name },
      {
        onSuccess: (created) => onChange([...ids, created.id]),
        onError: (e) => {
          if (isDefinedError(e) && e.code === "CONFLICT") onChange([...ids, e.data.existing.id]);
          else setError("Couldn't create tag.");
        },
      },
    );
  };

  return (
    <FilterableMultiSelect
      id={id}
      titleText="Tags"
      placeholder="Add tags"
      size={size}
      disabled={disabled}
      items={items}
      itemToString={(t) => t?.name ?? ""}
      selectedItems={selected}
      onInputValueChange={({ inputValue }) => setTyped(inputValue ?? "")}
      onChange={({ selectedItems }) => apply(selectedItems)}
      invalid={error !== null}
      invalidText={error ?? ""}
    />
  );
}
