import { Button, InlineNotification, Modal, ProgressBar, Slider, Stack, Tag } from "@carbon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AppSettings } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import { useIndexStatus } from "../../data/indexStatus.ts";
import {
  type EmbeddingDraft,
  EmbeddingFields,
  type LlmDraft,
  LlmFields,
} from "./ProviderFields.tsx";

export function SearchSettings() {
  const settings = useQuery(orpc.settings.get.queryOptions());
  if (settings.isPending) return null;
  if (settings.isError || !settings.data)
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title="Couldn't load settings."
      />
    );
  return <SearchSettingsForm key={JSON.stringify(settings.data)} initial={settings.data} />;
}

function SearchSettingsForm({ initial }: { initial: AppSettings }) {
  const qc = useQueryClient();
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.settings.key() }),
    }),
  );
  const rebuild = useMutation(orpc.index.rebuild.mutationOptions());
  const status = useIndexStatus();
  const [embedding, setEmbedding] = useState<EmbeddingDraft>({
    settings: initial.embedding,
    apiKey: undefined,
    apiKeySet: initial.embeddingApiKeySet,
  });
  const [llm, setLlm] = useState<LlmDraft>({
    settings: initial.llm,
    apiKey: undefined,
    apiKeySet: initial.llmApiKeySet,
  });
  const [minSimilarity, setMinSimilarity] = useState(initial.search.minSimilarity);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const embeddingChanged =
    JSON.stringify(embedding.settings) !== JSON.stringify(initial.embedding) ||
    embedding.apiKey !== undefined;
  const dirty =
    embeddingChanged ||
    JSON.stringify(llm.settings) !== JSON.stringify(initial.llm) ||
    llm.apiKey !== undefined ||
    minSimilarity !== initial.search.minSimilarity;
  const rebuilding =
    !!status && status.progress.total > 0 && status.progress.done < status.progress.total;

  const save = () =>
    update.mutate({
      embedding: embedding.settings,
      ...(embedding.apiKey !== undefined ? { embeddingApiKey: embedding.apiKey } : {}),
      llm: llm.settings,
      ...(llm.apiKey !== undefined ? { llmApiKey: llm.apiKey } : {}),
      search: { minSimilarity },
    });

  return (
    <Stack gap={7} className="memra-form">
      <EmbeddingFields value={embedding} onChange={setEmbedding} />
      <LlmFields value={llm} onChange={setLlm} />
      <Slider
        id="min-sim"
        labelText="Minimum similarity for semantic matches"
        min={10}
        max={70}
        step={5}
        value={Math.round(minSimilarity * 100)}
        onChange={({ value }) => setMinSimilarity(value / 100)}
        formatLabel={(v) => (v / 100).toFixed(2)}
      />
      {embeddingChanged && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title="Changing the embedding provider re-indexes every note."
        />
      )}
      {update.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Couldn't save settings."
        />
      )}
      <div className="memra-form__actions">
        <Button kind="primary" size="md" disabled={!dirty || update.isPending} onClick={save}>
          Save
        </Button>
      </div>

      <Stack gap={4}>
        <h3 className="memra-section__heading">Index</h3>
        <p>
          {status?.ready ? (
            <Tag type="green" size="sm">
              Ready
            </Tag>
          ) : (
            <Tag type="gray" size="sm">
              Loading model
            </Tag>
          )}{" "}
          {status ? `${Math.round(status.indexedRatio * 100)}% of notes indexed` : ""}
          {status && status.pending > 0 ? ` · ${status.pending} pending` : ""}
          {status && status.failed > 0 ? ` · ${status.failed} failed` : ""}
        </p>
        {rebuilding && status && (
          <ProgressBar
            label="Rebuilding"
            helperText={`${status.progress.done} of ${status.progress.total}`}
            value={status.progress.done}
            max={status.progress.total}
          />
        )}
        <div className="memra-form__actions">
          <Button
            kind="tertiary"
            size="md"
            disabled={!status?.ready || rebuilding || rebuild.isPending}
            onClick={() => setConfirmRebuild(true)}
          >
            Rebuild index
          </Button>
        </div>
      </Stack>
      <Modal
        open={confirmRebuild}
        size="sm"
        modalHeading="Rebuild the search index?"
        primaryButtonText="Rebuild"
        secondaryButtonText="Cancel"
        onRequestClose={() => setConfirmRebuild(false)}
        onRequestSubmit={() => {
          rebuild.mutate(undefined);
          setConfirmRebuild(false);
        }}
      >
        <p>All notes are re-embedded. Keyword search keeps working meanwhile.</p>
      </Modal>
    </Stack>
  );
}
