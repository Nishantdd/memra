import path from "node:path";
import { BGE_QUERY_PREFIX, MODELS_DIR } from "../../constants/index.ts";
import { normalize } from "../rag-db.ts";
import type { EmbeddingProvider } from "./provider.ts";

type Extractor = (
  texts: string[],
  options: { pooling: "cls" | "mean"; normalize: boolean },
) => Promise<{ dims: number[]; data: Float32Array }>;

interface LocalOptions {
  model: string;
  dataDir: string;
  batch: number;
  threads?: number;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "local" as const;
  readonly model: string;
  readonly maxBatch: number;
  readonly #dataDir: string;
  readonly #threads: number;
  #extractor: Extractor | null = null;
  #dims = 0;

  constructor(options: LocalOptions) {
    this.model = options.model;
    this.maxBatch = options.batch;
    this.#dataDir = options.dataDir;
    this.#threads = options.threads ?? 1;
  }

  get id(): string {
    return `local:${this.model}`;
  }

  async init(): Promise<{ dims: number }> {
    if (this.#extractor) return { dims: this.#dims };
    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = path.join(this.#dataDir, MODELS_DIR);
    env.allowLocalModels = true;
    if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = this.#threads;
    const extractor = (await pipeline("feature-extraction", this.model, {
      dtype: "q8",
    })) as unknown as Extractor;
    const probe = await extractor(["probe"], { pooling: "cls", normalize: true });
    this.#dims = probe.dims.at(-1) ?? probe.data.length;
    this.#extractor = extractor;
    return { dims: this.#dims };
  }

  async embedDocuments(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    await this.init();
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += this.maxBatch) {
      const batch = texts.slice(i, i + this.maxBatch);
      const tensor = await this.#extractor!(batch, { pooling: "cls", normalize: true });
      for (let j = 0; j < batch.length; j++) {
        out.push(normalize(tensor.data.slice(j * this.#dims, (j + 1) * this.#dims)));
      }
      await new Promise((r) => setImmediate(r));
    }
    return out;
  }

  async embedQuery(text: string): Promise<Float32Array> {
    const prefix = /bge/i.test(this.model) ? BGE_QUERY_PREFIX : "";
    const [vector] = await this.embedDocuments([prefix + text]);
    return vector!;
  }
}
