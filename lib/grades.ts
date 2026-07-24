/**
 * Letter grades for outlet / article neutrality scores (0–100).
 * Higher neutrality = higher grade (less biased framing load).
 *
 * v2: severity- and confidence-weighted calibrated neutrality helpers.
 */

import type { BiasInstance, ContentType } from "./types";

export type LetterGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D+"
  | "D"
  | "D-"
  | "F";

export interface GradeInfo {
  grade: LetterGrade;
  /** Short label for UI */
  label: string;
  /** Tailwind-ish tone for badges */
  tone: "excellent" | "good" | "mixed" | "poor" | "bad";
  /** CSS color hint */
  color: string;
}

/** Map 0–100 neutrality → letter grade */
export function neutralityToGrade(score: number): GradeInfo {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  if (s >= 97) return { grade: "A+", label: "Exceptionally even", tone: "excellent", color: "#059669" };
  if (s >= 93) return { grade: "A", label: "Very even", tone: "excellent", color: "#10b981" };
  if (s >= 90) return { grade: "A-", label: "Mostly even", tone: "excellent", color: "#34d399" };
  if (s >= 87) return { grade: "B+", label: "Light framing", tone: "good", color: "#65a30d" };
  if (s >= 83) return { grade: "B", label: "Some framing", tone: "good", color: "#84cc16" };
  if (s >= 80) return { grade: "B-", label: "Noticeable framing", tone: "good", color: "#a3e635" };
  if (s >= 77) return { grade: "C+", label: "Mixed", tone: "mixed", color: "#ca8a04" };
  if (s >= 73) return { grade: "C", label: "Mixed / lean", tone: "mixed", color: "#eab308" };
  if (s >= 70) return { grade: "C-", label: "Clear lean", tone: "mixed", color: "#f59e0b" };
  if (s >= 67) return { grade: "D+", label: "Heavy framing", tone: "poor", color: "#ea580c" };
  if (s >= 63) return { grade: "D", label: "Strong bias signals", tone: "poor", color: "#f97316" };
  if (s >= 60) return { grade: "D-", label: "Very heavy signals", tone: "poor", color: "#fb923c" };
  return { grade: "F", label: "Extreme bias signals", tone: "bad", color: "#e11d48" };
}

export function gradeLegend(): Array<{ grade: LetterGrade; range: string }> {
  return [
    { grade: "A+", range: "97–100" },
    { grade: "A", range: "93–96" },
    { grade: "A-", range: "90–92" },
    { grade: "B+", range: "87–89" },
    { grade: "B", range: "83–86" },
    { grade: "B-", range: "80–82" },
    { grade: "C+", range: "77–79" },
    { grade: "C", range: "73–76" },
    { grade: "C-", range: "70–72" },
    { grade: "D+", range: "67–69" },
    { grade: "D", range: "63–66" },
    { grade: "D-", range: "60–62" },
    { grade: "F", range: "0–59" },
  ];
}

/**
 * Preferred score for UI grades: calibrated when present.
 */
export function displayNeutrality(summary: {
  neutrality_score: number;
  calibrated_neutrality?: number;
}): number {
  if (
    typeof summary.calibrated_neutrality === "number" &&
    !Number.isNaN(summary.calibrated_neutrality)
  ) {
    return Math.max(0, Math.min(100, summary.calibrated_neutrality));
  }
  return Math.max(0, Math.min(100, summary.neutrality_score));
}

/**
 * Severity- and confidence-weighted framing load → neutrality 0–100.
 * Blends with the model’s raw score so we do not ignore genre judgment.
 *
 * load = sum(severity * confidence * voiceWeight)
 * voiceWeight: quoted material counts less (speaker vs author).
 */
export function computeCalibratedNeutrality(
  instances: BiasInstance[],
  modelScore: number
): number {
  const raw = Math.max(0, Math.min(100, Number(modelScore) || 50));
  if (!instances.length) {
    // Empty detections: trust model / lean high if model also high
    return Math.round(raw * 0.35 + 78 * 0.65);
  }

  let load = 0;
  for (const i of instances) {
    if (i.verification === "rejected") continue;
    const conf = Math.max(0.2, Math.min(1, i.confidence));
    const sev = Math.max(1, Math.min(5, i.severity));
    let voiceW = 1;
    if (i.voice === "quoted") voiceW = 0.55;
    else if (i.voice === "mixed") voiceW = 0.8;
    // Downgraded flags count less
    const verW = i.verification === "downgraded" ? 0.7 : 1;
    load += sev * conf * voiceW * verW;
  }

  // Soft saturation: ~15 high-severity units → heavy penalty
  const penalty = Math.min(70, (load / 15) * 55);
  const fromLoad = 100 - penalty;
  // Blend: respect model overview but let instance load pull hard when dense
  const blended = fromLoad * 0.55 + raw * 0.45;
  return Math.round(Math.max(0, Math.min(100, blended)));
}

/**
 * Genre-aware nudge: opinion/satire should not be graded like hard news.
 * We raise neutrality slightly (less punitive) for labeled opinion/satire.
 */
export function applyContentTypeNeutralityNudge(
  score: number,
  contentType: ContentType | undefined
): number {
  const s = Math.max(0, Math.min(100, score));
  switch (contentType) {
    case "satire":
      return Math.min(100, Math.round(s + 12));
    case "opinion":
      return Math.min(100, Math.round(s + 6));
    case "press_release":
      return Math.max(0, Math.round(s - 4)); // promotional expectation
    case "academic":
    case "legal":
      return Math.min(100, Math.round(s + 3));
    default:
      return s;
  }
}
