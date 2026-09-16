import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../../data/api/orpc.ts";
import { wipeLocalData } from "../../data/db.ts";
import { sessionStore } from "../../data/session.ts";

export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      await wipeLocalData();
      queryClient.clear();
      sessionStore.set({ status: "anonymous" });
    }
  }, [queryClient]);
}
