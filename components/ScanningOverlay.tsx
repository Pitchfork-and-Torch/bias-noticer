import { SunglassesIcon } from "./SunglassesIcon";

interface Props {
  message?: string;
  percent?: number;
  /** When true, show skeleton cards under the scan banner */
  showSkeleton?: boolean;
}

/** Cinematic-yet-subtle “scanning with xAI shades” progress for panel/popup */
export function ScanningOverlay({
  message = "Scanning with xAI shades…",
  percent = 40,
  showSkeleton = true,
}: Props) {
  const p = Math.max(0, Math.min(100, percent));

  return (
    <div className="space-y-4 animate-fade-in" role="status" aria-live="polite">
      <div className="bn-card relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 motion-safe:animate-pulse-soft"
          aria-hidden
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(14,165,233,0.06), rgba(14,165,233,0.06) 1px, transparent 2px, transparent 4px)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-brand-400/20 to-transparent motion-safe:animate-scan-line"
          aria-hidden
          style={{ top: `${(p / 100) * 70}%` }}
        />
        <div className="relative flex items-center gap-3">
          <SunglassesIcon className="h-11 w-11 shrink-0" glow />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {message}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Extracting · analyzing · preparing highlights
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 via-cyan-400 to-brand-400 transition-all duration-500"
                style={{ width: `${p}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[10px] tabular-nums text-slate-400">
              {p}%
            </div>
          </div>
        </div>
      </div>

      {showSkeleton && (
        <div className="space-y-2" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bn-card space-y-2 p-3"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <div className="bn-skeleton h-3 w-24" />
              <div className="bn-skeleton h-4 w-full" />
              <div className="bn-skeleton h-3 w-4/5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
