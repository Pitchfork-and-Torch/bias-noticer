/**
 * Compact SVG sparkline for local neutrality history (0–100).
 * Higher = more even framing load from the user's own scans.
 */

import { useMemo } from "react";
import { neutralityToGrade } from "../lib/grades";

export interface SparkPoint {
  /** ISO timestamp or any sortable key */
  at: string;
  neutrality: number;
  label?: string;
}

interface NeutralitySparklineProps {
  points: SparkPoint[];
  /** Newest-first input is fine — we sort chronologically */
  width?: number;
  height?: number;
  className?: string;
  /** Show min/max labels */
  showRange?: boolean;
  /** Accessible title */
  title?: string;
}

export function NeutralitySparkline({
  points,
  width = 160,
  height = 40,
  className = "",
  showRange = true,
  title = "Neutrality over your local scans",
}: NeutralitySparklineProps) {
  const model = useMemo(() => {
    const sorted = [...points]
      .filter((p) => typeof p.neutrality === "number")
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || 0);

    if (sorted.length < 1) return null;

    const values = sorted.map((p) =>
      Math.max(0, Math.min(100, p.neutrality))
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 3;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const range = Math.max(8, max - min); // avoid flat-line division collapse

    const coords = values.map((v, i) => {
      const x =
        sorted.length === 1
          ? pad + w / 2
          : pad + (i / (sorted.length - 1)) * w;
      // Higher neutrality at top
      const y = pad + (1 - (v - min) / range) * h;
      return { x, y, v, at: sorted[i]!.at, label: sorted[i]!.label };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");

    // Soft fill under the line
    const last = coords[coords.length - 1]!;
    const first = coords[0]!;
    const area = `${line} L${last.x.toFixed(1)},${(pad + h).toFixed(1)} L${first.x.toFixed(1)},${(pad + h).toFixed(1)} Z`;

    const latest = values[values.length - 1]!;
    const earliest = values[0]!;
    const delta = Math.round((latest - earliest) * 10) / 10;
    const grade = neutralityToGrade(latest);

    return {
      coords,
      line,
      area,
      min,
      max,
      latest,
      delta,
      grade,
      count: sorted.length,
    };
  }, [points, width, height]);

  if (!model) {
    return (
      <p className={`text-[11px] text-slate-500 ${className}`}>
        Not enough history for a trend yet.
      </p>
    );
  }

  const deltaLabel =
    model.count < 2
      ? "single scan"
      : model.delta > 0
        ? `+${model.delta} toward even`
        : model.delta < 0
          ? `${model.delta} toward heavier framing`
          : "flat";

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-2">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}. Latest ${model.latest}/100 (${model.grade.grade}). Trend: ${deltaLabel}.`}
          className="shrink-0 overflow-visible"
        >
          <title>{title}</title>
          {/* Mid reference */}
          <line
            x1={3}
            x2={width - 3}
            y1={height / 2}
            y2={height / 2}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeDasharray="2 3"
          />
          <path d={model.area} fill={model.grade.color} fillOpacity={0.15} />
          <path
            d={model.line}
            fill="none"
            stroke={model.grade.color}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {model.coords.map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={i === model.coords.length - 1 ? 3.2 : 2}
              fill={model.grade.color}
            >
              <title>
                {c.v}/100
                {c.label ? ` · ${c.label}` : ""}
                {c.at ? ` · ${new Date(c.at).toLocaleDateString()}` : ""}
              </title>
            </circle>
          ))}
        </svg>
        <div className="min-w-0 text-right text-[10px] leading-tight text-slate-500">
          <div className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {model.latest}/100 · {model.grade.grade}
          </div>
          <div>{deltaLabel}</div>
          {showRange && (
            <div className="tabular-nums opacity-80">
              range {Math.round(model.min)}–{Math.round(model.max)} ·{" "}
              {model.count} pts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
