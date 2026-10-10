"use client";
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "settleng-theme";

/** The inline script in app/layout.tsx runs this same logic before paint to avoid a flash. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readStored(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

/** Explicit choice if made; otherwise follow the operating system preference. */
export function initialTheme(): Theme {
  const stored = readStored();
  if (stored) return stored;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
    return "dark";
  return "light";
}

export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage may be unavailable (private mode); still apply for this page load */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current theme plus a setter. Backed by an external store (not context) so the toggle works on any
 * page — landing, auth or app — without wrapping the tree in a provider. The server snapshot is
 * "light"; after hydration it resolves to the stored or system preference.
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const theme = useSyncExternalStore(
    subscribe,
    () => initialTheme(),
    () => "light" as Theme,
  );
  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
