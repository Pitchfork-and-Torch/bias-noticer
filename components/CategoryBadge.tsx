import { getCategoryMeta } from "../lib/taxonomy";
import type { BiasType } from "../lib/types";

export function CategoryBadge({ type }: { type: BiasType }) {
  const meta = getCategoryMeta(type);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        backgroundColor: `${meta.hex}22`,
        color: meta.hex,
        border: `1px solid ${meta.hex}44`,
      }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
