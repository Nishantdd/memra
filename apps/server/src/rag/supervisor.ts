import { EventEmitter } from "node:events";
import { type ChildProcess, fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { QUERY_EMBED_CACHE_SIZE, QUERY_EMBED_TIMEOUT_MS } from "../constants/index.ts";
import type { Config } from "../config.ts";
import type { FromWorker, ToWorker } from "./messages.ts";

export interface IndexProgress {
  done: number;
  total: number;
}

interface Pending {
  resolve: (v: Float32Array) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class QueryEmbeddingUnavailable extends Error {}

/**
 * Owns the index worker process: restarts it on crash, relays events, and
 * brokers query embeddings so only one model instance is resident. A child
 * process (not a worker thread) is used because onnxruntime's native addon
 * cannot be reloaded into a fresh worker thread and an OOM must not take the
 * HTTP server down.
 */
export class IndexSupervisor extends EventEmitter<{
  ready: [{ dims: number }];
  indexed: [{ noteId: string; version: number }];
  progress: [IndexProgress];
  log: [{ level: "info" | "warn" | "error"; message: string }];
}> {
  readonly #config: Config;
  #worker: ChildProcess | null = null;
  #ready = false;
  #dims = 0;
  #nextId = 1;
  #stopped = false;
  #restartDelay = 1000;
  #progress: IndexProgress = { done: 0, total: 0 };
  readonly #pending = new Map<number, Pending>();
  readonly #cache = new Map<string, Float32Array>();

  constructor(config: Config) {
    super();
    this.#config = config;
  }

  get ready(): boolean {
    return this.#ready;
  }

  get dims(): number {
    return this.#dims;
  }

  get progress(): IndexProgress {
    return this.#progress;
  }

  start(): void {
    this.#stopped = false;
    this.spawn();
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    for (const p of this.#pending.values()) {
      clearTimeout(p.timer);
      p.reject(new QueryEmbeddingUnavailable("shutting down"));
    }
    this.#pending.clear();
    const worker = this.#worker;
    this.#worker = null;
    if (worker) {
      await new Promise<void>((resolve) => {
        worker.once("exit", () => resolve());
        worker.kill();
      });
    }
  }

  wake(): void {
    this.send({ type: "wake" });
  }

  rebuild(): void {
    this.#progress = { done: 0, total: 0 };
    this.send({ type: "rebuild" });
  }

  embedQuery(text: string): Promise<Float32Array> {
    const cached = this.#cache.get(text);
    if (cached) return Promise.resolve(cached);
    if (!this.#worker || !this.#ready)
      return Promise.reject(new QueryEmbeddingUnavailable("embedding model not ready"));
    const id = this.#nextId++;
    return new Promise<Float32Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new QueryEmbeddingUnavailable("query embedding timed out"));
      }, QUERY_EMBED_TIMEOUT_MS);
      this.#pending.set(id, {
        resolve: (v) => {
          if (this.#cache.size >= QUERY_EMBED_CACHE_SIZE)
            this.#cache.delete(this.#cache.keys().next().value!);
          this.#cache.set(text, v);
          resolve(v);
        },
        reject,
        timer,
      });
      this.send({ type: "embedQuery", id, text });
    });
  }

  private send(m: ToWorker): void {
    this.#worker?.send(m);
  }

  private spawn(): void {
    const isTs = import.meta.url.endsWith(".ts");
    const file = fileURLToPath(
      new URL(isTs ? "./index.worker.ts" : "./index.worker.mjs", import.meta.url),
    );
    const worker = fork(file, [], {
      serialization: "advanced",
      env: { ...process.env, MEMRA_WORKER_CONFIG: JSON.stringify(this.#config) },
      execArgv: process.execArgv,
    });
    this.#worker = worker;
    this.#ready = false;

    worker.on("message", (m: FromWorker) => {
      switch (m.type) {
        case "ready":
          this.#ready = true;
          this.#dims = m.dims;
          this.#restartDelay = 1000;
          this.emit("ready", { dims: m.dims });
          break;
        case "indexed":
          this.emit("indexed", m);
          break;
        case "progress":
          this.#progress = { done: m.done, total: m.total };
          this.emit("progress", this.#progress);
          break;
        case "queryEmbedding": {
          const p = this.#pending.get(m.id);
          if (!p) break;
          this.#pending.delete(m.id);
          clearTimeout(p.timer);
          if (m.vector) p.resolve(m.vector);
          else p.reject(new QueryEmbeddingUnavailable(m.error ?? "unknown error"));
          break;
        }
        case "log":
          this.emit("log", m);
          break;
      }
    });

    const onExit = (reason: string) => {
      if (this.#worker !== worker) return;
      this.#worker = null;
      this.#ready = false;
      this.emit("log", { level: "error", message: `Index worker exited (${reason})` });
      if (!this.#stopped) {
        setTimeout(() => this.spawn(), this.#restartDelay);
        this.#restartDelay = Math.min(this.#restartDelay * 2, 60_000);
      }
    };
    worker.on("error", (e: Error) => onExit(e.message));
    worker.on("exit", (code, signal) => onExit(signal ? `signal ${signal}` : `code ${code}`));
  }
}
