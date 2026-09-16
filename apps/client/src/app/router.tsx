import { createBrowserRouter } from "react-router";
import { LoginPage } from "../features/auth/LoginPage.tsx";
import { NoteEditorPage } from "../features/notes/NoteEditorPage.tsx";
import { NotesPage } from "../features/notes/NotesPage.tsx";
import { AppShell } from "../shell/AppShell.tsx";
import { NotFoundPage } from "../shell/NotFoundPage.tsx";
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
          { path: "n/:noteId", Component: NoteEditorPage },
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
]);
