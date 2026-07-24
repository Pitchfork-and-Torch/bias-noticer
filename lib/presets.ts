/**
 * Bias Noticer — Curated highlight / appearance presets
 *
 * Keeps Settings simple: pick Minimal / Balanced / They Live Retro,
 * or fall through to fully custom style + intensity.
 */

import type { HighlightPreset, HighlightStyle, ThemeMode } from "./types";

export interface PresetConfig {
  id: HighlightPreset;
  label: string;
  description: string;
  highlightStyle: HighlightStyle;
  highlightIntensity: number;
  /** Optional theme suggestion when applying the preset */
  themeHint?: ThemeMode;
}

export const HIGHLIGHT_PRESETS: Record<
  Exclude<HighlightPreset, "custom">,
  PresetConfig
> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Wavy underline, low intensity — least visual noise.",
    highlightStyle: "underline",
    highlightIntensity: 0.45,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Soft tint at medium strength — readable on long articles.",
    highlightStyle: "tint",
    highlightIntensity: 0.75,
  },
  they_live: {
    id: "they_live",
    label: "They Live Retro",
    description: "Cyan glow + retro theme accents for the full shades feel.",
    highlightStyle: "glow",
    highlightIntensity: 0.85,
    themeHint: "they_live",
  },
};

export function resolvePreset(
  preset: HighlightPreset,
  style: HighlightStyle,
  intensity: number
): { highlightStyle: HighlightStyle; highlightIntensity: number } {
  if (preset === "custom" || !HIGHLIGHT_PRESETS[preset as keyof typeof HIGHLIGHT_PRESETS]) {
    return { highlightStyle: style, highlightIntensity: intensity };
  }
  const p = HIGHLIGHT_PRESETS[preset as keyof typeof HIGHLIGHT_PRESETS];
  return {
    highlightStyle: p.highlightStyle,
    highlightIntensity: p.highlightIntensity,
  };
}
