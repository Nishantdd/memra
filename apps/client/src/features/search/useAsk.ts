import { ORPCError } from "@orpc/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AskEvent, AskSource } from "shared";
import { api } from "../../data/api/orpc.ts";

export type AskStatus =
  | "idle"
  | "retrieving"
  | "streaming"
  | "done"
  | "insufficient"
  | "error"
  | "unavailable"
  | "rate-limited";

export interface AskState {
  status: AskStatus;
  text: string;
  sources: AskSource[];
  meta: Extract<AskEvent, { type: "meta" }> | null;
  errorMessage: string | null;
  retryAfterSec: number | null;
  cached: boolean;
}

const initial: AskState = {
  status: "idle",
  text: "",
  sources: [],
  meta: null,
  errorMessage: null,
  retryAfterSec: null,
  cached: false,
};

export function useAsk(q: string, folderId: string | null, enabled: boolean) {
  const [state, setState] = useState<AskState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || !q) return;
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    const update = (patch: Partial<AskState> | ((s: AskState) => AskState)) => {
      if (!cancelled)
        setState((s) => (typeof patch === "function" ? patch(s) : { ...s, ...patch }));
    };

    update({ ...initial, status: "retrieving" });
    void (async () => {
      try {
        const iterator = await api.ask.answer({ q, folderId }, { signal: controller.signal });
        for await (const event of iterator) {
          if (controller.signal.aborted) break;
          switch (event.type) {
            case "meta":
              update({ status: "streaming", meta: event, sources: event.sources });
              break;
            case "delta":
              update((s) => ({ ...s, text: s.text + event.text }));
              break;
            case "done":
              update({ status: "done", cached: event.cached });
              break;
            case "insufficient":
              update({ status: "insufficient" });
              break;
            case "error":
              update({ status: "error", errorMessage: event.message });
              break;
          }
        }
        update((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
      } catch (error) {
        if (controller.signal.aborted)
          return update((s) => (s.status === "streaming" ? { ...s, status: "done" } : s));
        if (error instanceof ORPCError && error.code === "TOO_MANY_REQUESTS") {
          const data = error.data as { retryAfterSec?: number } | undefined;
          return update({ status: "rate-limited", retryAfterSec: data?.retryAfterSec ?? null });
        }
        if (error instanceof ORPCError && error.code === "SERVICE_UNAVAILABLE")
          return update({ status: "unavailable" });
        update({
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [q, folderId, enabled]);

  return { ...state, stop };
}
