import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "../constants/index.ts";

export type ContentTheme = "white" | "g10" | "g90" | "g100";
const listeners = new Set<() => void>();

export function getTheme(): ContentTheme {
  return (document.documentElement.dataset.theme as ContentTheme | undefined) ?? "g10";
}

export function setTheme(theme: ContentTheme, persist = true): void {
  document.documentElement.className = `cds--${theme}`;
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, theme);
  for (const l of listeners) l();
}

export function isDarkTheme(theme: ContentTheme): boolean {
  return theme === "g90" || theme === "g100";
}

export function useTheme(): ContentTheme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTheme,
    getTheme,
  );
}

export function followSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) setTheme(media.matches ? "g100" : "g10", false);
  };
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
}
