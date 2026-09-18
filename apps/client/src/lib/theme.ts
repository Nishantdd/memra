import { useSyncExternalStore } from "react";
import type { ContentTheme } from "shared";
import { THEME_STORAGE_KEY } from "../constants/index.ts";

export type { ContentTheme };

type ThemePreference = ContentTheme | "system";

const listeners = new Set<() => void>();

function resolveSystemTheme(): ContentTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "g100" : "g10";
}

function applyToDOM(theme: ContentTheme): void {
  document.documentElement.className = `cds--${theme}`;
  document.documentElement.dataset.theme = theme;
}

export function getTheme(): ContentTheme {
  return (document.documentElement.dataset.theme as ContentTheme | undefined) ?? "g10";
}

export function getPreference(): ThemePreference {
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null) ?? "system";
}

export function setTheme(preference: ThemePreference): void {
  if (preference === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY);
    applyToDOM(resolveSystemTheme());
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    applyToDOM(preference);
  }
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

export function initTheme(): void {
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ContentTheme | null;
  applyToDOM(stored ?? resolveSystemTheme());

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      applyToDOM(media.matches ? "g100" : "g10");
      for (const l of listeners) l();
    }
  });
}
