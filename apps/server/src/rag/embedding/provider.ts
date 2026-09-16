export interface EmbeddingProvider {
  readonly id: string;
  readonly providerName: "local" | "openai-compatible";
  readonly model: string;
  readonly maxBatch: number;
  /** Resolves once the model is loaded and dims are known. */
  init(): Promise<{ dims: number }>;
  embedDocuments(texts: string[], signal?: AbortSignal): Promise<Float32Array[]>;
  embedQuery(text: string, signal?: AbortSignal): Promise<Float32Array>;
}
