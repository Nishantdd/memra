import { EventPublisher } from "@orpc/server";
import type { ServerEvent } from "shared";
import type { Config } from "../config.ts";
import type { Database } from "../db/database.ts";
import { AuthService, type Session } from "../modules/auth/auth.service.ts";
import { FoldersRepo } from "../modules/folders/folders.repo.ts";
import { NotesRepo } from "../modules/notes/notes.repo.ts";
import { SearchService } from "../modules/search/search.service.ts";
import { SyncRepo } from "../modules/sync/sync.repo.ts";
import { TagsRepo } from "../modules/tags/tags.repo.ts";
import { openRagDatabase } from "../rag/rag-db.ts";
import { IndexSupervisor } from "../rag/supervisor.ts";

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
  events: EventPublisher<{ event: ServerEvent }>;
}

export function createServices(
  config: Config,
  db: Database,
  instanceId: string,
  version: string,
): Services {
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
    notes: new NotesRepo(db),
    folders: new FoldersRepo(db),
    tags: new TagsRepo(db),
    sync: new SyncRepo(db),
    search: new SearchService(db, rag, index, config.embedding.minSimilarity),
    index,
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
