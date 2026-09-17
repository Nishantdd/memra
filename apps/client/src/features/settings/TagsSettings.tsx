import { Add } from "@carbon/icons-react";
import {
  Button,
  ContainedList,
  ContainedListItem,
  Form,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Stack,
  TextInput,
} from "@carbon/react";
import { ORPCError } from "@orpc/client";
import { type FormEvent, useState } from "react";
import { LIMITS, type Tag } from "shared";
import { useCreateTag, useDeleteTag, useRenameTag } from "../../data/mutations.ts";
import { useTags } from "../../data/queries.ts";

function tagErrorText(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ORPCError && error.code === "CONFLICT")
    return "A tag with this name already exists.";
  return "Something went wrong. Try again.";
}

export function TagsSettings() {
  const tags = useTags() ?? [];
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const trimmed = name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || create.isPending) return;
    create.mutate({ name: trimmed }, { onSuccess: () => setName("") });
  };

  return (
    <Stack gap={8}>
      <Form onSubmit={submit} className="memra-form">
        <h3 className="memra-section__heading">New tag</h3>
        <div className="memra-form__inline">
          <TextInput
            id="tag-name"
            labelText="Tag name"
            hideLabel
            placeholder="Tag name"
            value={name}
            maxLength={LIMITS.tagNameMax}
            onChange={(e) => {
              setName(e.target.value);
              if (create.isError) create.reset();
            }}
            invalid={create.isError}
            invalidText={tagErrorText(create.error) ?? ""}
          />
          <Button type="submit" size="md" renderIcon={Add} disabled={!trimmed || create.isPending}>
            Add
          </Button>
        </div>
      </Form>

      <div className="memra-form">
        <ContainedList
          label={`${tags.length} ${tags.length === 1 ? "tag" : "tags"}`}
          kind="on-page"
        >
          {tags.length === 0 && <ContainedListItem>No tags yet.</ContainedListItem>}
          {tags.map((t) => (
            <ContainedListItem
              key={t.id}
              action={
                <OverflowMenu
                  aria-label="Tag actions"
                  iconDescription="Tag actions"
                  size="lg"
                  flipped
                >
                  <OverflowMenuItem itemText="Rename" onClick={() => setRenaming(t)} />
                  <OverflowMenuItem itemText="Delete" isDelete onClick={() => setDeleting(t)} />
                </OverflowMenu>
              }
            >
              {t.name}
            </ContainedListItem>
          ))}
        </ContainedList>
      </div>

      {renaming && (
        <RenameTagModal key={renaming.id} tag={renaming} onClose={() => setRenaming(null)} />
      )}
      {deleting && (
        <DeleteTagModal key={deleting.id} tag={deleting} onClose={() => setDeleting(null)} />
      )}
    </Stack>
  );
}

function RenameTagModal({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const rename = useRenameTag();
  const [name, setName] = useState(tag.name);
  const trimmed = name.trim();
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || trimmed === tag.name || rename.isPending) return;
    rename.mutate({ id: tag.id, name: trimmed }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      size="xs"
      modalHeading="Rename tag"
      primaryButtonText="Rename"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!trimmed || trimmed === tag.name || rename.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() => submit()}
      selectorPrimaryFocus="#rename-tag"
    >
      <form onSubmit={submit}>
        <TextInput
          id="rename-tag"
          labelText="Tag name"
          value={name}
          maxLength={LIMITS.tagNameMax}
          onChange={(e) => setName(e.target.value)}
          invalid={rename.isError}
          invalidText={tagErrorText(rename.error) ?? ""}
        />
      </form>
    </Modal>
  );
}

function DeleteTagModal({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const del = useDeleteTag();
  return (
    <Modal
      open
      danger
      size="xs"
      modalHeading={`Delete “${tag.name}”?`}
      primaryButtonText="Delete"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={del.isPending}
      onRequestClose={onClose}
      onRequestSubmit={() => del.mutate({ id: tag.id }, { onSuccess: onClose })}
    >
      <p>The tag is removed from every note that uses it. Notes themselves are kept.</p>
    </Modal>
  );
}
