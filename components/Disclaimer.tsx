export function Disclaimer({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        AI-assisted analysis. Not infallible. Augments critical thinking — does
        not replace it.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <strong className="font-semibold">Disclaimer:</strong> Bias Noticer is
      AI-assisted analysis of rhetorical techniques. It is not a fact-checker,
      legal advice, or a verdict on truth. It never censors pages. Trust your
      judgment.
    </div>
  );
}
