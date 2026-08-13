/**
 * Personal media-diet summary — fully local from outlet scan history.
 * No full article bodies; patterns only.
 */

import {
  getOutletBoard,
  type ArticleScan,
  type SiteRating,
} from "./site-cache";
import { neutralityToGrade, type LetterGrade } from "./grades";
import { getCategoryMeta } from "./taxonomy";

export interface MediaDietOutletSlice {
  host: string;
  samples: number;
  avgNeutrality: number;
  grade: LetterGrade;
  topTypes: string[];
  sharePct: number;
}

export interface MediaDietSummary {
  generatedAt: string;
  totalScans: number;
  outletCount: number;
  journalistCount: number;
  globalAvgNeutrality: number | null;
  globalGrade: LetterGrade | null;
  /** Outlets that dominate the user's recent diet */
  topOutlets: MediaDietOutletSlice[];
  /** Techniques that recur across the diet */
  recurringTechniques: Array<{ type: string; label: string; count: number }>;
  /** Simple pattern lines (local only) */
  insights: string[];
  /** Recent content-type mix */
  contentTypeMix: Array<{ type: string; count: number }>;
}

function countTypes(scans: ArticleScan[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of scans) {
    for (const t of s.topTypes || []) {
      m.set(t, (m.get(t) || 0) + 1);
    }
    for (const sig of s.signals || []) {
      m.set(sig.type, (m.get(sig.type) || 0) + 1);
    }
  }
  return m;
}

export async function buildMediaDietSummary(): Promise<MediaDietSummary> {
  const board = await getOutletBoard({ minSamples: 1, limit: 50, recentLimit: 200 });
  const scans = board.recentScans || [];
  const totalScans = board.totals.scans;
  const globalAvg = board.totals.globalAvgNeutrality;

  const hostCounts = new Map<string, number>();
  for (const s of scans) {
    hostCounts.set(s.host, (hostCounts.get(s.host) || 0) + 1);
  }
  const scanN = Math.max(1, scans.length);

  const outletByHost = new Map<string, SiteRating>();
  for (const o of board.allOutlets || []) {
    outletByHost.set(o.host, o);
  }

  const topOutlets: MediaDietOutletSlice[] = [...hostCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([host, n]) => {
      const o = outletByHost.get(host);
      const avg = o?.avgNeutrality ?? 50;
      const g = neutralityToGrade(avg);
      return {
        host,
        samples: o?.samples ?? n,
        avgNeutrality: Math.round(avg),
        grade: (o?.grade as LetterGrade) || g.grade,
        topTypes: o?.topTypes || [],
        sharePct: Math.round((n / scanN) * 100),
      };
    });

  const typeMap = countTypes(scans);
  const recurringTechniques = [...typeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({
      type,
      label: getCategoryMeta(type as never).label || type,
      count,
    }));

  const ctMap = new Map<string, number>();
  for (const s of scans) {
    const t = s.contentType || "unknown";
    ctMap.set(t, (ctMap.get(t) || 0) + 1);
  }
  const contentTypeMix = [...ctMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const insights: string[] = [];
  if (totalScans === 0) {
    insights.push(
      "No local scans yet. Analyze articles you read — your diet summary builds only from your history."
    );
  } else {
    insights.push(
      `You’ve logged ${totalScans} scan(s) across ${board.totals.outlets} outlet(s). All data stays on this device.`
    );
    if (topOutlets[0] && topOutlets[0].sharePct >= 35) {
      insights.push(
        `Heavy concentration: ${topOutlets[0].host} is ~${topOutlets[0].sharePct}% of recent scans. Diversity of sources is a media-literacy habit, not a moral score.`
      );
    }
    if (recurringTechniques[0]) {
      insights.push(
        `Most frequent technique family in your history: ${recurringTechniques[0].label} (${recurringTechniques[0].count} marks). Practice spotting it in Academy drills.`
      );
    }
    if (globalAvg != null && globalAvg < 65) {
      insights.push(
        `Average neutrality across your scans is ${Math.round(globalAvg)} — denser framing load. That may reflect topics/outlets you follow, not a personal failing.`
      );
    } else if (globalAvg != null && globalAvg >= 80) {
      insights.push(
        `Average neutrality across your scans is ${Math.round(globalAvg)} — relatively careful framing load in what you’ve scanned.`
      );
    }
    insights.push(
      "This is not a political scorecard. It only reflects techniques Bias Noticer flagged in articles you chose to analyze."
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    totalScans,
    outletCount: board.totals.outlets,
    journalistCount: board.totals.journalists,
    globalAvgNeutrality: globalAvg,
    globalGrade:
      globalAvg != null ? neutralityToGrade(globalAvg).grade : null,
    topOutlets,
    recurringTechniques,
    insights,
    contentTypeMix,
  };
}

export function mediaDietToMarkdown(d: MediaDietSummary): string {
  const lines = [
    `# Bias Noticer — Personal media diet`,
    ``,
    `Generated: ${d.generatedAt}`,
    ``,
    `> Fully local. Exportable by you. Not a political verdict.`,
    ``,
    `## Snapshot`,
    `- Scans: ${d.totalScans}`,
    `- Outlets: ${d.outletCount}`,
    `- Journalists: ${d.journalistCount}`,
    `- Global avg neutrality: ${d.globalAvgNeutrality ?? "—"} (${d.globalGrade ?? "—"})`,
    ``,
    `## Insights`,
    ...d.insights.map((i) => `- ${i}`),
    ``,
    `## Top outlets in your history`,
    ``,
  ];
  for (const o of d.topOutlets) {
    lines.push(
      `- **${o.host}** — ${o.samples} samples · avg ${o.avgNeutrality} (${o.grade}) · ~${o.sharePct}% of recent`
    );
  }
  lines.push(``, `## Recurring techniques`, ``);
  for (const t of d.recurringTechniques) {
    lines.push(`- ${t.label}: ${t.count}`);
  }
  lines.push(
    ``,
    `---`,
    `Bias Noticer · techniques over tribes · privacy-first`
  );
  return lines.join("\n");
}
