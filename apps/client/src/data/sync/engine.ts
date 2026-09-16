import { ORPCError } from "@orpc/client";
import type { EntityTable } from "dexie";
import type { Folder, Note, SyncPage, Tag } from "shared";
import { api } from "../api/orpc.ts";
import { db, getMeta, setMeta, wipeLocalData } from "../db.ts";
import { sessionStore } from "../session.ts";
import { connectivityStore } from "./connectivity.ts";

const LOCK = "memra-sync";
const MAX_BACKOFF_MS = 60_000;

let scheduled = false;
let running = false;
let backoffMs = 1000;
let eventsAbort: AbortController | null = null;

async function applyPage(page: SyncPage): Promise<void> {
  await db.transaction("rw", [db.folders, db.tags, db.notes, db.meta], async () => {
    await upsertOrDelete(db.folders, page.folders);
    await upsertOrDelete(db.tags, page.tags);
    await upsertOrDelete(db.notes, page.notes);
    await setMeta("cursor", page.cursor);
  });
}

async function upsertOrDelete<T extends { id: string; deletedAt: number | null }>(
  table: EntityTable<T, "id">,
  rows: T[],
): Promise<void> {
  const live = rows.filter((r) => r.deletedAt === null);
  const dead = rows.filter((r) => r.deletedAt !== null).map((r) => r.id);
  if (live.length) await table.bulkPut(live);
  if (dead.length)
    await (table as unknown as { bulkDelete(keys: string[]): Promise<void> }).bulkDelete(dead);
}

async function pullAll(): Promise<number> {
  let cursor = (await getMeta<number>("cursor")) ?? 0;
  let applied = 0;
  for (;;) {
    let page: SyncPage;
    try {
      page = await api.sync.pull({ cursor });
    } catch (error) {
      if (error instanceof ORPCError && error.code === "GONE") {
        await wipeLocalData();
        cursor = 0;
        continue;
      }
      throw error;
    }
    await applyPage(page);
    applied += page.folders.length + page.tags.length + page.notes.length;
    cursor = page.cursor;
    if (!page.hasMore) return applied;
  }
}

export async function syncNow(): Promise<number> {
  if (running) {
    scheduled = true;
    return 0;
  }
  running = true;
  connectivityStore.set({ activity: "syncing" });
  try {
    const applied = await navigator.locks.request(LOCK, { ifAvailable: true }, async (lock) => {
      if (!lock) return 0;
      const status = await api.status();
      const knownInstance = await getMeta<string>("instanceId");
      if (knownInstance && knownInstance !== status.instanceId) await wipeLocalData();
      await setMeta("instanceId", status.instanceId);
      return pullAll();
    });
    backoffMs = 1000;
    connectivityStore.set({ activity: "idle", lastSyncAt: Date.now(), connectivity: "online" });
    return applied;
  } catch (error) {
    if (error instanceof ORPCError && error.status === 401) {
      connectivityStore.set({ activity: "idle" });
      return 0;
    }
    connectivityStore.set({ activity: "error" });
    if (!(error instanceof ORPCError)) connectivityStore.set({ connectivity: "offline" });
    setTimeout(() => void syncNow(), backoffMs);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    return 0;
  } finally {
    running = false;
    if (scheduled) {
      scheduled = false;
      void syncNow();
    }
  }
}

async function listenForEvents(): Promise<void> {
  eventsAbort?.abort();
  const controller = new AbortController();
  eventsAbort = controller;
  try {
    const iterator = await api.sync.events(undefined, { signal: controller.signal });
    connectivityStore.set({ connectivity: "online" });
    for await (const event of iterator) {
      if (event.type === "changed") void syncNow();
    }
  } catch {
    // Connection dropped; the connectivity monitor decides when to reconnect.
  } finally {
    if (eventsAbort === controller) eventsAbort = null;
  }
  if (!controller.signal.aborted) connectivityStore.set({ connectivity: "offline" });
}

export function startSyncEngine(): () => void {
  const onVisible = () => document.visibilityState === "visible" && void syncNow();
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(() => void syncNow(), 60_000);

  const unsubscribe = sessionStore.subscribe(() => {
    const s = sessionStore.get();
    if (s.status === "authenticated") {
      void syncNow();
      void listenForEvents();
    } else if (s.status === "anonymous") {
      eventsAbort?.abort();
    }
  });

  const unsubscribeConnectivity = connectivityStore.subscribe(() => {
    const { connectivity } = connectivityStore.get();
    if (
      connectivity === "online" &&
      sessionStore.get().status === "authenticated" &&
      !eventsAbort
    ) {
      void listenForEvents();
    }
  });

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
    unsubscribe();
    unsubscribeConnectivity();
    eventsAbort?.abort();
  };
}

export async function applyServerRow(kind: "note", row: Note): Promise<void>;
export async function applyServerRow(kind: "folder", row: Folder): Promise<void>;
export async function applyServerRow(kind: "tag", row: Tag): Promise<void>;
export async function applyServerRow(
  kind: "note" | "folder" | "tag",
  row: Note | Folder | Tag,
): Promise<void> {
  const table = kind === "note" ? db.notes : kind === "folder" ? db.folders : db.tags;
  if (row.deletedAt !== null) await table.delete(row.id);
  else await (table as { put(r: typeof row): Promise<unknown> }).put(row);
}
