import {
  Button,
  InlineNotification,
  PasswordInput,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from "@carbon/react";
import { useMutation } from "@tanstack/react-query";
import { type EmbeddingSettings, LOCAL_EMBEDDING_MODELS, type LlmSettings } from "shared";
import { orpc } from "../../data/api/orpc.ts";

export interface EmbeddingDraft {
  settings: EmbeddingSettings;
  /** undefined = keep the stored key; "" = clear it. */
  apiKey: string | undefined;
  apiKeySet: boolean;
}

export interface LlmDraft {
  settings: LlmSettings;
  apiKey: string | undefined;
  apiKeySet: boolean;
}

function TestButton({
  kind,
  baseUrl,
  model,
  apiKey,
}: {
  kind: "embedding" | "llm";
  baseUrl: string;
  model: string;
  apiKey?: string;
}) {
  const test = useMutation(orpc.settings.testProvider.mutationOptions());
  const canTest = /^https?:\/\//.test(baseUrl) && model.trim().length > 0;
  return (
    <Stack gap={3}>
      <div>
        <Button
          kind="tertiary"
          size="md"
          disabled={!canTest || test.isPending}
          onClick={() => test.mutate({ kind, baseUrl, model, apiKey })}
        >
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
      </div>
      {test.data && (
        <InlineNotification
          kind={test.data.ok ? "success" : "error"}
          lowContrast
          hideCloseButton
          title={test.data.detail}
        />
      )}
    </Stack>
  );
}

export function EmbeddingFields({
  value,
  onChange,
}: {
  value: EmbeddingDraft;
  onChange: (v: EmbeddingDraft) => void;
}) {
  const s = value.settings;
  return (
    <Stack gap={5}>
      <RadioButtonGroup
        legendText="Embeddings (semantic search)"
        name="embedding-provider"
        orientation="vertical"
        valueSelected={s.provider}
        onChange={(v) =>
          onChange({
            ...value,
            settings:
              v === "local"
                ? { provider: "local", model: LOCAL_EMBEDDING_MODELS[0].id }
                : {
                    provider: "openai-compatible",
                    baseUrl: "",
                    model: "text-embedding-3-small",
                    dims: null,
                  },
          })
        }
      >
        <RadioButton
          id="emb-local"
          value="local"
          labelText="Run a model on this server (private, no account needed)"
        />
        <RadioButton
          id="emb-remote"
          value="openai-compatible"
          labelText="OpenAI-compatible API (OpenAI, Ollama, LM Studio, vLLM…)"
        />
      </RadioButtonGroup>
      {s.provider === "local" ? (
        <Select
          id="emb-model"
          labelText="Model"
          helperText="Downloaded once on first use. Changing it re-indexes all notes."
          value={s.model}
          onChange={(e) =>
            onChange({ ...value, settings: { provider: "local", model: e.target.value } })
          }
        >
          {LOCAL_EMBEDDING_MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id} text={m.label} />
          ))}
        </Select>
      ) : (
        <>
          <TextInput
            id="emb-url"
            labelText="Base URL"
            placeholder="https://api.openai.com/v1"
            helperText="Up to and including /v1; /embeddings is added automatically."
            value={s.baseUrl}
            onChange={(e) => onChange({ ...value, settings: { ...s, baseUrl: e.target.value } })}
          />
          <TextInput
            id="emb-model-name"
            labelText="Model"
            value={s.model}
            onChange={(e) => onChange({ ...value, settings: { ...s, model: e.target.value } })}
          />
          <PasswordInput
            id="emb-key"
            labelText="API key"
            helperText={
              value.apiKeySet && value.apiKey === undefined
                ? "A key is saved. Enter a new one to replace it."
                : "Stored encrypted on the server."
            }
            autoComplete="off"
            value={value.apiKey ?? ""}
            onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
          />
          <TestButton kind="embedding" baseUrl={s.baseUrl} model={s.model} apiKey={value.apiKey} />
        </>
      )}
    </Stack>
  );
}

export function LlmFields({
  value,
  onChange,
}: {
  value: LlmDraft;
  onChange: (v: LlmDraft) => void;
}) {
  const s = value.settings;
  return (
    <Stack gap={5}>
      <RadioButtonGroup
        legendText="Answers (AI)"
        name="llm-provider"
        orientation="vertical"
        valueSelected={s.provider}
        onChange={(v) =>
          onChange({
            ...value,
            settings:
              v === "none"
                ? { provider: "none" }
                : { provider: "openai-compatible", baseUrl: "", model: "" },
          })
        }
      >
        <RadioButton
          id="llm-none"
          value="none"
          labelText="Show the most relevant passages verbatim (no language model)"
        />
        <RadioButton
          id="llm-remote"
          value="openai-compatible"
          labelText="Generate answers with an OpenAI-compatible model"
        />
      </RadioButtonGroup>
      {s.provider === "openai-compatible" && (
        <>
          <TextInput
            id="llm-url"
            labelText="Base URL"
            placeholder="https://api.groq.com/openai/v1"
            helperText="Up to and including /v1; /chat/completions is added automatically."
            value={s.baseUrl}
            onChange={(e) => onChange({ ...value, settings: { ...s, baseUrl: e.target.value } })}
          />
          <TextInput
            id="llm-model"
            labelText="Model"
            placeholder="llama-3.3-70b-versatile"
            value={s.model}
            onChange={(e) => onChange({ ...value, settings: { ...s, model: e.target.value } })}
          />
          <PasswordInput
            id="llm-key"
            labelText="API key (optional)"
            helperText={
              value.apiKeySet && value.apiKey === undefined
                ? "A key is saved. Enter a new one to replace it."
                : "Stored encrypted on the server."
            }
            autoComplete="off"
            value={value.apiKey ?? ""}
            onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
          />
          <TestButton kind="llm" baseUrl={s.baseUrl} model={s.model} apiKey={value.apiKey} />
        </>
      )}
    </Stack>
  );
}
