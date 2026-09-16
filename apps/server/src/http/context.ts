import { EventPublisher } from "@orpc/server";
import type { ServerEvent } from "shared";
import type { Config } from "../config.ts";
import type { Database } from "../db/database.ts";
import { ASK_RATE_LIMIT } from "../constants/index.ts";
import { AskService } from "../modules/ask/ask.service.ts";
import { createLlmProvider } from "../modules/ask/providers/factory.ts";
import { AskRetriever } from "../modules/ask/retrieval.ts";
import { AuthService, type Session } from "../modules/auth/auth.service.ts";
import { FoldersRepo } from "../modules/folders/folders.repo.ts";
import { ImportService } from "../modules/import/import.service.ts";
import { NotesRepo } from "../modules/notes/notes.repo.ts";
import { SearchService } from "../modules/search/search.service.ts";
import { SyncRepo } from "../modules/sync/sync.repo.ts";
import { TagsRepo } from "../modules/tags/tags.repo.ts";
import { openRagDatabase } from "../rag/rag-db.ts";
import { IndexSupervisor } from "../rag/supervisor.ts";
import { WindowRateLimiter } from "./rate-limit.ts";

export interface Services {
  config: Config;
  db: Database;
  instanceId: string;
  version: string;
  startedAt: number;
  auth: AuthService;
  notes: NotesRepo;
  folders: FoldersRepo;
  tags: TagsRepo;
  sync: SyncRepo;
  search: SearchService;
  index: IndexSupervisor;
  ask: AskService;
  askLimiter: WindowRateLimiter;
  importer: ImportService;
  events: EventPublisher<{ event: ServerEvent }>;
}

export function createServices(
  config: Config,
  db: Database,
  instanceId: string,
  version: string,
): Services {
  const notes = new NotesRepo(db);
  const folders = new FoldersRepo(db);
  const tags = new TagsRepo(db);
  const events = new EventPublisher<{ event: ServerEvent }>({ maxBufferedEvents: 100 });
  const index = new IndexSupervisor(config);
  const rag = openRagDatabase(config.dataDir);
  index.on("indexed", (m) =>
    events.publish("event", { type: "indexed", noteId: m.noteId, version: m.version }),
  );
  index.on("progress", (p) =>
    events.publish("event", { type: "index-progress", done: p.done, total: p.total }),
  );
  return {
    config,
    db,
    instanceId,
    version,
    startedAt: Date.now(),
    auth: new AuthService(db),
    notes,
    folders,
    tags,
    sync: new SyncRepo(db),
    search: new SearchService(db, rag, index, config.embedding.minSimilarity),
    index,
    ask: new AskService(new AskRetriever(db, rag, index), createLlmProvider(config)),
    askLimiter: new WindowRateLimiter(ASK_RATE_LIMIT.max, ASK_RATE_LIMIT.windowMs),
    importer: new ImportService(db, notes, folders, tags),
    events,
  };
}

export interface RequestContext {
  services: Services;
  session: Session | null;
  ip: string;
  userAgent: string;
  setSessionCookie(token: string | null): void;
}
