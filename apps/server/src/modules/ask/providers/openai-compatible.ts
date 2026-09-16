import { LLM_TIMEOUT_MS } from "../../../constants/index.ts";
import type { LlmProvider, LlmStreamInput } from "./provider.ts";

interface Options {
  baseUrl: string;
  apiKey: string | null;
  model: string;
}

interface ChatChunk {
  choices?: { delta?: { content?: string | null } }[];
}

export class OpenAICompatibleLlmProvider implements LlmProvider {
  readonly providerName = "openai-compatible" as const;
  readonly model: string;
  readonly local: boolean;
  readonly #url: string;
  readonly #apiKey: string | null;

  constructor(options: Options) {
    this.model = options.model;
    this.#url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.#apiKey = options.apiKey;
    this.local = /^(https?:\/\/)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      options.baseUrl.replace(/^https?:\/\//, ""),
    );
  }

  async *stream({ system, user, maxTokens, signal }: LlmStreamInput): AsyncIterable<string> {
    const res = await fetch(this.#url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(LLM_TIMEOUT_MS)]),
    });
    if (!res.ok || !res.body) throw new Error(`LLM endpoint returned ${res.status}`);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        const text = (JSON.parse(payload) as ChatChunk).choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    }
  }
}
