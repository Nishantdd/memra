import type { EmbeddingSettings } from "shared";
import type { Config } from "../config.ts";
import {
  INDEX_BACKOFF_BASE_MS,
  INDEX_BACKOFF_MAX_MS,
  INDEX_POLL_MS,
  INDEX_QUIET_MS,
  WORKER_RSS_LIMIT_MB,
} from "../constants/index.ts";
import { openAppDatabase } from "../db/open.ts";
import { createEmbeddingProvider } from "./embedding/factory.ts";
import { Indexer } from "./indexer.ts";
import type { FromWorker, ToWorker } from "./messages.ts";
import { chunkerVersion, ensureRagSchema, openRagDatabase } from "./rag-db.ts";

const send = (m: FromWorker) => process.send?.(m);
const log = (level: "info" | "warn" | "error", message: string) =>
  send({ type: "log", level, message });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const config = JSON.parse(process.env.MEMRA_WORKER_CONFIG ?? "{}") as Config;
const embeddingSettings = JSON.parse(
  process.env.MEMRA_WORKER_EMBEDDING ?? "{}",
) as EmbeddingSettings;
const embeddingApiKey = process.env.MEMRA_WORKER_EMBEDDING_KEY || null;
const app = openAppDatabase(config);
const rag = openRagDatabase(config.dataDir);
const embed = createEmbeddingProvider(embeddingSettings, embeddingApiKey, config.dataDir);
const indexer = new Indexer(app, rag, embed);

let wakeResolve: (() => void) | null = null;
let rebuildRequested = false;
let failures = 0;

process.on("message", (m: ToWorker) => {
  if (m.type === "wake") wakeResolve?.();
  if (m.type === "rebuild") {
    rebuildRequested = true;
    wakeResolve?.();
  }
  if (m.type === "embedQuery") void answerQuery(m.id, m.text);
});

// Query embeddings bypass the job loop so a failing or backing-off job never delays search.
async function answerQuery(id: number, text: string): Promise<void> {
  try {
    const vector = await embed.embedQuery(text);
    send({ type: "queryEmbedding", id, vector });
  } catch (error) {
    send({
      type: "queryEmbedding",
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function waitForWork(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    wakeResolve = () => {
      clearTimeout(t);
      wakeResolve = null;
      resolve();
    };
  });
}

function reportProgress(total: number): void {
  const { pending } = indexer.pending();
  send({ type: "progress", done: Math.max(total - pending, 0), total });
}

async function main(): Promise<void> {
  const { dims } = await embed.init();
  const { rebuilt } = ensureRagSchema(rag, {
    provider: embed.providerName,
    model: embed.model,
    dims,
    chunkerVersion,
  });
  if (rebuilt) {
    log("info", "RAG identity changed; reindexing all notes");
    indexer.enqueueAll();
  } else {
    indexer.enqueueStale();
  }
  send({ type: "ready", dims });

  let total = indexer.pending().pending;
  for (;;) {
    if (rebuildRequested) {
      rebuildRequested = false;
      indexer.clearRagData();
      total = indexer.enqueueAll();
      reportProgress(total);
    }

    const job = indexer.nextJob(INDEX_QUIET_MS);
    if (!job) {
      if (total > 0) {
        reportProgress(total);
        total = 0;
      }
      await waitForWork(INDEX_POLL_MS);
      continue;
    }

    try {
      const result = await indexer.process(job);
      failures = 0;
      if (result === "indexed")
        send({ type: "indexed", noteId: job.note_id, version: job.version });
      if (total > 0) reportProgress(total);
    } catch (error) {
      indexer.fail(job, error);
      failures++;
      log(
        "error",
        `Indexing ${job.note_id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await sleep(Math.min(INDEX_BACKOFF_BASE_MS * 2 ** (failures - 1), INDEX_BACKOFF_MAX_MS));
    }

    const rssMb = process.memoryUsage().rss / 1_048_576;
    if (rssMb > WORKER_RSS_LIMIT_MB)
      log("warn", `Index worker RSS ${rssMb.toFixed(0)} MB exceeds limit`);
  }
}

main().catch((error) => {
  log("error", error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
