import { loadConfig } from "./config.ts";
import { APP_VERSION } from "./constants/index.ts";
import { ensureInstanceId } from "./db/meta.ts";
import { migrate } from "./db/migrate.ts";
import { openAppDatabase } from "./db/open.ts";
import { createServices, type Services } from "./http/context.ts";

export function bootstrap(env: NodeJS.ProcessEnv = process.env): Services {
  const config = loadConfig(env);
  const db = openAppDatabase(config);
  migrate(db);
  const instanceId = ensureInstanceId(db);
  return createServices(config, db, instanceId, APP_VERSION);
}
