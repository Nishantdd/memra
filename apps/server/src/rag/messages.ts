export type ToWorker =
  | { type: "wake" }
  | { type: "rebuild" }
  | { type: "embedQuery"; id: number; text: string };

export type FromWorker =
  | { type: "ready"; dims: number }
  | { type: "indexed"; noteId: string; version: number }
  | { type: "progress"; done: number; total: number }
  | { type: "queryEmbedding"; id: number; vector?: Float32Array; error?: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
