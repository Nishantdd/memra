import { implement, ORPCError } from "@orpc/server";
import { contract } from "shared";
import { AskUnavailable } from "../modules/ask/ask.service.ts";
import { LockedOut, WeakPassword } from "../modules/auth/auth.service.ts";
import {
  DuplicateFolderName,
  FolderLimitReached,
  FolderNotFound,
  FolderOrderMismatch,
} from "../modules/folders/folders.repo.ts";
import { InvalidImportFile } from "../modules/import/import.service.ts";
import { NoteConflict, NoteNotFound } from "../modules/notes/notes.repo.ts";
import { DuplicateTagName, TagNotFound } from "../modules/tags/tags.repo.ts";
import type { RequestContext } from "./context.ts";
import { testProvider } from "./provider-test.ts";

const base = implement(contract).$context<RequestContext>();

const requireSession = base.middleware(({ context, next }) => {
  if (!context.session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { session: context.session } });
});

const authed = base.use(requireSession);

function publishChange(ctx: RequestContext): void {
  const seq = ctx.services.db.get<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'server_seq'",
  )!.value;
  ctx.services.events.publish("event", { type: "changed", seq: Number(seq) });
  ctx.services.index.wake();
}

export const router = base.router({
  health: base.health.handler(() => ({ ok: true as const })),

  status: authed.status.handler(({ context }) => {
    const s = context.services;
    const jobs = s.db.get<{ pending: number; failed: number }>(
      "SELECT count(*) AS pending, sum(CASE WHEN attempts >= 8 THEN 1 ELSE 0 END) AS failed FROM index_jobs",
    )!;
    const notes = s.db.get<{ total: number; indexed: number }>(
      "SELECT count(*) AS total, sum(CASE WHEN indexed_version = version THEN 1 ELSE 0 END) AS indexed FROM notes WHERE deleted_at IS NULL",
    )!;
    return {
      db: "ok" as const,
      instanceId: s.instanceId,
      version: s.version,
      uptimeSec: Math.floor((Date.now() - s.startedAt) / 1000),
      index: {
        pending: jobs.pending,
        failed: jobs.failed ?? 0,
        indexedRatio: notes.total ? (notes.indexed ?? 0) / notes.total : 1,
      },
    };
  }),

  auth: {
    login: base.auth.login.handler(async ({ input, context, errors }) => {
      try {
        const { token, session } = await context.services.auth.login(
          input.password,
          context.ip,
          context.userAgent,
        );
        context.setSessionCookie(token);
        return { expiresAt: session.expiresAt };
      } catch (e) {
        if (e instanceof LockedOut)
          throw errors.TOO_MANY_REQUESTS({ data: { retryAfterSec: e.retryAfterSec } });
        throw errors.UNAUTHORIZED();
      }
    }),
    logout: base.auth.logout.handler(({ context }) => {
      if (context.session) context.services.auth.revoke(context.session.id);
      context.setSessionCookie(null);
      return { ok: true as const };
    }),
    session: base.auth.session.handler(({ context }) => ({
      authenticated: context.session !== null,
      expiresAt: context.session?.expiresAt ?? null,
    })),
    changePassword: authed.auth.changePassword.handler(async ({ input, context, errors }) => {
      if (!(await context.services.auth.verifyPassword(input.current))) throw errors.UNAUTHORIZED();
      try {
        await context.services.auth.setPassword(input.next);
      } catch (e) {
        if (e instanceof WeakPassword) throw errors.BAD_REQUEST({ data: { reason: e.reason } });
        throw e;
      }
      context.services.auth.revokeOthers(context.session.id);
      return { ok: true as const };
    }),
    sessions: authed.auth.sessions.handler(({ context }) =>
      context.services.auth.listSessions().map((s) => ({
        id: s.id.slice(0, 12),
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        userAgent: s.userAgent,
        current: s.id === context.session.id,
      })),
    ),
    revokeOthers: authed.auth.revokeOthers.handler(({ context }) => {
      context.services.auth.revokeOthers(context.session.id);
      return { ok: true as const };
    }),
  },

  notes: {
    list: authed.notes.list.handler(({ input, context }) =>
      context.services.notes.list(input.folderId, input.limit, input.offset),
    ),
    get: authed.notes.get.handler(({ input, context, errors }) => {
      const note = context.services.notes.get(input.id);
      if (!note) throw errors.NOT_FOUND();
      return note;
    }),
    create: authed.notes.create.handler(({ input, context, errors }) => {
      const s = context.services;
      if (input.folderId && !s.folders.get(input.folderId))
        throw errors.NOT_FOUND({ data: { entity: "folder" } });
      if (!s.tags.allExist(input.tagIds)) throw errors.NOT_FOUND({ data: { entity: "tag" } });
      const note = s.notes.create(input);
      publishChange(context);
      return note;
    }),
    update: authed.notes.update.handler(({ input, context, errors }) => {
      const s = context.services;
      if (input.folderId && !s.folders.get(input.folderId))
        throw errors.NOT_FOUND({ data: { entity: "folder" } });
      if (input.tagIds && !s.tags.allExist(input.tagIds))
        throw errors.NOT_FOUND({ data: { entity: "tag" } });
      try {
        const note = s.notes.update(input);
        publishChange(context);
        return note;
      } catch (e) {
        if (e instanceof NoteNotFound) throw errors.NOT_FOUND({ data: { entity: "note" } });
        if (e instanceof NoteConflict) throw errors.CONFLICT({ data: { current: e.current } });
        throw e;
      }
    }),
    delete: authed.notes.delete.handler(({ input, context, errors }) => {
      try {
        const note = context.services.notes.softDelete(input.id);
        publishChange(context);
        return note;
      } catch (e) {
        if (e instanceof NoteNotFound) throw errors.NOT_FOUND();
        throw e;
      }
    }),
    restore: authed.notes.restore.handler(({ input, context, errors }) => {
      try {
        const note = context.services.notes.restore(input.id);
        publishChange(context);
        return note;
      } catch (e) {
        if (e instanceof NoteNotFound) throw errors.NOT_FOUND();
        throw e;
      }
    }),
  },

  folders: {
    list: authed.folders.list.handler(({ context }) => context.services.folders.list()),
    create: authed.folders.create.handler(({ input, context, errors }) => {
      try {
        const folder = context.services.folders.create(input.name);
        publishChange(context);
        return folder;
      } catch (e) {
        if (e instanceof DuplicateFolderName)
          throw errors.CONFLICT({ data: { reason: "duplicate_name" } });
        if (e instanceof FolderLimitReached)
          throw errors.FORBIDDEN({ data: { reason: "folder_limit", limit: 20 } });
        throw e;
      }
    }),
    rename: authed.folders.rename.handler(({ input, context, errors }) => {
      const s = context.services;
      try {
        const folder = s.db.transaction(() => {
          const result = s.folders.rename(input.id, input.name);
          s.notes.refreshFtsMany(result.noteIds);
          s.notes.enqueueIndexMany(result.noteIds);
          return result.folder;
        });
        publishChange(context);
        return folder;
      } catch (e) {
        if (e instanceof FolderNotFound) throw errors.NOT_FOUND();
        if (e instanceof DuplicateFolderName)
          throw errors.CONFLICT({ data: { reason: "duplicate_name" } });
        throw e;
      }
    }),
    delete: authed.folders.delete.handler(({ input, context, errors }) => {
      const s = context.services;
      try {
        const folder = s.db.transaction(() => {
          const result = s.folders.softDelete(input.id);
          s.notes.refreshFtsMany(result.noteIds);
          s.notes.enqueueIndexMany(result.noteIds);
          return result.folder;
        });
        publishChange(context);
        return folder;
      } catch (e) {
        if (e instanceof FolderNotFound) throw errors.NOT_FOUND();
        throw e;
      }
    }),
    reorder: authed.folders.reorder.handler(({ input, context, errors }) => {
      try {
        const folders = context.services.folders.reorder(input.ids);
        publishChange(context);
        return folders;
      } catch (e) {
        if (e instanceof FolderOrderMismatch)
          throw errors.BAD_REQUEST({ data: { reason: "ids_mismatch" } });
        throw e;
      }
    }),
  },

  tags: {
    list: authed.tags.list.handler(({ context }) => context.services.tags.list()),
    create: authed.tags.create.handler(({ input, context, errors }) => {
      try {
        const tag = context.services.tags.create(input.name);
        publishChange(context);
        return tag;
      } catch (e) {
        if (e instanceof DuplicateTagName)
          throw errors.CONFLICT({ data: { existing: e.existing } });
        throw e;
      }
    }),
    rename: authed.tags.rename.handler(({ input, context, errors }) => {
      const s = context.services;
      try {
        const tag = s.db.transaction(() => {
          const result = s.tags.rename(input.id, input.name);
          s.notes.refreshFtsMany(result.noteIds);
          s.notes.enqueueIndexMany(result.noteIds);
          return result.tag;
        });
        publishChange(context);
        return tag;
      } catch (e) {
        if (e instanceof TagNotFound) throw errors.NOT_FOUND();
        if (e instanceof DuplicateTagName)
          throw errors.CONFLICT({ data: { existing: e.existing } });
        throw e;
      }
    }),
    delete: authed.tags.delete.handler(({ input, context, errors }) => {
      const s = context.services;
      try {
        const tag = s.db.transaction(() => {
          const result = s.tags.softDelete(input.id);
          s.notes.refreshFtsMany(result.noteIds);
          s.notes.enqueueIndexMany(result.noteIds);
          return result.tag;
        });
        publishChange(context);
        return tag;
      } catch (e) {
        if (e instanceof TagNotFound) throw errors.NOT_FOUND();
        throw e;
      }
    }),
  },

  index: {
    status: authed.index.status.handler(({ context }) => {
      const s = context.services;
      const jobs = s.db.get<{ pending: number; failed: number | null }>(
        "SELECT count(*) AS pending, sum(CASE WHEN attempts >= 8 THEN 1 ELSE 0 END) AS failed FROM index_jobs",
      )!;
      const notes = s.db.get<{ total: number; indexed: number | null }>(
        "SELECT count(*) AS total, sum(CASE WHEN indexed_version = version THEN 1 ELSE 0 END) AS indexed FROM notes WHERE deleted_at IS NULL",
      )!;
      return {
        ready: s.index.ready,
        pending: jobs.pending,
        failed: jobs.failed ?? 0,
        indexedRatio: notes.total ? (notes.indexed ?? 0) / notes.total : 1,
        progress: s.index.progress,
        embedding: {
          provider: s.settings.resolved().embedding.provider,
          model: s.settings.resolved().embedding.model,
          dims: s.index.dims,
          local: s.settings.resolved().embedding.provider === "local",
        },
      };
    }),
    rebuild: authed.index.rebuild.handler(({ context }) => {
      context.services.index.rebuild();
      return { ok: true as const };
    }),
  },

  search: {
    query: authed.search.query.handler(({ input, context }) =>
      context.services.search.search(input),
    ),
  },

  ask: {
    answer: authed.ask.answer.handler(async function* ({ input, context, errors, signal }) {
      const retryAfterSec = context.services.askLimiter.hit(context.session.id);
      if (retryAfterSec > 0) throw errors.TOO_MANY_REQUESTS({ data: { retryAfterSec } });
      try {
        yield* context.services.ask.answer(input, signal ?? new AbortController().signal);
      } catch (e) {
        if (e instanceof AskUnavailable) throw errors.SERVICE_UNAVAILABLE();
        throw e;
      }
    }),
  },

  import: {
    parse: authed.import.parse.handler(async ({ input, context, errors }) => {
      try {
        return await context.services.importer.parse(input.file);
      } catch (e) {
        if (e instanceof InvalidImportFile)
          throw errors.BAD_REQUEST({ data: { reason: e.message } });
        throw e;
      }
    }),
    bulk: authed.import.bulk.handler(async ({ input, context, errors }) => {
      try {
        const report = await context.services.importer.bulk(input.file);
        if (
          report.imported > 0 ||
          report.foldersCreated.length > 0 ||
          report.tagsCreated.length > 0
        )
          publishChange(context);
        return report;
      } catch (e) {
        if (e instanceof InvalidImportFile)
          throw errors.BAD_REQUEST({ data: { reason: e.message } });
        throw e;
      }
    }),
    export: authed.import.export.handler(({ input, context }) =>
      context.services.importer.export(input.folderId),
    ),
  },

  settings: {
    get: authed.settings.get.handler(({ context }) => context.services.settings.public()),
    update: authed.settings.update.handler(({ input, context }) =>
      context.services.settings.update(input),
    ),
    testProvider: authed.settings.testProvider.handler(({ input }) => testProvider(input)),
  },

  setup: {
    status: base.setup.status.handler(({ context }) => ({
      needsSetup: !context.services.auth.hasPassword(),
    })),
    complete: base.setup.complete.handler(async ({ input, context, errors }) => {
      const s = context.services;
      if (s.auth.hasPassword()) throw errors.CONFLICT();
      try {
        await s.auth.setPassword(input.password);
      } catch (e) {
        if (e instanceof WeakPassword) throw errors.BAD_REQUEST({ data: { reason: e.reason } });
        throw e;
      }
      s.settings.update(input.settings);
      return { ok: true as const };
    }),
  },

  sync: {
    events: authed.sync.events.handler(async function* ({ context, signal }) {
      for await (const event of context.services.events.subscribe("event", { signal })) {
        yield event;
      }
    }),
  },
});

export type AppRouter = typeof router;
