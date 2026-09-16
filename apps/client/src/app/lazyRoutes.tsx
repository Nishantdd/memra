import { Loading } from "@carbon/react";
import { lazy, Suspense } from "react";
import { Outlet } from "react-router";

export const NoteEditorPage = lazy(() =>
  import("../features/notes/NoteEditorPage.tsx").then((m) => ({ default: m.NoteEditorPage })),
);
export const SearchPage = lazy(() =>
  import("../features/search/SearchPage.tsx").then((m) => ({ default: m.SearchPage })),
);
export const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage.tsx").then((m) => ({ default: m.SettingsPage })),
);

export function Deferred() {
  return (
    <Suspense fallback={<Loading withOverlay={false} small description="Loading" />}>
      <Outlet />
    </Suspense>
  );
}
