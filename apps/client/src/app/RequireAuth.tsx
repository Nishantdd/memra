import { Loading } from "@carbon/react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "../data/session.ts";

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.status === "unknown")
    return <Loading small withOverlay={false} description="Loading Memra" />;
  if (session.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
