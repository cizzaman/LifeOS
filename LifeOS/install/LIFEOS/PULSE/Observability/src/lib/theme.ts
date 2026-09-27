"use client";

/**
 * Pulse themes — the Personal OS pair: «Dark» (charcoal ground, cream ink, teal)
 * and «Light yellow» (warm paper, cream panels, brown accent). The choice lives in
 * localStorage under THEME_KEY and on <html data-theme>. Tokens are in globals.css;
 * anything that paints outside CSS (canvas, graph libraries) reads them at draw
 * time and redraws on THEME_EVENT via useTheme().
 */

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

export { THEME_KEY };

export type Theme = "dark" | "light";
export const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light yellow" },
];
export const THEME_EVENT = "pulse-theme";

const valid = (value: unknown): Theme => (value === "light" ? "light" : "dark");

function apply(theme: Theme) {
  const d = document.documentElement;
  d.setAttribute("data-theme", theme);
  d.classList.toggle("dark", theme === "dark");
  d.style.colorScheme = theme;
}

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return valid(document.documentElement.getAttribute("data-theme"));
}

export function setTheme(theme: Theme) {
  apply(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode: the choice lasts this page */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Re-apply the stored theme after mount. A page React renders from scratch on the client
 * (a redirect lands on Next's error shell) rebuilds <html> without the pre-paint attributes.
 */
export function syncStoredTheme() {
  let stored: Theme = "dark";
  try { stored = valid(localStorage.getItem(THEME_KEY)); } catch { /* keep dark */ }
  if (getTheme() === stored && document.documentElement.classList.contains("dark") === (stored === "dark")) return;
  apply(stored);
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    apply(valid(e.newValue));
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The active theme; components that paint outside CSS put it in their redraw deps. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "dark");
}

/** Resolve a CSS custom property to its current value (for canvas and graph libraries). */
export function cssVar(name: string, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
