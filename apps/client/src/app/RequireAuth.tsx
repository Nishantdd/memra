import { Loading } from "@carbon/react";
import { useLiveQuery } from "dexie-react-hooks";
import { Navigate, Outlet, useLocation } from "react-router";
import { getMeta } from "../data/db.ts";
import { useSession } from "../data/session.ts";
import { useConnectivity } from "../data/sync/connectivity.ts";

export function RequireAuth() {
  const session = useSession();
  const { connectivity } = useConnectivity();
  const location = useLocation();
  const hasMirror = useLiveQuery(async () => (await getMeta<number>("cursor")) !== undefined, [], null);

  if (session.status === "authenticated") return <Outlet />;
  if (session.status === "anonymous" && connectivity !== "offline") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (hasMirror === null || (session.status === "unknown" && connectivity === "checking")) {
    return <Loading withOverlay description="Loading Memra" />;
  }
  if (hasMirror) return <Outlet />;
  return <Navigate to="/login" replace />;
}
