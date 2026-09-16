import { Content } from "@carbon/react";
import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader.tsx";

export function AppShell() {
  return (
    <>
      <AppHeader />
      <Content id="main-content" className="memra-content">
        <Outlet />
      </Content>
    </>
  );
}
