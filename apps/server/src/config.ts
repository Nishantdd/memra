import { z } from "zod";

const Bool = z
  .enum(["0", "1", "true", "false"])
  .transform((v) => v === "1" || v === "true");

const Env = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().default(3000),
  MEMRA_PUBLIC_ORIGIN: z.url().optional(),
  MEMRA_TRUST_PROXY: Bool.default(true),
  MEMRA_INSECURE_DEV: Bool.default(false),
  MEMRA_DATA_DIR: z.string().default("./data"),
  MEMRA_PROFILE: z.enum(["low", "standard"]).default("low"),
  MEMRA_EMBEDDING_PROVIDER: z.enum(["local", "openai-compatible"]).default("local"),
  MEMRA_EMBEDDING_MODEL: z.string().optional(),
  MEMRA_EMBEDDING_BASE_URL: z.url().optional(),
  MEMRA_EMBEDDING_API_KEY: z.string().optional(),
  MEMRA_EMBEDDING_DIMS: z.coerce.number().int().positive().optional(),
  MEMRA_EMBED_WARMUP: Bool.optional(),
  MEMRA_RERANKER: z.string().optional(),
  MEMRA_SEM_MIN_SIM: z.coerce.number().min(0).max(1).default(0.3),
  MEMRA_WORKER_RSS_LIMIT_MB: z.coerce.number().int().positive().default(350),
  MEMRA_LLM_PROVIDER: z.enum(["none", "openai-compatible"]).default("none"),
  MEMRA_LLM_BASE_URL: z.url().optional(),
  MEMRA_LLM_API_KEY: z.string().optional(),
  MEMRA_LLM_MODEL: z.string().optional(),
  MEMRA_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const PROFILE_DEFAULTS = {
  low: { embeddingModel: "Xenova/bge-small-en-v1.5", batch: 4, warmup: false },
  standard: { embeddingModel: "Xenova/bge-base-en-v1.5", batch: 16, warmup: true },
} as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")));
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  const profile = PROFILE_DEFAULTS[e.MEMRA_PROFILE];
  const secureCookies = !e.MEMRA_INSECURE_DEV;

  if (e.MEMRA_EMBEDDING_PROVIDER === "openai-compatible" && !e.MEMRA_EMBEDDING_BASE_URL) {
    throw new Error("MEMRA_EMBEDDING_BASE_URL is required for the openai-compatible embedding provider");
  }
  if (e.MEMRA_LLM_PROVIDER === "openai-compatible" && (!e.MEMRA_LLM_BASE_URL || !e.MEMRA_LLM_MODEL)) {
    throw new Error("MEMRA_LLM_BASE_URL and MEMRA_LLM_MODEL are required for the openai-compatible LLM provider");
  }

  return {
    host: e.HOST,
    port: e.PORT,
    publicOrigin: e.MEMRA_PUBLIC_ORIGIN ?? null,
    trustProxy: e.MEMRA_TRUST_PROXY,
    secureCookies,
    dataDir: e.MEMRA_DATA_DIR,
    profile: e.MEMRA_PROFILE,
    logLevel: e.MEMRA_LOG_LEVEL,
    embedding: {
      provider: e.MEMRA_EMBEDDING_PROVIDER,
      model:
        e.MEMRA_EMBEDDING_MODEL ??
        (e.MEMRA_EMBEDDING_PROVIDER === "local" ? profile.embeddingModel : "text-embedding-3-small"),
      baseUrl: e.MEMRA_EMBEDDING_BASE_URL ?? null,
      apiKey: e.MEMRA_EMBEDDING_API_KEY ?? null,
      dims: e.MEMRA_EMBEDDING_DIMS ?? null,
      batch: profile.batch,
      warmup: e.MEMRA_EMBED_WARMUP ?? profile.warmup,
      minSimilarity: e.MEMRA_SEM_MIN_SIM,
      workerRssLimitMb: e.MEMRA_WORKER_RSS_LIMIT_MB,
      reranker: e.MEMRA_RERANKER ?? null,
    },
    llm: {
      provider: e.MEMRA_LLM_PROVIDER,
      baseUrl: e.MEMRA_LLM_BASE_URL ?? null,
      apiKey: e.MEMRA_LLM_API_KEY ?? null,
      model: e.MEMRA_LLM_MODEL ?? null,
    },
  };
}

export type Config = ReturnType<typeof loadConfig>;
