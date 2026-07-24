/**
 * In-memory tab analysis store (service worker).
 * Persists across messages within a SW lifetime; durable cache is in storage.ts.
 */

import type { AnalysisProgress, BiasAnalysis } from "./types";

const byTab = new Map<
  number,
  {
    analysis: BiasAnalysis | null;
    progress: AnalysisProgress;
  }
>();

export function setTabAnalysis(tabId: number, analysis: BiasAnalysis | null) {
  const prev = byTab.get(tabId);
  byTab.set(tabId, {
    analysis,
    progress: prev?.progress ?? { stage: "done" },
  });
}

export function getTabAnalysis(tabId: number): BiasAnalysis | null {
  return byTab.get(tabId)?.analysis ?? null;
}

export function setTabProgress(tabId: number, progress: AnalysisProgress) {
  const prev = byTab.get(tabId);
  byTab.set(tabId, {
    analysis: prev?.analysis ?? null,
    progress,
  });
}

export function getTabProgress(tabId: number): AnalysisProgress {
  return byTab.get(tabId)?.progress ?? { stage: "idle" };
}

export function clearTab(tabId: number) {
  byTab.delete(tabId);
}
