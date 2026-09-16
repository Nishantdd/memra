import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrap } from "./bootstrap.ts";
import {
  MAINTENANCE_INITIAL_DELAY_MS,
  MAINTENANCE_INTERVAL_MS,
  SESSION_PURGE_INTERVAL_MS,
} from "./constants/index.ts";
import { backupDatabase, optimize, purgeTombstones } from "./maintenance.ts";
import { buildApp } from "./http/app.ts";

const services = await bootstrap();
const { config } = services;

if (config.host !== "127.0.0.1" && config.host !== "localhost" && !config.secureCookies) {
  console.error("Refusing to bind to a non-loopback host with MEMRA_INSECURE_DEV=1.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist =
  [path.resolve(here, "../../client/dist"), path.resolve(here, "../client")].find((p) =>
    existsSync(path.join(p, "index.html")),
  ) ?? null;

const app = buildApp(services, clientDist);

services.index.on("log", ({ level, message }) => app.log[level]({ worker: "index" }, message));
services.index.start();

const purge = setInterval(() => services.auth.purge(), SESSION_PURGE_INTERVAL_MS);
purge.unref();

const runMaintenance = async () => {
  try {
    const dest = await backupDatabase(services.db, config.dataDir);
    const removed = purgeTombstones(services.db);
    optimize(services.db);
    app.log.info({ backup: dest, tombstonesRemoved: removed }, "maintenance complete");
  } catch (error) {
    app.log.error(error, "maintenance failed");
  }
};
const maintenanceStart = setTimeout(() => {
  void runMaintenance();
  const maintenance = setInterval(() => void runMaintenance(), MAINTENANCE_INTERVAL_MS);
  maintenance.unref();
}, MAINTENANCE_INITIAL_DELAY_MS);
maintenanceStart.unref();

const shutdown = async () => {
  clearInterval(purge);
  await services.index.stop();
  await app.close();
  services.db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
