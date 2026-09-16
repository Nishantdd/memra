import { mkdirSync } from "node:fs";
import path from "node:path";
import { type Config, loadConfig } from "./config.ts";
import { NodeSqliteDatabase } from "./db/database.ts";
import { ensureInstanceId } from "./db/meta.ts";
import { migrate } from "./db/migrate.ts";
import { createServices, type Services } from "./http/context.ts";

export const APP_VERSION = "0.1.0";

export function openAppDatabase(config: Config): NodeSqliteDatabase {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  return new NodeSqliteDatabase(path.join(config.dataDir, "memra.sqlite"));
}

export function bootstrap(env: NodeJS.ProcessEnv = process.env): Services {
  const config = loadConfig(env);
  const db = openAppDatabase(config);
  migrate(db);
  const instanceId = ensureInstanceId(db);
  return createServices(config, db, instanceId, APP_VERSION);
}
