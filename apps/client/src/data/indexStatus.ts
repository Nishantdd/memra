import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { IndexStatus } from "shared";
import { INDEX_STATUS_REFETCH_MS } from "../constants/index.ts";
import { orpc } from "./api/orpc.ts";
import { useSession } from "./session.ts";
import { useConnectivity } from "./sync/connectivity.ts";
import { indexEvents } from "./sync/engine.ts";

export function useIndexStatus(): IndexStatus | undefined {
  const session = useSession();
  const { connectivity } = useConnectivity();
  const queryClient = useQueryClient();
  const options = orpc.index.status.queryOptions({
    enabled: session.status === "authenticated" && connectivity !== "offline",
    refetchInterval: INDEX_STATUS_REFETCH_MS,
    staleTime: 10_000,
  });
  const query = useQuery(options);

  useEffect(() => {
    return indexEvents.subscribe(
      () => void queryClient.invalidateQueries({ queryKey: options.queryKey }),
    );
  }, [queryClient, options.queryKey]);

  return query.data;
}
