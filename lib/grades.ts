/**
 * Letter grades for outlet / article neutrality scores (0–100).
 * Higher neutrality = higher grade (less biased framing load).
 */

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
