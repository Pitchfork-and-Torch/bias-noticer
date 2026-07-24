/**
 * Signal Radar 2.0 — They Live–style document heat map.
 * Severity layers, density scrubbing, richer tooltips.
 */

import { useMemo, useState } from "react";
import type { BiasInstance } from "../lib/types";
import {
  buildSignalRadar,
  radarPositionNote,
  type RadarPoint,
} from "../lib/signal-radar";
import { getCategoryMeta, SEVERITY_LABELS } from "../lib/taxonomy";

interface SignalRadarProps {
  instances: BiasInstance[];
  /** Optional full article text for better positioning */
  articleText?: string;
  selectedId?: string | null;
  onSelect: (instanceId: string) => void;
  /** Compact embed (summary tab) */
  compact?: boolean;
  className?: string;
  /** Animate progressive reveal on first paint */
  progressiveReveal?: boolean;
}

export function SignalRadar({
  instances,
  articleText,
  selectedId,
  onSelect,
  compact = false,
  className = "",
  progressiveReveal = true,
}: SignalRadarProps) {
  const [minSeverity, setMinSeverity] = useState(1);
  const [scrub, setScrub] = useState(1); // 0–1 timeline reveal

  const filtered = useMemo(
    () => instances.filter((i) => i.severity >= minSeverity),
    [instances, minSeverity]
  );

  const radar = useMemo(
    () => buildSignalRadar(filtered, articleText, compact ? 10 : 14),
    [filtered, articleText, compact]
  );

  const visiblePoints = useMemo(() => {
    if (!progressiveReveal) return radar.points;
    return radar.points.filter((p) => p.position <= scrub + 0.001);
  }, [radar.points, scrub, progressiveReveal]);

  const note = useMemo(
    () => radarPositionNote(radar.points),
    [radar.points]
  );

  if (!instances.length) {
    return (
      <div className={`bn-card p-3 text-xs text-slate-500 ${className}`}>
        No signals to map. Scan an article to paint the radar.
      </div>
    );
  }

  if (!radar.total) {
    return (
      <div className={`bn-card space-y-2 p-3 text-xs text-slate-500 ${className}`}>
        <p>No signals at severity ≥ {minSeverity}. Lower the filter.</p>
        <SeverityLayer minSeverity={minSeverity} onChange={setMinSeverity} />
      </div>
    );
  }

  return (
    <section
      className={`bn-card overflow-hidden ${className}`}
      aria-label="Signal radar 2.0 — document heat map"
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signal radar 2.0
          </h3>
          <p className="text-[10px] text-slate-400">
            {visiblePoints.length}/{radar.total} signal
            {radar.total === 1 ? "" : "s"} · lead → close · sev ≥ {minSeverity}
          </p>
        </div>
        {!compact && (
          <span
            className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300"
            title="They Live vision — technique density, not politics"
          >
            shades on
          </span>
        )}
      </div>

      {!compact && (
        <div className="space-y-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <SeverityLayer minSeverity={minSeverity} onChange={setMinSeverity} />
          {progressiveReveal && (
            <label className="block text-[10px] text-slate-500">
              Scrub reveal ({Math.round(scrub * 100)}% through article)
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(scrub * 100)}
                onChange={(e) => setScrub(Number(e.target.value) / 100)}
                className="mt-1 w-full accent-cyan-500"
                aria-label="Timeline scrub through article positions"
              />
            </label>
          )}
        </div>
      )}

      <div className={`flex gap-3 p-3 ${compact ? "items-stretch" : ""}`}>
        {/* Vertical heat strip */}
        <div
          className="relative flex w-10 shrink-0 flex-col rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
          style={{ minHeight: compact ? 120 : 200 }}
          role="list"
          aria-label="Signal density from top to bottom of article"
        >
          {/* Zone guides */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-slate-300/60 dark:border-slate-600/60"
            style={{ height: "20%" }}
            title="Lead"
          />
          <div
            className="pointer-events-none absolute inset-x-0 border-b border-dashed border-slate-300/60 dark:border-slate-600/60"
            style={{ top: "20%", height: "55%" }}
            title="Body"
          />

          {radar.bins.map((bin) => {
            const intensity =
              bin.count === 0
                ? 0
                : 0.15 + 0.85 * (bin.count / radar.densityPeak);
            return (
              <div
                key={bin.index}
                className="relative flex-1 rounded-sm transition"
                style={{
                  backgroundColor:
                    bin.count === 0
                      ? "transparent"
                      : hexAlpha(bin.hex, intensity * 0.85),
                }}
                title={
                  bin.count
                    ? `Zone ${bin.index + 1}: ${bin.count} signal(s)`
                    : undefined
                }
              />
            );
          })}

          {/* Point markers overlaid */}
          <div className="pointer-events-none absolute inset-1">
            {visiblePoints.map((p) => {
              const inst = instances.find((i) => i.id === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pointer-events-auto absolute left-1/2 z-10 -translate-x-1/2 rounded-full border-2 border-white shadow transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-900"
                  style={{
                    top: `${p.position * 100}%`,
                    width: selectedId === p.id ? 12 : 8 + p.severity,
                    height: selectedId === p.id ? 12 : 8 + p.severity,
                    backgroundColor: p.hex,
                    marginTop: -4,
                    boxShadow:
                      selectedId === p.id
                        ? `0 0 0 3px ${hexAlpha(p.hex, 0.45)}`
                        : undefined,
                    opacity: 0.55 + 0.09 * p.severity,
                  }}
                  aria-label={`${p.label}, severity ${p.severity}, at ${Math.round(p.position * 100)}% through article`}
                  aria-current={selectedId === p.id ? "true" : undefined}
                  title={radarTooltip(p, inst)}
                  onClick={() => onSelect(p.id)}
                />
              );
            })}
          </div>
        </div>

        {/* Zone cards + jump list */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {radar.zones.map((z) => (
              <div
                key={z.id}
                className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-800/50"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {z.label}
                </div>
                <div className="text-sm font-bold tabular-nums">
                  {z.count}
                </div>
                {!compact && z.count > 0 && (
                  <div className="truncate text-[9px] text-slate-400">
                    avg sev {z.avgSeverity}
                    {z.topTypes[0]
                      ? ` · ${getCategoryMeta(z.topTypes[0]).label}`
                      : ""}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!compact && (
            <ul className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
              {visiblePoints.map((p) => (
                <RadarJumpRow
                  key={p.id}
                  point={p}
                  active={selectedId === p.id}
                  instance={instances.find((i) => i.id === p.id)}
                  onSelect={() => onSelect(p.id)}
                />
              ))}
            </ul>
          )}

          {compact && (
            <p className="text-[10px] text-slate-500">
              Click a dot to jump. Hottest zone:{" "}
              <strong>
                {radar.zones.slice().sort((a, b) => b.count - a.count)[0]
                  ?.label ?? "—"}
              </strong>
            </p>
          )}

          {note && (
            <p className="text-[10px] leading-snug text-slate-400">{note}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function SeverityLayer({
  minSeverity,
  onChange,
}: {
  minSeverity: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Minimum severity layer"
    >
      <span className="text-[10px] text-slate-400">Severity</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`h-6 min-w-[1.5rem] rounded-md px-1 text-[10px] font-bold tabular-nums ${
            minSeverity === n
              ? "bg-cyan-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          }`}
          onClick={() => onChange(n)}
          aria-pressed={minSeverity === n}
        >
          ≥{n}
        </button>
      ))}
    </div>
  );
}

function radarTooltip(p: RadarPoint, inst?: BiasInstance): string {
  const lines = [
    `${p.label} · sev ${p.severity}/5 · conf ${Math.round(p.confidence * 100)}%`,
    `“${truncate(p.span_text, 90)}”`,
  ];
  if (inst?.why_flagged) lines.push(`Why: ${inst.why_flagged}`);
  else if (inst?.concise_explanation) lines.push(inst.concise_explanation);
  if (inst?.suggested_rephrase) {
    lines.push(`Neutral rephrase: ${truncate(inst.suggested_rephrase, 80)}`);
  }
  if (inst?.voice && inst.voice !== "unknown") {
    lines.push(`Voice: ${inst.voice}`);
  }
  return lines.join("\n");
}

function RadarJumpRow({
  point,
  active,
  instance,
  onSelect,
}: {
  point: RadarPoint;
  active: boolean;
  instance?: BiasInstance;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] transition ${
          active
            ? "bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-950/40 dark:ring-brand-600"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
        title={radarTooltip(point, instance)}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: point.hex }}
          aria-hidden
        />
        <span className="w-8 shrink-0 tabular-nums text-slate-400">
          {Math.round(point.position * 100)}%
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {point.label}
        </span>
        {instance?.verification === "confirmed" && (
          <span className="shrink-0 text-[9px] text-emerald-600">✓</span>
        )}
        <span className="shrink-0 text-slate-400">
          {SEVERITY_LABELS[point.severity] ?? point.severity}
        </span>
      </button>
    </li>
  );
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
