import { createBrowserRouter } from "react-router";
import { LoginPage } from "../features/auth/LoginPage.tsx";
import { NotesPage } from "../features/notes/NotesPage.tsx";
import { AppShell } from "../shell/AppShell.tsx";
import { NotFoundPage } from "../shell/NotFoundPage.tsx";
import { Deferred, NoteEditorPage, SearchPage, SettingsPage } from "./lazyRoutes.tsx";
import { RequireAuth } from "./RequireAuth.tsx";

export const router = createBrowserRouter([
  { path: "/login", Component: LoginPage },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, Component: NotesPage },
          { path: "f/:folderId", Component: NotesPage },
          {
            Component: Deferred,
            children: [
              { path: "n/:noteId", Component: NoteEditorPage },
              { path: "search", Component: SearchPage },
              { path: "settings", Component: SettingsPage },
            ],
          },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
]);
