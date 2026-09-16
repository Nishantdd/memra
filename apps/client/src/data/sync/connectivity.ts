import { useSyncExternalStore } from "react";

export type Connectivity = "online" | "offline" | "checking";
export type SyncActivity = "idle" | "syncing" | "error";

interface State {
  connectivity: Connectivity;
  activity: SyncActivity;
  lastSyncAt: number | null;
}

let state: State = { connectivity: navigator.onLine ? "checking" : "offline", activity: "idle", lastSyncAt: null };
const listeners = new Set<() => void>();

function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const connectivityStore = {
  get: () => state,
  set: update,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useConnectivity(): State {
  return useSyncExternalStore(connectivityStore.subscribe, connectivityStore.get, connectivityStore.get);
}

export async function probeHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/v1/health", { cache: "no-store", credentials: "same-origin" });
    const ok = res.ok;
    update({ connectivity: ok ? "online" : "offline" });
    return ok;
  } catch {
    update({ connectivity: "offline" });
    return false;
  }
}

let heartbeat: ReturnType<typeof setInterval> | null = null;

export function startConnectivityMonitor(onOnline: () => void): () => void {
  const handleOnline = () => {
    update({ connectivity: "checking" });
    void probeHealth().then((ok) => ok && onOnline());
  };
  const handleOffline = () => update({ connectivity: "offline" });
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  heartbeat = setInterval(() => {
    if (state.connectivity === "offline") void probeHealth().then((ok) => ok && onOnline());
  }, 30_000);
  void probeHealth().then((ok) => ok && onOnline());
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    if (heartbeat) clearInterval(heartbeat);
  };
}
