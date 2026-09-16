import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Config } from "../config.ts";
import { APP_DB_FILE, DATA_DIR_MODE } from "../constants/index.ts";
import { NodeSqliteDatabase } from "./database.ts";

export function openAppDatabase(config: Config): NodeSqliteDatabase {
  mkdirSync(config.dataDir, { recursive: true, mode: DATA_DIR_MODE });
  return new NodeSqliteDatabase(path.join(config.dataDir, APP_DB_FILE));
}
