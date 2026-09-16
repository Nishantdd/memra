import { createBrowserRouter } from "react-router";
import { LoginPage } from "../features/auth/LoginPage.tsx";
import { NoteEditorPage } from "../features/notes/NoteEditorPage.tsx";
import { NotesPage } from "../features/notes/NotesPage.tsx";
import { SettingsPage } from "../features/settings/SettingsPage.tsx";
import { SetupPage } from "../features/setup/SetupPage.tsx";
import { AppShell } from "../shell/AppShell.tsx";
import { NotFoundPage } from "../shell/NotFoundPage.tsx";
import { RequireAuth } from "./RequireAuth.tsx";

export const router = createBrowserRouter([
  { path: "/setup", Component: SetupPage },
  { path: "/login", Component: LoginPage },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppShell,
        children: [
          { index: true, Component: NotesPage },
          { path: "f/:folderId", Component: NotesPage },
          { path: "n/:noteId", Component: NoteEditorPage },
          { path: "settings", Component: SettingsPage },
          { path: "settings/:tab", Component: SettingsPage },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
]);
