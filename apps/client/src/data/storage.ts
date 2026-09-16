import { useQuery } from "@tanstack/react-query";

export interface StorageInfo {
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

let persistRequested = false;

/** Asks the browser to protect IndexedDB from eviction; safe to call repeatedly. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!("storage" in navigator) || !navigator.storage.persist) return null;
  if (!persistRequested) {
    persistRequested = true;
    try {
      return await navigator.storage.persist();
    } catch {
      return null;
    }
  }
  return navigator.storage.persisted();
}

export async function readStorageInfo(): Promise<StorageInfo> {
  if (!("storage" in navigator)) return { persisted: null, usageBytes: null, quotaBytes: null };
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted?.() ?? Promise.resolve(null),
    navigator.storage.estimate?.() ?? Promise.resolve(undefined),
  ]);
  return { persisted, usageBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null };
}

export function useStorageInfo() {
  return useQuery({ queryKey: ["storage-info"], queryFn: readStorageInfo, staleTime: 30_000 });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
