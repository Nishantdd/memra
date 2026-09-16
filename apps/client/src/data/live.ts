import type { QueryClient } from "@tanstack/react-query";
import { EVENTS_RECONNECT_MS } from "../constants/index.ts";
import { api, orpc } from "./api/orpc.ts";
import { noteKeys } from "./queries.ts";
import { sessionStore } from "./session.ts";

/** Keeps queries fresh from the server event stream while a session is active. */
export function startLiveUpdates(queryClient: QueryClient): () => void {
  let controller: AbortController | null = null;
  let stopped = false;

  const listen = async () => {
    controller?.abort();
    const own = new AbortController();
    controller = own;
    try {
      const iterator = await api.sync.events(undefined, { signal: own.signal });
      for await (const event of iterator) {
        if (event.type === "changed") {
          void queryClient.invalidateQueries({ queryKey: noteKeys.all() });
          void queryClient.invalidateQueries({ queryKey: noteKeys.folders() });
          void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
        } else {
          void queryClient.invalidateQueries({ queryKey: orpc.index.status.key() });
          if (event.type === "indexed")
            void queryClient.invalidateQueries({ queryKey: noteKeys.note(event.noteId) });
        }
      }
    } catch {
      // Dropped connection; retried below.
    }
    if (!own.signal.aborted && !stopped && sessionStore.get().status === "authenticated") {
      setTimeout(() => void listen(), EVENTS_RECONNECT_MS);
    }
  };

  const unsubscribe = sessionStore.subscribe(() => {
    if (sessionStore.get().status === "authenticated") void listen();
    else controller?.abort();
  });
  if (sessionStore.get().status === "authenticated") void listen();

  return () => {
    stopped = true;
    unsubscribe();
    controller?.abort();
  };
}
