import { useSyncExternalStore } from "react";

export type SessionState =
  | { status: "unknown" }
  | { status: "authenticated"; expiresAt: number }
  | { status: "anonymous" };

let state: SessionState = { status: "unknown" };
const listeners = new Set<() => void>();

export const sessionStore = {
  get: () => state,
  set: (next: SessionState) => {
    state = next;
    for (const l of listeners) l();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
}
