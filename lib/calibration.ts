/**
 * Local personal calibration from user feedback.
 * Never leaves the device. Gently adjusts confidence floors / severity.
 */

import type { BiasType, FeedbackEntry, FeedbackKind } from "./types";
import { ALL_BIAS_TYPES } from "./taxonomy";

const CALIBRATION_KEY = "bn_calibration";

export interface TypeCalibration {
  type: BiasType;
  /** Net: wrong/too_strong decrease, missed/too_weak increase */
  severityBias: number; // -1.5 … +1.5
  confidenceFloorDelta: number; // -0.15 … +0.15
  samples: number;
}

export interface CalibrationStore {
  byType: Partial<Record<BiasType, TypeCalibration>>;
  totalFeedback: number;
  updatedAt: string;
}

export function emptyCalibration(): CalibrationStore {
  return {
    byType: {},
    totalFeedback: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadCalibration(): Promise<CalibrationStore> {
  try {
    const res = await chrome.storage.local.get(CALIBRATION_KEY);
    const raw = res[CALIBRATION_KEY] as CalibrationStore | undefined;
    if (!raw || typeof raw !== "object") return emptyCalibration();
    return {
      ...emptyCalibration(),
      ...raw,
      byType: raw.byType || {},
    };
  } catch {
    return emptyCalibration();
  }
}

export async function saveCalibration(
  store: CalibrationStore
): Promise<CalibrationStore> {
  const next = { ...store, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [CALIBRATION_KEY]: next });
  return next;
}

function kindFromEntry(entry: Omit<FeedbackEntry, "id" | "createdAt"> | FeedbackEntry): FeedbackKind {
  if (entry.kind) return entry.kind;
  return entry.helpful ? "helpful" : "wrong";
}

/**
 * Update type-level calibration from one feedback event.
 * Conservative steps so a few marks cannot flip the detector.
 */
export async function applyFeedbackToCalibration(
  entry: Omit<FeedbackEntry, "id" | "createdAt"> | FeedbackEntry
): Promise<CalibrationStore> {
  const store = await loadCalibration();
  const type = entry.biasType;
  if (!ALL_BIAS_TYPES.includes(type)) return store;

  const prev: TypeCalibration = store.byType[type] ?? {
    type,
    severityBias: 0,
    confidenceFloorDelta: 0,
    samples: 0,
  };

  const kind = kindFromEntry(entry);
  let severityBias = prev.severityBias;
  let confidenceFloorDelta = prev.confidenceFloorDelta;

  switch (kind) {
    case "wrong":
      severityBias -= 0.15;
      confidenceFloorDelta += 0.02;
      break;
    case "too_strong":
      severityBias -= 0.1;
      confidenceFloorDelta += 0.015;
      break;
    case "too_weak":
      severityBias += 0.08;
      confidenceFloorDelta -= 0.01;
      break;
    case "missed":
      severityBias += 0.05;
      confidenceFloorDelta -= 0.015;
      break;
    case "helpful":
    default:
      // Mild positive reinforcement — keep floors stable
      break;
  }

  severityBias = clamp(severityBias, -1.5, 1.5);
  confidenceFloorDelta = clamp(confidenceFloorDelta, -0.15, 0.15);

  store.byType[type] = {
    type,
    severityBias,
    confidenceFloorDelta,
    samples: prev.samples + 1,
  };
  store.totalFeedback += 1;
  return saveCalibration(store);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Apply calibration to instances (severity nudge + optional drop).
 * Prefer under-flagging: wrong/too_strong marks raise the bar.
 */
export function applyCalibrationToInstances<
  T extends {
    bias_type: BiasType;
    severity: 1 | 2 | 3 | 4 | 5;
    confidence: number;
  },
>(instances: T[], store: CalibrationStore, enabled: boolean): T[] {
  if (!enabled || store.totalFeedback === 0) return instances;

  return instances
    .map((inst) => {
      const cal = store.byType[inst.bias_type];
      if (!cal || cal.samples < 2) return inst;

      let severity = inst.severity + cal.severityBias;
      severity = Math.round(clamp(severity, 1, 5));
      let confidence = inst.confidence;
      // If user often marks this type wrong, require higher confidence
      const floor = 0.35 + cal.confidenceFloorDelta;
      if (confidence < floor) {
        return null;
      }
      return {
        ...inst,
        severity: severity as 1 | 2 | 3 | 4 | 5,
        confidence,
      };
    })
    .filter((x): x is T => Boolean(x));
}

export function calibrationSummary(store: CalibrationStore): string {
  const types = Object.values(store.byType).filter((t) => t && t.samples > 0);
  if (!types.length) {
    return "No local calibration yet. Mark flags as wrong / too strong / helpful in Feedback to tune thresholds on this device only.";
  }
  const top = types
    .sort((a, b) => (b?.samples ?? 0) - (a?.samples ?? 0))
    .slice(0, 5)
    .map(
      (t) =>
        `${t!.type}: n=${t!.samples}, sevΔ=${t!.severityBias.toFixed(2)}, floorΔ=${t!.confidenceFloorDelta.toFixed(2)}`
    );
  return `Local calibration from ${store.totalFeedback} marks. ${top.join("; ")}.`;
}
