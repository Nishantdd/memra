import { EventPublisher } from "@orpc/server";
import type { ServerEvent } from "shared";
import type { Config } from "../config.ts";
import type { Database } from "../db/database.ts";
import { AuthService, type Session } from "../modules/auth/auth.service.ts";
import { FoldersRepo } from "../modules/folders/folders.repo.ts";
import { NotesRepo } from "../modules/notes/notes.repo.ts";
import { SyncRepo } from "../modules/sync/sync.repo.ts";
import { TagsRepo } from "../modules/tags/tags.repo.ts";

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
  events: EventPublisher<{ event: ServerEvent }>;
}

export function createServices(config: Config, db: Database, instanceId: string, version: string): Services {
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
    events: new EventPublisher({ maxBufferedEvents: 100 }),
  };
}

export interface RequestContext {
  services: Services;
  session: Session | null;
  ip: string;
  userAgent: string;
  setSessionCookie(token: string | null): void;
}
