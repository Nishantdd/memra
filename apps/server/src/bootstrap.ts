import { loadConfig } from "./config.ts";
import { APP_VERSION } from "./constants/index.ts";
import { ensureInstanceId } from "./db/meta.ts";
import { currentSchemaVersion, migrate, pendingMigrations } from "./db/migrate.ts";
import { openAppDatabase } from "./db/open.ts";
import { createServices, type Services } from "./http/context.ts";
import { backupDatabase } from "./maintenance.ts";

export async function bootstrap(env: NodeJS.ProcessEnv = process.env): Promise<Services> {
  const config = loadConfig(env);
  const db = openAppDatabase(config);
  const pending = pendingMigrations(db);
  if (pending > 0 && currentSchemaVersion(db) > 0)
    await backupDatabase(db, config.dataDir, `pre-migration-${Date.now()}`);
  migrate(db);
  const instanceId = ensureInstanceId(db);
  return createServices(config, db, instanceId, APP_VERSION);
}
