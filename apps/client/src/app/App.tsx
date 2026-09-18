import { GlobalTheme } from "@carbon/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { api } from "../data/api/orpc.ts";
import { startLiveUpdates } from "../data/live.ts";
import { sessionStore } from "../data/session.ts";
import { applyServerTheme, followSystemTheme, useTheme } from "../lib/theme.ts";
import { router } from "./router.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

async function resolveSession(): Promise<void> {
  try {
    const s = await api.auth.session();
    if (s.authenticated) {
      sessionStore.set({ status: "authenticated", expiresAt: s.expiresAt! });
      try {
        const settings = await api.settings.get();
        applyServerTheme(settings.appearance.theme);
      } catch {}
    } else {
      sessionStore.set({ status: "anonymous" });
    }
  } catch {
    sessionStore.set({ status: "anonymous" });
  }
}

export function App() {
  const theme = useTheme();

  useEffect(() => {
    const stopLive = startLiveUpdates(queryClient);
    const stopTheme = followSystemTheme();
    void resolveSession();
    return () => {
      stopLive();
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
