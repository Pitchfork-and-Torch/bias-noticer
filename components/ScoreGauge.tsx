import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { BiasInstance } from "../lib/types";
import { getCategoryMeta } from "../lib/taxonomy";
import { neutralityToGrade } from "../lib/grades";

interface Props {
  score: number;
  size?: number;
  className?: string;
  /** Optional instances for interactive hover breakdown */
  instances?: BiasInstance[];
  /** Show letter grade under the numeric score (default true) */
  showGrade?: boolean;
}

/** Circular neutrality gauge 0–100 with gradient ring + optional breakdown */
export function ScoreGauge({
  score,
  size = 96,
  className,
  instances,
  showGrade = true,
}: Props) {
  const [hover, setHover] = useState(false);
  const s = Math.max(0, Math.min(100, score));
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (s / 100) * c;
  const gradeInfo = useMemo(() => neutralityToGrade(s), [s]);

  const gradientId = useMemo(
    () => `bn-gauge-${Math.round(s)}-${size}`,
    [s, size]
  );

  const stroke =
    s >= 75 ? "#22c55e" : s >= 50 ? "#eab308" : s >= 30 ? "#f97316" : "#ef4444";

  const breakdown = useMemo(() => {
    if (!instances?.length) return [] as { label: string; n: number; hex: string }[];
    const m = new Map<string, number>();
    for (const i of instances) {
      m.set(i.bias_type, (m.get(i.bias_type) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, n]) => {
        const meta = getCategoryMeta(type as never);
        return { label: meta.label, n, hex: meta.hex };
      });
  }, [instances]);

  return (
    <div
      className={clsx("score-ring relative", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        showGrade
          ? `Neutrality score ${s} out of 100, grade ${gradeInfo.grade}`
          : `Neutrality score ${s} out of 100`
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      tabIndex={breakdown.length ? 0 : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={breakdown.length ? `url(#${gradientId})` : stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ filter: hover ? "drop-shadow(0 0 4px rgba(14,165,233,0.45))" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center px-1">
          <div
            className={clsx(
              "font-display font-bold tabular-nums leading-none",
              size >= 96 ? "text-2xl" : "text-xl"
            )}
          >
            {Math.round(s)}
          </div>
          {showGrade ? (
            <div
              className="mt-0.5 text-[11px] font-bold tracking-wide"
              style={{ color: gradeInfo.color }}
              title={gradeInfo.label}
            >
              {gradeInfo.grade}
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              neutral
            </div>
          )}
        </div>
      </div>

      {hover && breakdown.length > 0 && (
        <div
          className="absolute left-1/2 top-full z-20 mt-2 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="tooltip"
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Technique mix
          </div>
          <ul className="space-y-1">
            {breakdown.map((b) => (
              <li
                key={b.label}
                className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: b.hex }}
                />
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                <span className="tabular-nums text-slate-500">×{b.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
