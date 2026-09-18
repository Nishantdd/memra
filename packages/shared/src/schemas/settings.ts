import { z } from "zod";
import { ProviderBaseUrl } from "./common.ts";

export const LOCAL_EMBEDDING_MODELS = [
  {
    id: "Xenova/bge-small-en-v1.5",
    label: "bge-small (fast, ~35 MB)",
    dims: 384,
  },
  {
    id: "Xenova/bge-base-en-v1.5",
    label: "bge-base (better recall, ~110 MB)",
    dims: 768,
  },
] as const;

export const ContentTheme = z.enum(["white", "g10", "g90", "g100"]);
export type ContentTheme = z.infer<typeof ContentTheme>;

export const AppearanceSettings = z.object({
  theme: ContentTheme.nullable().default(null),
});
export type AppearanceSettings = z.infer<typeof AppearanceSettings>;

export const EmbeddingSettings = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("local"), model: z.string().min(1) }),
  z.object({
    provider: z.literal("openai-compatible"),
    baseUrl: ProviderBaseUrl,
    model: z.string().min(1),
    dims: z.number().int().positive().nullable().default(null),
  }),
]);
export type EmbeddingSettings = z.infer<typeof EmbeddingSettings>;

export const LlmSettings = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("none") }),
  z.object({
    provider: z.literal("openai-compatible"),
    baseUrl: ProviderBaseUrl,
    model: z.string().min(1),
  }),
]);
export type LlmSettings = z.infer<typeof LlmSettings>;

export const SearchSettings = z.object({
  minSimilarity: z.number().min(0).max(1).default(0.3),
});
export type SearchSettings = z.infer<typeof SearchSettings>;

/** Settings as stored and returned; secrets are never included, only whether they are set. */
export const AppSettings = z.object({
  appearance: AppearanceSettings,
  embedding: EmbeddingSettings,
  embeddingApiKeySet: z.boolean(),
  llm: LlmSettings,
  llmApiKeySet: z.boolean(),
  search: SearchSettings,
});
export type AppSettings = z.infer<typeof AppSettings>;

/** Patch payload: omitted keys keep their value; an empty-string key clears the secret. */
export const AppSettingsPatch = z.object({
  appearance: AppearanceSettings.partial().optional(),
  embedding: EmbeddingSettings.optional(),
  embeddingApiKey: z.string().max(4096).optional(),
  llm: LlmSettings.optional(),
  llmApiKey: z.string().max(4096).optional(),
  search: SearchSettings.partial().optional(),
});
export type AppSettingsPatch = z.infer<typeof AppSettingsPatch>;

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: { theme: null },
  embedding: { provider: "local", model: LOCAL_EMBEDDING_MODELS[0].id },
  embeddingApiKeySet: false,
  llm: { provider: "none" },
  llmApiKeySet: false,
  search: { minSimilarity: 0.3 },
};
