import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "./lib/theme.ts";
import { App } from "./app/App.tsx";
import "./styles/index.scss";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
