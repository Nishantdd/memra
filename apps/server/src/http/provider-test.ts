import { OpenAICompatibleLlmProvider } from "../modules/ask/providers/openai-compatible.ts";
import { OpenAICompatibleEmbeddingProvider } from "../rag/embedding/openai-compatible.ts";

interface TestInput {
  kind: "embedding" | "llm";
  baseUrl: string;
  model: string;
  apiKey?: string | undefined;
}

/** Makes one small request against a remote provider so the user can validate credentials before saving. */
export async function testProvider(input: TestInput): Promise<{ ok: boolean; detail: string }> {
  try {
    if (input.kind === "embedding") {
      const provider = new OpenAICompatibleEmbeddingProvider({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey ?? null,
        model: input.model,
        dims: null,
        batch: 1,
      });
      const { dims } = await provider.init();
      return { ok: true, detail: `Connected. Embeddings have ${dims} dimensions.` };
    }
    const provider = new OpenAICompatibleLlmProvider({
      baseUrl: input.baseUrl,
      apiKey: input.apiKey ?? null,
      model: input.model,
    });
    let text = "";
    for await (const delta of provider.stream({
      system: "Reply with the single word OK.",
      user: "Ping",
      maxTokens: 5,
      signal: AbortSignal.timeout(20_000),
    })) {
      text += delta;
      if (text.length > 20) break;
    }
    return { ok: true, detail: `Connected. Model replied: “${text.trim() || "(empty)"}”.` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "Connection failed." };
  }
}
