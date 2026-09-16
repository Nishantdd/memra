import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../../data/api/orpc.ts";
import { wipeLocalData } from "../../data/db.ts";
import { clearOfflineIndex } from "../../data/search/offlineIndex.ts";
import { sessionStore } from "../../data/session.ts";

export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      await wipeLocalData();
      clearOfflineIndex();
      queryClient.clear();
      sessionStore.set({ status: "anonymous" });
    }
  }, [queryClient]);
}
