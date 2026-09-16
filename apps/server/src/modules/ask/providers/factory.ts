import type { Config } from "../../../config.ts";
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

export function createLlmProvider(config: Config): LlmProvider {
  const l = config.llm;
  if (l.provider === "openai-compatible") {
    return new OpenAICompatibleLlmProvider({
      baseUrl: l.baseUrl!,
      apiKey: l.apiKey,
      model: l.model!,
    });
  }
  return noneProvider;
}
