import { useQuery } from "@tanstack/react-query";
import type { IndexStatus } from "shared";
import { INDEX_STATUS_REFETCH_MS } from "../constants/index.ts";
import { orpc } from "./api/orpc.ts";
import { useSession } from "./session.ts";

export function useIndexStatus(): IndexStatus | undefined {
  const session = useSession();
  return useQuery(
    orpc.index.status.queryOptions({
      enabled: session.status === "authenticated",
      refetchInterval: INDEX_STATUS_REFETCH_MS,
      staleTime: 10_000,
    }),
  ).data;
}
