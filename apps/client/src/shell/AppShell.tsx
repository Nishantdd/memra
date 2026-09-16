import { Content, InlineNotification } from "@carbon/react";
import { Outlet } from "react-router";
import { useConnectivity } from "../data/sync/connectivity.ts";
import { AppHeader } from "./AppHeader.tsx";
import { UpdatePrompt } from "./UpdatePrompt.tsx";

export function AppShell() {
  const { connectivity } = useConnectivity();

  return (
    <>
      <AppHeader />
      <Content id="main-content" className="memra-content">
        {connectivity === "offline" && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            className="memra-offline-banner"
            title="You're offline."
            subtitle="Notes are read-only until you reconnect."
          />
        )}
        <Outlet />
      </Content>
      <UpdatePrompt />
    </>
  );
}
