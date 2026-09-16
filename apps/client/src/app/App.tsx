import { GlobalTheme } from "@carbon/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { api } from "../data/api/orpc.ts";
import { sessionStore } from "../data/session.ts";
import { startConnectivityMonitor } from "../data/sync/connectivity.ts";
import { startSyncEngine, syncNow } from "../data/sync/engine.ts";
import { followSystemTheme, useTheme } from "../lib/theme.ts";
import { router } from "./router.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

async function resolveSession(): Promise<void> {
  try {
    const s = await api.auth.session();
    sessionStore.set(
      s.authenticated
        ? { status: "authenticated", expiresAt: s.expiresAt! }
        : { status: "anonymous" },
    );
  } catch {
    // Offline: keep "unknown" so protected routes render read-only from the local mirror.
  }
}

export function App() {
  const theme = useTheme();

  useEffect(() => {
    const stopSync = startSyncEngine();
    const stopConnectivity = startConnectivityMonitor(() => {
      void resolveSession().then(() => {
        if (sessionStore.get().status === "authenticated") void syncNow();
      });
    });
    const stopTheme = followSystemTheme();
    void resolveSession();
    return () => {
      stopSync();
      stopConnectivity();
      stopTheme();
    };
  }, []);

  return (
    <GlobalTheme theme={theme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </GlobalTheme>
  );
}
