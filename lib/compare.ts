/**
 * Side-by-side comparison of two analyses (local, no network).
 * Surfaces framing differences for research use.
 */

import type { BiasAnalysis, BiasInstance, BiasType } from "./types";
import { getCategoryMeta } from "./taxonomy";
import { displayNeutrality } from "./grades";

export interface TypeDelta {
  type: BiasType;
  label: string;
  countA: number;
  countB: number;
  avgSevA: number;
  avgSevB: number;
}

export interface ComparisonResult {
  titleA: string;
  titleB: string;
  urlA: string;
  urlB: string;
  neutralityA: number;
  neutralityB: number;
  deltaNeutrality: number;
  contentTypeA: string;
  contentTypeB: string;
  countA: number;
  countB: number;
  onlyInA: BiasInstance[];
  onlyInB: BiasInstance[];
  sharedTypes: BiasType[];
  typeDeltas: TypeDelta[];
  patternDiffs: string[];
  missingContextNotes: string[];
  summary: string;
}

function typeCounts(instances: BiasInstance[]): Map<BiasType, { n: number; sev: number }> {
  const m = new Map<BiasType, { n: number; sev: number }>();
  for (const i of instances) {
    const prev = m.get(i.bias_type) ?? { n: 0, sev: 0 };
    prev.n += 1;
    prev.sev += i.severity;
    m.set(i.bias_type, prev);
  }
  return m;
}

function spanNorm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100);
}

export function compareAnalyses(
  a: BiasAnalysis,
  b: BiasAnalysis
): ComparisonResult {
  const neutralityA = displayNeutrality(a.summary);
  const neutralityB = displayNeutrality(b.summary);
  const ca = typeCounts(a.instances);
  const cb = typeCounts(b.instances);
  const allTypes = new Set<BiasType>([...ca.keys(), ...cb.keys()]);

  const typeDeltas: TypeDelta[] = [...allTypes].map((type) => {
    const ta = ca.get(type);
    const tb = cb.get(type);
    return {
      type,
      label: getCategoryMeta(type).label,
      countA: ta?.n ?? 0,
      countB: tb?.n ?? 0,
      avgSevA: ta ? Math.round((ta.sev / ta.n) * 10) / 10 : 0,
      avgSevB: tb ? Math.round((tb.sev / tb.n) * 10) / 10 : 0,
    };
  }).sort(
    (x, y) =>
      Math.abs(y.countA - y.countB) - Math.abs(x.countA - x.countB) ||
      y.countA + y.countB - (x.countA + x.countB)
  );

  const spansA = new Set(a.instances.map((i) => spanNorm(i.span_text)));
  const spansB = new Set(b.instances.map((i) => spanNorm(i.span_text)));
  const onlyInA = a.instances.filter((i) => !spansB.has(spanNorm(i.span_text)));
  const onlyInB = b.instances.filter((i) => !spansA.has(spanNorm(i.span_text)));

  const sharedTypes = [...allTypes].filter(
    (t) => (ca.get(t)?.n ?? 0) > 0 && (cb.get(t)?.n ?? 0) > 0
  );

  const patternDiffs: string[] = [];
  for (const p of a.summary.top_patterns) {
    if (!b.summary.top_patterns.some((q) => q.toLowerCase() === p.toLowerCase())) {
      patternDiffs.push(`Only A: ${p}`);
    }
  }
  for (const p of b.summary.top_patterns) {
    if (!a.summary.top_patterns.some((q) => q.toLowerCase() === p.toLowerCase())) {
      patternDiffs.push(`Only B: ${p}`);
    }
  }

  const missingContextNotes: string[] = [];
  for (const m of a.missing_context || []) {
    missingContextNotes.push(`A: ${m.summary}`);
  }
  for (const m of b.missing_context || []) {
    missingContextNotes.push(`B: ${m.summary}`);
  }

  const delta = neutralityA - neutralityB;
  const lean =
    Math.abs(delta) < 3
      ? "Similar neutrality scores"
      : delta > 0
        ? `A scores ${Math.abs(delta)} points more neutral than B`
        : `B scores ${Math.abs(delta)} points more neutral than A`;

  const topDelta = typeDeltas[0];
  const techniqueNote = topDelta
    ? `Largest technique volume gap: ${topDelta.label} (A ${topDelta.countA} vs B ${topDelta.countB}).`
    : "No technique deltas.";

  return {
    titleA: a.title,
    titleB: b.title,
    urlA: a.url,
    urlB: b.url,
    neutralityA,
    neutralityB,
    deltaNeutrality: delta,
    contentTypeA: a.summary.content_type,
    contentTypeB: b.summary.content_type,
    countA: a.instances.length,
    countB: b.instances.length,
    onlyInA: onlyInA.slice(0, 20),
    onlyInB: onlyInB.slice(0, 20),
    sharedTypes,
    typeDeltas,
    patternDiffs,
    missingContextNotes,
    summary: `${lean}. ${techniqueNote} Shared technique families: ${sharedTypes.length}. Unique spans A/B: ${onlyInA.length}/${onlyInB.length}.`,
  };
}

export function comparisonToMarkdown(c: ComparisonResult): string {
  const lines = [
    `# Bias Noticer — Framing comparison`,
    ``,
    `> Techniques over tribes. Not a truth verdict. Local analysis only.`,
    ``,
    `## Side A`,
    `- **Title:** ${c.titleA}`,
    `- **URL:** ${c.urlA}`,
    `- **Neutrality:** ${c.neutralityA}/100 · ${c.contentTypeA} · ${c.countA} signals`,
    ``,
    `## Side B`,
    `- **Title:** ${c.titleB}`,
    `- **URL:** ${c.urlB}`,
    `- **Neutrality:** ${c.neutralityB}/100 · ${c.contentTypeB} · ${c.countB} signals`,
    ``,
    `## Overview`,
    c.summary,
    ``,
    `## Technique volume`,
    ``,
    `| Technique | A | B | Avg sev A | Avg sev B |`,
    `|---|---:|---:|---:|---:|`,
  ];
  for (const t of c.typeDeltas.slice(0, 15)) {
    lines.push(
      `| ${t.label} | ${t.countA} | ${t.countB} | ${t.avgSevA || "—"} | ${t.avgSevB || "—"} |`
    );
  }
  if (c.patternDiffs.length) {
    lines.push(``, `## Pattern differences`, ``);
    for (const p of c.patternDiffs) lines.push(`- ${p}`);
  }
  if (c.missingContextNotes.length) {
    lines.push(``, `## Structural / missing-context notes`, ``);
    for (const n of c.missingContextNotes) lines.push(`- ${n}`);
  }
  lines.push(
    ``,
    `---`,
    `Generated by Bias Noticer · comparison is local and directionally agnostic`
  );
  return lines.join("\n");
}
