import { EventEmitter } from "node:events";
import {
  AppSettings,
  type AppSettingsPatch,
  DEFAULT_SETTINGS,
  EmbeddingSettings,
  LlmSettings,
  SearchSettings,
} from "shared";
import { type Database, now } from "../db/database.ts";
import type { SecretBox } from "./secrets.ts";

/** Settings with decrypted secrets, for server-side use only. */
export interface ResolvedSettings extends AppSettings {
  embeddingApiKey: string | null;
  llmApiKey: string | null;
}

const KEYS = {
  embedding: "embedding",
  embeddingApiKey: "embedding_api_key",
  llm: "llm",
  llmApiKey: "llm_api_key",
  search: "search",
} as const;

export class SettingsService extends EventEmitter<{ changed: [ResolvedSettings] }> {
  readonly #db: Database;
  readonly #box: SecretBox;
  #cache: ResolvedSettings | null = null;

  constructor(db: Database, box: SecretBox) {
    super();
    this.#db = db;
    this.#box = box;
  }

  resolved(): ResolvedSettings {
    if (this.#cache) return this.#cache;
    const rows = new Map(
      this.#db
        .all<{ key: string; value: string; encrypted: number }>(
          "SELECT key, value, encrypted FROM settings",
        )
        .map((r) => [r.key, r.encrypted ? this.#box.decrypt(r.value) : r.value]),
    );
    const parse = <T>(
      key: string,
      schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
      fallback: T,
    ): T => {
      const raw = rows.get(key);
      if (!raw) return fallback;
      const result = schema.safeParse(JSON.parse(raw));
      return result.success ? (result.data as T) : fallback;
    };
    const embeddingApiKey = rows.get(KEYS.embeddingApiKey) ?? null;
    const llmApiKey = rows.get(KEYS.llmApiKey) ?? null;
    this.#cache = {
      embedding: parse(KEYS.embedding, EmbeddingSettings, DEFAULT_SETTINGS.embedding),
      embeddingApiKeySet: !!embeddingApiKey,
      embeddingApiKey,
      llm: parse(KEYS.llm, LlmSettings, DEFAULT_SETTINGS.llm),
      llmApiKeySet: !!llmApiKey,
      llmApiKey,
      search: parse(KEYS.search, SearchSettings, DEFAULT_SETTINGS.search),
    };
    return this.#cache;
  }

  public(): AppSettings {
    const { embeddingApiKey: _e, llmApiKey: _l, ...rest } = this.resolved();
    return AppSettings.parse(rest);
  }

  update(patch: AppSettingsPatch): AppSettings {
    const before = this.resolved();
    this.#db.transaction(() => {
      if (patch.embedding) this.put(KEYS.embedding, JSON.stringify(patch.embedding), false);
      if (patch.llm) this.put(KEYS.llm, JSON.stringify(patch.llm), false);
      if (patch.search)
        this.put(KEYS.search, JSON.stringify({ ...before.search, ...patch.search }), false);
      if (patch.embeddingApiKey !== undefined)
        this.putSecret(KEYS.embeddingApiKey, patch.embeddingApiKey);
      if (patch.llmApiKey !== undefined) this.putSecret(KEYS.llmApiKey, patch.llmApiKey);
    });
    this.#cache = null;
    const after = this.resolved();
    this.emit("changed", after);
    return this.public();
  }

  private put(key: string, value: string, encrypted: boolean): void {
    this.#db.run(
      `INSERT INTO settings(key, value, encrypted, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, updated_at = excluded.updated_at`,
      key,
      encrypted ? this.#box.encrypt(value) : value,
      encrypted ? 1 : 0,
      now(),
    );
  }

  private putSecret(key: string, value: string): void {
    if (value === "") this.#db.run("DELETE FROM settings WHERE key = ?", key);
    else this.put(key, value, true);
  }
}
