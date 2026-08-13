import { useMemo } from "react";
import { getCategoryMeta } from "../lib/taxonomy";
import type { BiasInstance } from "../lib/types";

/** Horizontal stacked breakdown of bias types by count */
export function CategoryBreakdown({ instances }: { instances: BiasInstance[] }) {
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of instances) {
      m.set(i.bias_type, (m.get(i.bias_type) ?? 0) + 1);
    }
    const total = instances.length || 1;
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => ({
        type,
        n,
        pct: Math.round((n / total) * 100),
        meta: getCategoryMeta(type as never),
      }));
  }, [instances]);

  if (!rows.length) {
    return (
      <p className="text-xs text-slate-500">No signals above threshold.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {rows.map((r) => (
          <div
            key={r.type}
            title={`${r.meta.label}: ${r.pct}%`}
            style={{
              width: `${r.pct}%`,
              backgroundColor: r.meta.hex,
              minWidth: r.n ? 4 : 0,
            }}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.type} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: r.meta.hex }}
            />
            <span className="min-w-0 flex-1 truncate font-medium">
              {r.meta.label}
            </span>
            <span className="tabular-nums text-slate-500">
              {r.n} · {r.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Simple confidence band for the set of instances */
export function ConfidenceBand({ instances }: { instances: BiasInstance[] }) {
  if (!instances.length) return null;
  const confs = instances.map((i) => i.confidence);
  const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
  const min = Math.min(...confs);
  const max = Math.max(...confs);
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
      <div className="font-semibold text-slate-600 dark:text-slate-300">
        Confidence band
      </div>
      <div className="mt-0.5 tabular-nums text-slate-500">
        avg {(avg * 100).toFixed(0)}% · range {(min * 100).toFixed(0)}–
        {(max * 100).toFixed(0)}%
      </div>
    </div>
  );
}
