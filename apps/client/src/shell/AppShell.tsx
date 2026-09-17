import { Content } from "@carbon/react";
import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader.tsx";
import { LeaveGuard } from "./LeaveGuard.tsx";

export function AppShell() {
  return (
    <>
      <AppHeader />
      <Content id="main-content">
        <Outlet />
      </Content>
      <LeaveGuard />
    </>
  );
}
