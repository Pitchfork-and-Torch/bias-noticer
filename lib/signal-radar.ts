/**
 * Signal Radar — position bias instances along an article for heat-map UX.
 *
 * Positions are 0–1 along document order. Prefers model char offsets when
 * available; falls back to span search in page text; last resort spreads
 * evenly by instance order (still useful for navigation).
 */

import type { BiasInstance, BiasType } from "./types";
import { getCategoryMeta } from "./taxonomy";

export interface RadarPoint {
  id: string;
  /** 0 = top of article, 1 = bottom */
  position: number;
  bias_type: BiasType;
  severity: number;
  confidence: number;
  label: string;
  hex: string;
  span_text: string;
  /** How position was estimated */
  method: "offset" | "search" | "order";
}

export interface RadarBin {
  /** Center of bin 0–1 */
  center: number;
  /** Index 0..bins-1 */
  index: number;
  count: number;
  maxSeverity: number;
  /** Dominant type in this bin (by count, then severity) */
  dominantType?: BiasType;
  hex: string;
  points: RadarPoint[];
}

export interface RadarZone {
  id: "lead" | "body" | "close";
  label: string;
  start: number;
  end: number;
  count: number;
  avgSeverity: number;
  topTypes: BiasType[];
}

export interface SignalRadarModel {
  points: RadarPoint[];
  bins: RadarBin[];
  zones: RadarZone[];
  densityPeak: number;
  total: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Locate span in full text (case-insensitive, whitespace-tolerant). */
function findSpanPosition(
  fullText: string,
  span: string
): number | null {
  if (!fullText || !span?.trim()) return null;
  const hay = fullText;
  const needle = span.trim();
  let idx = hay.indexOf(needle);
  if (idx >= 0) return idx / Math.max(1, hay.length);

  const hayLower = hay.toLowerCase();
  const needleLower = needle.toLowerCase();
  idx = hayLower.indexOf(needleLower);
  if (idx >= 0) return idx / Math.max(1, hay.length);

  // Collapse whitespace for soft wraps
  const normHay = hayLower.replace(/\s+/g, " ");
  const normNeedle = needleLower.replace(/\s+/g, " ");
  idx = normHay.indexOf(normNeedle);
  if (idx >= 0) return idx / Math.max(1, normHay.length);

  // Distinctive substring (≥16 chars)
  if (needle.length >= 16) {
    const mid = needle.slice(0, Math.min(48, needle.length));
    idx = hayLower.indexOf(mid.toLowerCase());
    if (idx >= 0) return idx / Math.max(1, hay.length);
  }
  return null;
}

export function buildRadarPoints(
  instances: BiasInstance[],
  articleText?: string
): RadarPoint[] {
  const n = instances.length;
  if (!n) return [];

  const textLen = articleText?.length ?? 0;
  const points: RadarPoint[] = instances.map((inst, i) => {
    const meta = getCategoryMeta(inst.bias_type);
    let position = (i + 0.5) / n;
    let method: RadarPoint["method"] = "order";

    if (
      typeof inst.char_start === "number" &&
      textLen > 0 &&
      inst.char_start >= 0
    ) {
      position = clamp01(inst.char_start / textLen);
      method = "offset";
    } else if (articleText) {
      const found = findSpanPosition(articleText, inst.span_text);
      if (found != null) {
        position = clamp01(found);
        method = "search";
      }
    }

    return {
      id: inst.id,
      position,
      bias_type: inst.bias_type,
      severity: inst.severity,
      confidence: inst.confidence,
      label: meta.label,
      hex: meta.hex,
      span_text: inst.span_text,
      method,
    };
  });

  // Stable visual order by position
  return points.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function buildRadarBins(
  points: RadarPoint[],
  binCount = 12
): RadarBin[] {
  const bins: RadarBin[] = Array.from({ length: binCount }, (_, index) => ({
    center: (index + 0.5) / binCount,
    index,
    count: 0,
    maxSeverity: 0,
    hex: "#64748b",
    points: [],
  }));

  for (const p of points) {
    const idx = Math.min(
      binCount - 1,
      Math.max(0, Math.floor(p.position * binCount))
    );
    const bin = bins[idx]!;
    bin.count += 1;
    bin.maxSeverity = Math.max(bin.maxSeverity, p.severity);
    bin.points.push(p);
  }

  for (const bin of bins) {
    if (!bin.points.length) continue;
    const typeCounts = new Map<BiasType, { n: number; sev: number; hex: string }>();
    for (const p of bin.points) {
      const prev = typeCounts.get(p.bias_type) ?? { n: 0, sev: 0, hex: p.hex };
      prev.n += 1;
      prev.sev = Math.max(prev.sev, p.severity);
      typeCounts.set(p.bias_type, prev);
    }
    let best: BiasType | undefined;
    let bestScore = -1;
    for (const [t, v] of typeCounts) {
      const score = v.n * 10 + v.sev;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) {
      bin.dominantType = best;
      bin.hex = getCategoryMeta(best).hex;
    }
  }

  return bins;
}

export function buildRadarZones(points: RadarPoint[]): RadarZone[] {
  const defs: Array<Omit<RadarZone, "count" | "avgSeverity" | "topTypes">> = [
    { id: "lead", label: "Lead", start: 0, end: 0.2 },
    { id: "body", label: "Body", start: 0.2, end: 0.75 },
    { id: "close", label: "Close", start: 0.75, end: 1.0001 },
  ];

  return defs.map((d) => {
    const inZone = points.filter(
      (p) => p.position >= d.start && p.position < d.end
    );
    const avgSeverity = inZone.length
      ? inZone.reduce((s, p) => s + p.severity, 0) / inZone.length
      : 0;
    const typeMap = new Map<BiasType, number>();
    for (const p of inZone) {
      typeMap.set(p.bias_type, (typeMap.get(p.bias_type) ?? 0) + 1);
    }
    const topTypes = [...typeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => t);

    return {
      ...d,
      count: inZone.length,
      avgSeverity: Math.round(avgSeverity * 10) / 10,
      topTypes,
    };
  });
}

export function buildSignalRadar(
  instances: BiasInstance[],
  articleText?: string,
  binCount = 12
): SignalRadarModel {
  const points = buildRadarPoints(instances, articleText);
  const bins = buildRadarBins(points, binCount);
  const zones = buildRadarZones(points);
  const densityPeak = Math.max(1, ...bins.map((b) => b.count));
  return {
    points,
    bins,
    zones,
    densityPeak,
    total: points.length,
  };
}

/** Human-readable note when many positions are order-only estimates */
export function radarPositionNote(points: RadarPoint[]): string | null {
  if (!points.length) return null;
  const orderOnly = points.filter((p) => p.method === "order").length;
  const ratio = orderOnly / points.length;
  if (ratio >= 0.6) {
    return "Positions are approximate (model did not provide offsets). Click dots to jump when highlights are painted.";
  }
  if (orderOnly > 0) {
    return "Some positions estimated from quote search.";
  }
  return null;
}
