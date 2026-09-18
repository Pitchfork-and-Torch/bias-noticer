/**
 * Shared theme application for popup / options / side panel.
 */
import type { ThemeMode } from "./types";

export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("dark");
  document.body.classList.remove("theme-they-live");
  if (theme === "dark" || theme === "they_live") {
    root.classList.add("dark");
    if (theme === "they_live") document.body.classList.add("theme-they-live");
  } else if (theme === "system") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }
}
