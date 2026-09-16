import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Contract } from "shared";
import { sessionStore } from "../session.ts";

const link = new RPCLink({
  url: `${window.location.origin}/api/rpc`,
  fetch: (request, init) => globalThis.fetch(request, { ...init, credentials: "same-origin" }),
  interceptors: [
    async (options) => {
      try {
        return await options.next();
      } catch (error) {
        if (error instanceof ORPCError && error.status === 401)
          sessionStore.set({ status: "anonymous" });
        throw error;
      }
    },
  ],
});

export const api: ContractRouterClient<Contract> = createORPCClient(link);
export const orpc = createTanstackQueryUtils(api);
