import { ASK, type AskEvent, type AskInput, type AskSource } from "shared";
import { ASK_CACHE_SIZE } from "../../constants/index.ts";
import { QueryEmbeddingUnavailable } from "../../rag/supervisor.ts";
import { buildUserPrompt, extractiveAnswer, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.ts";
import type { LlmProvider } from "./providers/provider.ts";
import type { AskRetriever, RetrievedNote } from "./retrieval.ts";

interface CachedAnswer {
  text: string;
  sources: AskSource[];
  expiresAt: number;
}

export class AskUnavailable extends Error {}

export class AskService {
  readonly #retriever: AskRetriever;
  readonly #llm: LlmProvider;
  readonly #cache = new Map<string, CachedAnswer>();

  constructor(retriever: AskRetriever, llm: LlmProvider) {
    this.#retriever = retriever;
    this.#llm = llm;
  }

  async *answer(input: AskInput, signal: AbortSignal): AsyncGenerator<AskEvent> {
    let notes: RetrievedNote[];
    try {
      notes = await this.#retriever.retrieve(input.q, input.folderId);
    } catch (error) {
      if (error instanceof QueryEmbeddingUnavailable) throw new AskUnavailable(error.message);
      throw error;
    }

    const top = notes[0]?.similarity ?? 0;
    if (top < ASK.minTopSimilarity) {
      yield { type: "insufficient", topSimilarity: Math.max(0, Math.min(1, top)) };
      return;
    }

    const extractive = this.#llm.providerName === "none";
    const sources: AskSource[] = notes.map((n, i) => ({
      n: i + 1,
      noteId: n.noteId,
      displayTitle: n.displayTitle,
      folderName: n.folderName,
      similarity: n.similarity,
    }));
    yield {
      type: "meta",
      provider: this.#llm.providerName,
      model: this.#llm.model,
      local: this.#llm.local,
      extractive,
      sources,
    };

    if (extractive) {
      yield { type: "delta", text: extractiveAnswer(notes, ASK.extractiveSnippets) };
      yield { type: "done", cached: false };
      return;
    }

    const key = cacheKey(input.q, notes, this.#llm.model);
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      yield { type: "delta", text: cached.text };
      yield { type: "done", cached: true };
      return;
    }

    let text = "";
    try {
      for await (const delta of this.#llm.stream({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt(input.q, notes),
        maxTokens: ASK.maxAnswerTokens,
        signal,
      })) {
        text += delta;
        yield { type: "delta", text: delta };
      }
    } catch (error) {
      if (signal.aborted) return;
      yield {
        type: "error",
        message: error instanceof Error ? error.message : "Generation failed",
      };
      return;
    }
    this.remember(key, { text, sources, expiresAt: Date.now() + ASK.cacheTtlMs });
    yield { type: "done", cached: false };
  }

  private remember(key: string, value: CachedAnswer): void {
    if (this.#cache.size >= ASK_CACHE_SIZE) this.#cache.delete(this.#cache.keys().next().value!);
    this.#cache.set(key, value);
  }
}

function cacheKey(q: string, notes: RetrievedNote[], model: string | null): string {
  const chunkIds = notes.flatMap((n) => n.chunks.map((c) => c.chunkId)).join(",");
  return `${PROMPT_VERSION}|${model}|${q.toLowerCase()}|${chunkIds}`;
}
