import { z } from "zod";

const Bool = z.enum(["0", "1", "true", "false"]).transform((v) => v === "1" || v === "true");

const Env = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().default(3000),
  MEMRA_PUBLIC_ORIGIN: z.url().optional(),
  MEMRA_TRUST_PROXY: Bool.default(true),
  MEMRA_INSECURE_DEV: Bool.default(false),
  MEMRA_DATA_DIR: z.string().default("./data"),
  MEMRA_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Env.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")));
  if (!parsed.success) throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  const e = parsed.data;
  return {
    host: e.HOST,
    port: e.PORT,
    publicOrigin: e.MEMRA_PUBLIC_ORIGIN ?? null,
    trustProxy: e.MEMRA_TRUST_PROXY,
    secureCookies: !e.MEMRA_INSECURE_DEV,
    dataDir: e.MEMRA_DATA_DIR,
    logLevel: e.MEMRA_LOG_LEVEL,
  };
}

export type Config = ReturnType<typeof loadConfig>;
