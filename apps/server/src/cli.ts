import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { bootstrap } from "./bootstrap.ts";
import { backupDatabase, optimize, purgeTombstones } from "./maintenance.ts";
import { WeakPassword } from "./modules/auth/auth.service.ts";

async function prompt(question: string): Promise<string> {
  const muted = new Writable({ write: (_chunk, _enc, cb) => cb() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  const answer = await rl.question("");
  rl.close();
  process.stdout.write("\n");
  return answer;
}

const [command] = process.argv.slice(2);
const services = await bootstrap();

try {
  switch (command) {
    case "auth:set-password": {
      const first = process.env.MEMRA_PASSWORD ?? (await prompt("New password: "));
      if (!process.env.MEMRA_PASSWORD && first !== (await prompt("Repeat password: "))) {
        console.error("Passwords do not match.");
        process.exit(1);
      }
      await services.auth.setPassword(first);
      services.auth.revokeOthers("");
      console.log("Password set. All sessions revoked.");
      break;
    }
    case "db:migrate":
      console.log("Database is up to date.");
      break;
    case "db:backup": {
      const dest = await backupDatabase(services.db, services.config.dataDir);
      console.log(`Backup written to ${dest}`);
      break;
    }
    case "db:maintain": {
      const removed = purgeTombstones(services.db);
      optimize(services.db);
      console.log(`Removed ${removed} expired tombstones; database optimized.`);
      break;
    }
    case "db:doctor": {
      const integrity = services.db.get<{ integrity_check: string }>("PRAGMA integrity_check");
      const counts = services.db.get<{
        notes: number;
        folders: number;
        tags: number;
        jobs: number;
      }>(
        `SELECT (SELECT count(*) FROM notes WHERE deleted_at IS NULL) AS notes,
                (SELECT count(*) FROM folders WHERE deleted_at IS NULL) AS folders,
                (SELECT count(*) FROM tags WHERE deleted_at IS NULL) AS tags,
                (SELECT count(*) FROM index_jobs) AS jobs`,
      );
      console.log({
        integrity: integrity?.integrity_check,
        ...counts,
        instanceId: services.instanceId,
      });
      break;
    }
    default:
      console.error("Usage: cli <auth:set-password|db:migrate|db:backup|db:maintain|db:doctor>");
      process.exit(1);
  }
} catch (e) {
  console.error(e instanceof WeakPassword ? e.reason : e);
  process.exit(1);
} finally {
  services.db.close();
}
