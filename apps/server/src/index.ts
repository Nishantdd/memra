import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrap } from "./bootstrap.ts";
import { buildApp } from "./http/app.ts";

const services = bootstrap();
const { config } = services;

if (!services.auth.hasPassword()) {
  console.error("No password is set. Run: pnpm --filter server auth:set-password");
  process.exit(1);
}
if (config.host !== "127.0.0.1" && config.host !== "localhost" && !config.secureCookies) {
  console.error("Refusing to bind to a non-loopback host with MEMRA_INSECURE_DEV=1.");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = [path.resolve(here, "../../client/dist"), path.resolve(here, "../client")].find((p) =>
  existsSync(path.join(p, "index.html")),
) ?? null;

const app = buildApp(services, clientDist);

const purge = setInterval(() => services.auth.purge(), 3600_000);
purge.unref();

const shutdown = async () => {
  clearInterval(purge);
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
