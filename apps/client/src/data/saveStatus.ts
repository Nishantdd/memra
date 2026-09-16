import { useEffect, useSyncExternalStore } from "react";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

const owners = new Map<string, SaveStatus>();
const listeners = new Set<() => void>();
let snapshot: SaveStatus = "saved";

const PRIORITY: SaveStatus[] = ["error", "saving", "unsaved", "saved"];

function recompute() {
  const next = PRIORITY.find((s) => [...owners.values()].includes(s)) ?? "saved";
  if (next !== snapshot) {
    snapshot = next;
    for (const l of listeners) l();
  }
}

export const saveStatusStore = {
  get: () => snapshot,
  set(owner: string, status: SaveStatus | null) {
    if (status === null || status === "saved") owners.delete(owner);
    else owners.set(owner, status);
    recompute();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(saveStatusStore.subscribe, saveStatusStore.get, saveStatusStore.get);
}

/** Reports an editor's save state to the header indicator and warns before leaving with unsaved work. */
export function useReportSaveStatus(owner: string, status: SaveStatus): void {
  useEffect(() => {
    saveStatusStore.set(owner, status);
    return () => saveStatusStore.set(owner, null);
  }, [owner, status]);

  useEffect(() => {
    if (status !== "unsaved" && status !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);
}
