import { REMOTE_EMBED_RETRIES, REMOTE_EMBED_TIMEOUT_MS } from "../../constants/index.ts";
import { normalize } from "../rag-db.ts";
import type { EmbeddingProvider } from "./provider.ts";

interface RemoteOptions {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  dims: number | null;
  batch: number;
}

interface EmbeddingsResponse {
  data: { index: number; embedding: number[] }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "openai-compatible" as const;
  readonly model: string;
  readonly maxBatch: number;
  readonly #url: string;
  readonly #apiKey: string | null;
  #dims: number | null;

  constructor(options: RemoteOptions) {
    this.model = options.model;
    this.maxBatch = options.batch;
    this.#url = `${options.baseUrl.replace(/\/+$/, "")}/embeddings`;
    this.#apiKey = options.apiKey;
    this.#dims = options.dims;
  }

  get id(): string {
    return `openai-compatible:${this.model}`;
  }

  async init(): Promise<{ dims: number }> {
    if (this.#dims) return { dims: this.#dims };
    const [probe] = await this.request(["probe"]);
    this.#dims = probe!.length;
    return { dims: this.#dims };
  }

  async embedDocuments(texts: string[], signal?: AbortSignal): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += this.maxBatch) {
      out.push(...(await this.request(texts.slice(i, i + this.maxBatch), signal)));
    }
    return out;
  }

  embedQuery(text: string, signal?: AbortSignal): Promise<Float32Array> {
    return this.request([text], signal).then(([v]) => v!);
  }

  private async request(input: string[], signal?: AbortSignal): Promise<Float32Array[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt < REMOTE_EMBED_RETRIES; attempt++) {
      const timeout = AbortSignal.timeout(REMOTE_EMBED_TIMEOUT_MS);
      try {
        const res = await fetch(this.#url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.model,
            input,
            ...(this.#dims ? { dimensions: this.#dims } : {}),
          }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (res.status === 429 || res.status >= 500)
          throw new Error(`Embedding endpoint returned ${res.status}`);
        if (!res.ok)
          throw Object.assign(new Error(`Embedding endpoint returned ${res.status}`), {
            fatal: true,
          });
        const body = (await res.json()) as EmbeddingsResponse;
        return body.data
          .sort((a, b) => a.index - b.index)
          .map((d) => normalize(Float32Array.from(d.embedding)));
      } catch (error) {
        lastError = error;
        if (signal?.aborted || (error as { fatal?: boolean }).fatal) throw error;
        await sleep(500 * 2 ** attempt);
      }
    }
    throw lastError;
  }
}
