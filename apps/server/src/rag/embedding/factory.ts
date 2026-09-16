import type { Config } from "../../config.ts";
import { LocalEmbeddingProvider } from "./local.ts";
import { OpenAICompatibleEmbeddingProvider } from "./openai-compatible.ts";
import type { EmbeddingProvider } from "./provider.ts";

export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  const e = config.embedding;
  if (e.provider === "openai-compatible") {
    return new OpenAICompatibleEmbeddingProvider({
      baseUrl: e.baseUrl!,
      apiKey: e.apiKey,
      model: e.model,
      dims: e.dims,
      batch: e.batch,
    });
  }
  return new LocalEmbeddingProvider({
    model: e.model,
    dataDir: config.dataDir,
    batch: e.batch,
    threads: config.profile === "low" ? 1 : 2,
  });
}
