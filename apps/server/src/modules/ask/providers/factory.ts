import type { LlmSettings } from "shared";
import { OpenAICompatibleLlmProvider } from "./openai-compatible.ts";
import type { LlmProvider } from "./provider.ts";

/** Provider used when no LLM is configured: the service emits an extractive answer instead of calling `stream`. */
export const noneProvider: LlmProvider = {
  providerName: "none",
  model: null,
  local: true,
  // eslint-disable-next-line require-yield
  async *stream() {
    throw new Error("No LLM configured");
  },
};

export function createLlmProvider(settings: LlmSettings, apiKey: string | null): LlmProvider {
  if (settings.provider === "openai-compatible") {
    return new OpenAICompatibleLlmProvider({
      baseUrl: settings.baseUrl,
      apiKey,
      model: settings.model,
    });
  }
  return noneProvider;
}
