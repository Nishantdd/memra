import {
  Button,
  Column,
  Form,
  Grid,
  InlineNotification,
  PasswordInput,
  Stack,
} from "@carbon/react";
import { isDefinedError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { DEFAULT_SETTINGS, LIMITS } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import {
  type EmbeddingDraft,
  EmbeddingFields,
  type LlmDraft,
  LlmFields,
} from "../settings/ProviderFields.tsx";

export function SetupPage() {
  const status = useQuery(orpc.setup.status.queryOptions({ staleTime: 0 }));
  const complete = useMutation(orpc.setup.complete.mutationOptions());
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [embedding, setEmbedding] = useState<EmbeddingDraft>({
    settings: DEFAULT_SETTINGS.embedding,
    apiKey: undefined,
    apiKeySet: false,
  });
  const [llm, setLlm] = useState<LlmDraft>({
    settings: DEFAULT_SETTINGS.llm,
    apiKey: undefined,
    apiKeySet: false,
  });

  if (status.data && !status.data.needsSetup && !complete.isSuccess)
    return <Navigate to="/login" replace />;
  if (complete.isSuccess) return <Navigate to="/login" replace />;

  const mismatch = repeat.length > 0 && password !== repeat;
  const canSubmit =
    password.length >= LIMITS.passwordMin && password === repeat && !complete.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    complete.mutate({
      password,
      settings: {
        embedding: embedding.settings,
        ...(embedding.apiKey ? { embeddingApiKey: embedding.apiKey } : {}),
        llm: llm.settings,
        ...(llm.apiKey ? { llmApiKey: llm.apiKey } : {}),
      },
    });
  };
  const error = complete.isError
    ? isDefinedError(complete.error) && complete.error.code === "BAD_REQUEST"
      ? complete.error.data.reason
      : isDefinedError(complete.error) && complete.error.code === "CONFLICT"
        ? "Setup was already completed."
        : "Setup failed. Try again."
    : null;

  return (
    <main className="memra-login">
      <Grid>
        <Column sm={4} md={{ span: 6, offset: 1 }} lg={{ span: 8, offset: 4 }}>
          <Form onSubmit={submit}>
            <Stack gap={7}>
              <div>
                <h1 className="memra-page-title">Set up Memra</h1>
                <p>
                  Choose a password and how search should work. You can change everything later in
                  Settings.
                </p>
              </div>
              <Stack gap={5}>
                <PasswordInput
                  id="setup-password"
                  labelText="Password"
                  helperText={`At least ${LIMITS.passwordMin} characters.`}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordInput
                  id="setup-repeat"
                  labelText="Repeat password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  invalid={mismatch}
                  invalidText="Passwords don't match."
                />
              </Stack>
              <EmbeddingFields value={embedding} onChange={setEmbedding} />
              <LlmFields value={llm} onChange={setLlm} />
              {error && (
                <InlineNotification kind="error" lowContrast hideCloseButton title={error} />
              )}
              <div className="memra-form__actions">
                <Button type="submit" size="lg" disabled={!canSubmit}>
                  Finish setup
                </Button>
              </div>
            </Stack>
          </Form>
        </Column>
      </Grid>
    </main>
  );
}
