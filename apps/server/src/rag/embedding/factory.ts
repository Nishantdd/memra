import type { EmbeddingSettings } from "shared";
import { EMBED_BATCH_LOCAL, EMBED_BATCH_REMOTE, EMBED_THREADS } from "../../constants/index.ts";
import { LocalEmbeddingProvider } from "./local.ts";
import { OpenAICompatibleEmbeddingProvider } from "./openai-compatible.ts";
import type { EmbeddingProvider } from "./provider.ts";

export function createEmbeddingProvider(
  settings: EmbeddingSettings,
  apiKey: string | null,
  dataDir: string,
): EmbeddingProvider {
  if (settings.provider === "openai-compatible") {
    return new OpenAICompatibleEmbeddingProvider({
      baseUrl: settings.baseUrl,
      apiKey,
      model: settings.model,
      dims: settings.dims,
      batch: EMBED_BATCH_REMOTE,
    });
  }
  return new LocalEmbeddingProvider({
    model: settings.model,
    dataDir,
    batch: EMBED_BATCH_LOCAL,
    threads: EMBED_THREADS,
  });
}
