import { useEffect } from "react";

const owners = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

export const unsavedStore = {
  hasUnsaved: () => owners.size > 0,
  set(owner: string, dirty: boolean) {
    const before = owners.size;
    if (dirty) owners.add(owner);
    else owners.delete(owner);
    if (before !== owners.size) notify();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Registers unsaved work so background actions (like SW reloads) can wait for it. */
export function useUnsavedGuard(owner: string, dirty: boolean): void {
  useEffect(() => {
    unsavedStore.set(owner, dirty);
    return () => unsavedStore.set(owner, false);
  }, [owner, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
