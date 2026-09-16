export const PROFILE_DEFAULTS = {
  low: { embeddingModel: "Xenova/bge-small-en-v1.5", batch: 4, warmup: false },
  standard: { embeddingModel: "Xenova/bge-base-en-v1.5", batch: 16, warmup: true },
} as const;

export const DEFAULT_REMOTE_EMBEDDING_MODEL = "text-embedding-3-small";
