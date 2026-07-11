/**
 * Bias Noticer — Settings & secure-ish storage helpers
 *
 * API keys live in chrome.storage.local (not sync) so they are not
 * synced to Google account in plaintext across devices by default.
 * Still: never log keys; never commit them.
 */

import type { BiasType, ExtensionSettings, FeedbackEntry } from "./types";
import { ALL_BIAS_TYPES } from "./taxonomy";

/**
 * Default Grok model for brand-new installs.
 *
 * xAI chat API is pay-as-you-go (no unlimited free chat model). Among models
 * currently listed on api.x.ai, `grok-4.3` is the best default for new users:
 * widely available, strong quality, and cheaper than flagship `grok-4.5`.
 * Bump this when xAI retires/replaces the public catalog default.
 */
export const DEFAULT_MODEL = "grok-4.3";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: "",
  sensitivity: "balanced",
  enabledCategories: [...ALL_BIAS_TYPES],
  highlightStyle: "underline",
  highlightIntensity: 0.75,
  highlightPreset: "balanced",
  theme: "system",
  smartAutoScan: false,
  domainWhitelist: [],
  domainBlacklist: [],
  neverSendFullText: false,
  enableCache: true,
  cacheTtlHours: 72,
  optInTelemetry: false,
  customSystemPrompt: "",
  useCustomPrompt: false,
  onboardingComplete: false,
  enableShadesAnimation: true,
  hybridQuickScan: true,
  clusterPanel: true,
  minConfidence: 0,
  model: DEFAULT_MODEL,
};

/** Retired / redirected model ids → current default for new downloaders */
const MODEL_ALIASES: Record<string, string> = {
  "grok-2-latest": DEFAULT_MODEL,
  "grok-2": DEFAULT_MODEL,
  "grok-2-1212": DEFAULT_MODEL,
  "grok-beta": DEFAULT_MODEL,
  "grok-3": DEFAULT_MODEL,
  "grok-3-latest": DEFAULT_MODEL,
  "grok-3-mini": DEFAULT_MODEL,
  "grok-3-fast": DEFAULT_MODEL,
  "grok-3-mini-fast": DEFAULT_MODEL,
  "grok-4": DEFAULT_MODEL,
  "grok-4-latest": DEFAULT_MODEL,
  "grok-4-fast-non-reasoning": DEFAULT_MODEL,
  "grok-4-1-fast-non-reasoning": DEFAULT_MODEL,
};

export const RECOMMENDED_MODELS = [
  {
    id: DEFAULT_MODEL,
    label: "Grok 4.3 — default for new installs",
  },
  { id: "grok-4.5", label: "Grok 4.5 — flagship (higher cost)" },
  {
    id: "grok-4.20-0309-non-reasoning",
    label: "Grok 4.20 non-reasoning",
  },
  {
    id: "grok-4.20-0309-reasoning",
    label: "Grok 4.20 reasoning",
  },
] as const;

export function normalizeModelId(model: string | undefined): string {
  const m = (model || DEFAULT_MODEL).trim();
  if (MODEL_ALIASES[m]) return MODEL_ALIASES[m];
  return m || DEFAULT_MODEL;
}

const SETTINGS_KEY = "bn_settings";
const FEEDBACK_KEY = "bn_feedback";
const CACHE_PREFIX = "bn_cache_";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...stored };
  const normalized = normalizeModelId(merged.model);
  if (normalized !== merged.model) {
    merged.model = normalized;
    // Persist migration so the options UI and API stop using retired ids
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  }
  return merged;
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  // Never accidentally wipe apiKey if partial omits it
  const next: ExtensionSettings = { ...current, ...partial };
  if (partial.model !== undefined) {
    next.model = normalizeModelId(partial.model);
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function clearAllLocalData(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(
    (k) => k.startsWith("bn_") || k === SETTINGS_KEY || k === FEEDBACK_KEY
  );
  if (keys.length) await chrome.storage.local.remove(keys);
}

export async function addFeedback(
  entry: Omit<FeedbackEntry, "id" | "createdAt">
): Promise<FeedbackEntry> {
  const full: FeedbackEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const result = await chrome.storage.local.get(FEEDBACK_KEY);
  const list = (result[FEEDBACK_KEY] as FeedbackEntry[] | undefined) ?? [];
  list.push(full);
  // Cap local feedback history
  const trimmed = list.slice(-500);
  await chrome.storage.local.set({ [FEEDBACK_KEY]: trimmed });
  return full;
}

export async function getFeedback(): Promise<FeedbackEntry[]> {
  const result = await chrome.storage.local.get(FEEDBACK_KEY);
  return (result[FEEDBACK_KEY] as FeedbackEntry[] | undefined) ?? [];
}

export function cacheKey(url: string, contentHash: string): string {
  return `${CACHE_PREFIX}${hashString(url + "|" + contentHash)}`;
}

export interface CachedAnalysisEnvelope {
  analysis: unknown;
  savedAt: number;
}

/**
 * Load cached analysis if present and within TTL (hours).
 * Pass ttlHours = 0 or negative to skip expiry checks.
 */
export async function getCachedAnalysis(
  url: string,
  contentHash: string,
  ttlHours = 72
): Promise<CachedAnalysisEnvelope | null> {
  if (!url) return null;
  const key = cacheKey(url, contentHash);
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CachedAnalysisEnvelope | undefined;
  if (!entry?.analysis || !entry.savedAt) return null;
  if (ttlHours > 0) {
    const ageMs = Date.now() - entry.savedAt;
    if (ageMs > ttlHours * 3600 * 1000) {
      await chrome.storage.local.remove(key);
      return null;
    }
  }
  return entry;
}

export async function setCachedAnalysis(
  url: string,
  contentHash: string,
  analysis: unknown
): Promise<void> {
  const key = cacheKey(url, contentHash);
  await chrome.storage.local.set({
    [key]: { analysis, savedAt: Date.now() } satisfies CachedAnalysisEnvelope,
  });
  // Best-effort cache size control
  await pruneCache(40);
}

async function pruneCache(maxEntries: number): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith(CACHE_PREFIX))
    .map(([k, v]) => ({
      k,
      t: (v as { savedAt?: number })?.savedAt ?? 0,
    }))
    .sort((a, b) => b.t - a.t);
  if (entries.length <= maxEntries) return;
  const toRemove = entries.slice(maxEntries).map((e) => e.k);
  await chrome.storage.local.remove(toRemove);
}

/** Simple non-crypto string hash for cache keys (not security-sensitive). */
export function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function filterEnabledCategories(
  enabled: BiasType[],
  type: BiasType
): boolean {
  return enabled.includes(type);
}
