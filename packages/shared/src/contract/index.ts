import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";
import { LIMITS } from "../constants/limits.ts";
import { Uuid } from "../schemas/common.ts";
import {
  Folder,
  FolderName,
  Note,
  NoteCreate,
  NotePatch,
  Tag,
  TagName,
} from "../schemas/entities.ts";
import { searchContract } from "./search.ts";

const Ok = z.object({ ok: z.literal(true) });
const ById = z.object({ id: Uuid });

const notFound = { NOT_FOUND: {} } as const;

export const authContract = {
  login: oc
    .route({ method: "POST", path: "/auth/login" })
    .errors({
      UNAUTHORIZED: {},
      TOO_MANY_REQUESTS: { data: z.object({ retryAfterSec: z.number().int() }) },
    })
    .input(z.object({ password: z.string().min(1).max(1024) }))
    .output(z.object({ expiresAt: z.number().int() })),
  logout: oc.route({ method: "POST", path: "/auth/logout" }).output(Ok),
  session: oc
    .route({ method: "GET", path: "/auth/session" })
    .output(z.object({ authenticated: z.boolean(), expiresAt: z.number().int().nullable() })),
  changePassword: oc
    .route({ method: "POST", path: "/auth/password" })
    .errors({ UNAUTHORIZED: {}, BAD_REQUEST: { data: z.object({ reason: z.string() }) } })
    .input(
      z.object({ current: z.string().min(1), next: z.string().min(LIMITS.passwordMin).max(1024) }),
    )
    .output(Ok),
  sessions: oc.route({ method: "GET", path: "/auth/sessions" }).output(
    z.array(
      z.object({
        id: z.string(),
        createdAt: z.number().int(),
        lastSeenAt: z.number().int(),
        userAgent: z.string(),
        current: z.boolean(),
      }),
    ),
  ),
  revokeOthers: oc.route({ method: "POST", path: "/auth/sessions/revoke-others" }).output(Ok),
};

export const Status = z.object({
  db: z.literal("ok"),
  instanceId: z.string(),
  version: z.string(),
  uptimeSec: z.number().int(),
  index: z.object({
    pending: z.number().int(),
    failed: z.number().int(),
    indexedRatio: z.number().min(0).max(1),
  }),
  embedding: z.object({ provider: z.string(), model: z.string(), local: z.boolean() }),
  llm: z.object({ provider: z.string(), model: z.string().nullable(), local: z.boolean() }),
});
export type Status = z.infer<typeof Status>;

export const notesContract = {
  list: oc
    .route({ method: "GET", path: "/notes" })
    .input(
      z.object({
        folderId: Uuid.nullable().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .output(z.object({ items: z.array(Note), total: z.number().int() })),
  get: oc.route({ method: "GET", path: "/notes/{id}" }).errors(notFound).input(ById).output(Note),
  create: oc
    .route({ method: "POST", path: "/notes" })
    .errors({ NOT_FOUND: { data: z.object({ entity: z.enum(["folder", "tag"]) }) } })
    .input(NoteCreate)
    .output(Note),
  update: oc
    .route({ method: "PATCH", path: "/notes/{id}" })
    .errors({
      NOT_FOUND: { data: z.object({ entity: z.enum(["note", "folder", "tag"]) }) },
      CONFLICT: { data: z.object({ current: Note }) },
    })
    .input(NotePatch)
    .output(Note),
  delete: oc
    .route({ method: "DELETE", path: "/notes/{id}" })
    .errors(notFound)
    .input(ById)
    .output(Note),
  restore: oc
    .route({ method: "POST", path: "/notes/{id}/restore" })
    .errors(notFound)
    .input(ById)
    .output(Note),
};

export const foldersContract = {
  list: oc.route({ method: "GET", path: "/folders" }).output(z.array(Folder)),
  create: oc
    .route({ method: "POST", path: "/folders" })
    .errors({
      CONFLICT: { data: z.object({ reason: z.literal("duplicate_name") }) },
      FORBIDDEN: { data: z.object({ reason: z.literal("folder_limit"), limit: z.number().int() }) },
    })
    .input(z.object({ name: FolderName }))
    .output(Folder),
  rename: oc
    .route({ method: "PATCH", path: "/folders/{id}" })
    .errors({ ...notFound, CONFLICT: { data: z.object({ reason: z.literal("duplicate_name") }) } })
    .input(z.object({ id: Uuid, name: FolderName }))
    .output(Folder),
  delete: oc
    .route({ method: "DELETE", path: "/folders/{id}" })
    .errors(notFound)
    .input(ById)
    .output(Folder),
  reorder: oc
    .route({ method: "PUT", path: "/folders/order" })
    .errors({ BAD_REQUEST: { data: z.object({ reason: z.literal("ids_mismatch") }) } })
    .input(z.object({ ids: z.array(Uuid).max(LIMITS.folderCount) }))
    .output(z.array(Folder)),
};

export const tagsContract = {
  list: oc.route({ method: "GET", path: "/tags" }).output(z.array(Tag)),
  create: oc
    .route({ method: "POST", path: "/tags" })
    .errors({ CONFLICT: { data: z.object({ existing: Tag }) } })
    .input(z.object({ name: TagName }))
    .output(Tag),
  rename: oc
    .route({ method: "PATCH", path: "/tags/{id}" })
    .errors({ ...notFound, CONFLICT: { data: z.object({ existing: Tag }) } })
    .input(z.object({ id: Uuid, name: TagName }))
    .output(Tag),
  delete: oc
    .route({ method: "DELETE", path: "/tags/{id}" })
    .errors(notFound)
    .input(ById)
    .output(Tag),
};

export const SyncPage = z.object({
  cursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  folders: z.array(Folder),
  tags: z.array(Tag),
  notes: z.array(Note),
});
export type SyncPage = z.infer<typeof SyncPage>;

export const ServerEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("changed"), seq: z.number().int() }),
  z.object({ type: z.literal("indexed"), noteId: Uuid, version: z.number().int() }),
  z.object({ type: z.literal("index-progress"), done: z.number().int(), total: z.number().int() }),
]);
export type ServerEvent = z.infer<typeof ServerEvent>;

export const syncContract = {
  pull: oc
    .route({ method: "GET", path: "/sync" })
    .errors({ GONE: { data: z.object({ oldestSeq: z.number().int() }) } })
    .input(
      z.object({
        cursor: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(LIMITS.syncPageMax).default(LIMITS.syncPageMax),
      }),
    )
    .output(SyncPage),
  events: oc.route({ method: "GET", path: "/events" }).output(eventIterator(ServerEvent)),
};

export const IndexStatus = z.object({
  ready: z.boolean(),
  pending: z.number().int(),
  failed: z.number().int(),
  indexedRatio: z.number().min(0).max(1),
  progress: z.object({ done: z.number().int(), total: z.number().int() }),
  embedding: z.object({
    provider: z.string(),
    model: z.string(),
    dims: z.number().int(),
    local: z.boolean(),
  }),
});
export type IndexStatus = z.infer<typeof IndexStatus>;

export const indexContract = {
  status: oc.route({ method: "GET", path: "/index/status" }).output(IndexStatus),
  rebuild: oc.route({ method: "POST", path: "/index/rebuild" }).output(Ok),
};

export const contract = {
  health: oc.route({ method: "GET", path: "/health" }).output(Ok),
  status: oc.route({ method: "GET", path: "/status" }).output(Status),
  auth: authContract,
  notes: notesContract,
  folders: foldersContract,
  tags: tagsContract,
  sync: syncContract,
  search: searchContract,
  index: indexContract,
};

export type Contract = typeof contract;
