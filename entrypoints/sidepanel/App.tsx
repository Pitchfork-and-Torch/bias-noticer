import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CategoryBreakdown,
  ConfidenceBand,
} from "../../components/CategoryBreakdown";
import { CategoryBadge } from "../../components/CategoryBadge";
import { Disclaimer } from "../../components/Disclaimer";
import { ScoreGauge } from "../../components/ScoreGauge";
import { ScanningOverlay } from "../../components/ScanningOverlay";
import { SunglassesIcon } from "../../components/SunglassesIcon";
import { clusterInstances, type BiasCluster } from "../../lib/cluster";
import {
  ACCESS_METHOD_LABELS,
  analysisToJson,
  analysisToMarkdown,
  downloadText,
  openPrintReport,
  researchBriefFilename,
  researchBriefToJson,
  researchBriefToMarkdown,
} from "../../lib/export";
import { sendToBackground } from "../../lib/messaging";
import { PROMPT_VERSION } from "../../lib/prompt";
import {
  ALL_BIAS_TYPES,
  BIAS_TAXONOMY,
  getCategoryMeta,
  SEVERITY_LABELS,
} from "../../lib/taxonomy";
import type {
  AnalysisProgress,
  BiasAnalysis,
  BiasInstance,
  BiasType,
  ExtensionSettings,
  ResearchAccessMethod,
} from "../../lib/types";
import { applyTheme as applyThemeMode } from "../../lib/theme";
import { APP_VERSION } from "../../lib/version";
import { gradeLegend, neutralityToGrade } from "../../lib/grades";

type SortKey = "severity" | "confidence" | "type";
type PanelTab =
  | "detected"
  | "summary"
  | "evidence"
  | "outlets"
  | "research"
  | "feedback"
  | "glossary";

type OutletRow = {
  host: string;
  samples: number;
  avgNeutrality: number;
  lastScore: number;
  lastTitle: string;
  lastAt: string;
  topTypes: string[];
  totalSignals?: number;
  grade?: string;
  gradeLabel?: string;
};

type AuditScan = {
  id: string;
  url: string;
  host: string;
  title: string;
  authors?: string[];
  neutrality: number;
  grade?: string;
  gradeLabel?: string;
  signalCount: number;
  source: string;
  scannedAt: string;
  overview?: string;
  contentType?: string;
  caveats?: string[];
  topTypes?: string[];
  signals?: Array<{
    type: string;
    severity: number;
    confidence: number;
    span: string;
    explanation: string;
  }>;
};

type JournalistRow = {
  key: string;
  name: string;
  samples: number;
  avgNeutrality: number;
  lastScore: number;
  lastTitle: string;
  lastHost: string;
  lastAt: string;
  topTypes: string[];
  grade?: string;
  gradeLabel?: string;
};

type OutletBoardData = {
  mostUnbiased: OutletRow[];
  mostBiased: OutletRow[];
  mostUnbiasedJournalists?: JournalistRow[];
  mostBiasedJournalists?: JournalistRow[];
  recentScans: AuditScan[];
  totals: {
    outlets: number;
    journalists?: number;
    scans: number;
    globalAvgNeutrality: number | null;
  };
  minSamples: number;
};

type OutletDetailData = {
  outlet: OutletRow;
  history: AuditScan[];
};

type JournalistDetailData = {
  journalist: JournalistRow;
  history: AuditScan[];
};

function GradeBadge({
  score,
  grade,
  size = "md",
}: {
  score: number;
  grade?: string;
  size?: "sm" | "md" | "lg";
}) {
  const info = neutralityToGrade(score);
  const g = grade || info.grade;
  const dim =
    size === "lg"
      ? "h-12 w-12 text-lg"
      : size === "sm"
        ? "h-7 w-7 text-[11px]"
        : "h-9 w-9 text-sm";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-lg font-black text-white shadow-sm`}
      style={{ backgroundColor: info.color }}
      title={`${g} · ${info.label} · ${score}/100`}
    >
      {g}
    </span>
  );
}

function AuditHistoryList({
  history,
  selectedAuditId,
  setSelectedAuditId,
  onOpenOutlet,
  onOpenJournalist,
}: {
  history: AuditScan[];
  selectedAuditId: string | null;
  setSelectedAuditId: (id: string | null) => void;
  onOpenOutlet?: (host: string) => void;
  onOpenJournalist?: (key: string) => void;
}) {
  return (
    <div className="bn-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Audit history ({history.length})
      </h3>
      {!history.length ? (
        <p className="text-xs text-slate-500">No stored reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((s) => {
            const open = selectedAuditId === s.id;
            return (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200/80 dark:border-slate-700"
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-2 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => setSelectedAuditId(open ? null : s.id)}
                >
                  <GradeBadge score={s.neutrality} grade={s.grade} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-snug">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {s.neutrality}/100 · {s.signalCount} signals · {s.source}{" "}
                      · {new Date(s.scannedAt).toLocaleString()}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {open ? "▲" : "▼"}
                  </span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                    {s.overview && (
                      <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                        {s.overview}
                      </p>
                    )}
                    {!!s.authors?.length && (
                      <div className="flex flex-wrap gap-1">
                        {s.authors.map((a) => (
                          <button
                            key={a}
                            type="button"
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            onClick={() =>
                              onOpenJournalist?.(
                                a.toLowerCase().replace(/[^a-z0-9]+/g, "_")
                              )
                            }
                            disabled={!onOpenJournalist}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                    {onOpenOutlet && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-brand-600 underline"
                        onClick={() => onOpenOutlet(s.host)}
                      >
                        Outlet: {s.host}
                      </button>
                    )}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[11px] text-brand-600 underline"
                    >
                      {s.url}
                    </a>
                    {!!s.caveats?.length && (
                      <ul className="list-disc pl-4 text-[11px] text-amber-700 dark:text-amber-300">
                        {s.caveats.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {!!s.signals?.length && (
                      <div className="space-y-2 pt-1">
                        <div className="text-[10px] font-semibold uppercase text-slate-500">
                          Signals in this audit
                        </div>
                        {s.signals.map((sig, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50"
                          >
                            <div className="font-semibold">
                              {sig.type.replace(/_/g, " ")} · sev {sig.severity}
                              /5
                            </div>
                            <div className="mt-0.5 italic text-slate-600 dark:text-slate-400">
                              “{sig.span}”
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {sig.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!s.signals?.length && !s.overview && (
                      <p className="text-[11px] text-slate-500">
                        Compact score-only row. Re-scan for a richer report.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SidePanelApp() {
  const [analysis, setAnalysis] = useState<BiasAnalysis | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({ stage: "idle" });
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<BiasType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [query, setQuery] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rewrite, setRewrite] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("detected");
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    () => new Set()
  );
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [siteAvg, setSiteAvg] = useState<number | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [tryHighlight, setTryHighlight] = useState(true);
  const [accessMethod, setAccessMethod] =
    useState<ResearchAccessMethod>("subscription");
  const [accessNote, setAccessNote] = useState("");
  const [includeExcerptInBrief, setIncludeExcerptInBrief] = useState(false);
  const [outletBoard, setOutletBoard] = useState<OutletBoardData | null>(null);
  const [outletBusy, setOutletBusy] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletDetailData | null>(
    null
  );
  const [selectedJournalist, setSelectedJournalist] =
    useState<JournalistDetailData | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [scoreboardView, setScoreboardView] = useState<"outlets" | "journalists">(
    "outlets"
  );
  const [pageStatus, setPageStatus] = useState<{
    tabId?: number;
    url?: string;
    title?: string;
    wordCount: number;
    possiblyPaywalled: boolean;
    canExtract: boolean;
    reason?: string;
    extractSource?: string;
  } | null>(null);

  const load = useCallback(async () => {
    const s = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
    if (s.ok) {
      setSettings(s.data);
      setMinConf(s.data.minConfidence ?? 0);
    }
    const a = await sendToBackground<{
      analysis: BiasAnalysis | null;
      progress: AnalysisProgress;
    }>({ type: "GET_ANALYSIS" });
    if (a.ok) {
      setAnalysis(a.data.analysis);
      setProgress(a.data.progress);
      if (
        a.data.progress.stage === "analyzing" ||
        a.data.progress.stage === "extracting" ||
        a.data.progress.stage === "highlighting"
      ) {
        setBusy(true);
      }
    }
    const status = await sendToBackground<{
      tabId?: number;
      url?: string;
      title?: string;
      wordCount: number;
      possiblyPaywalled: boolean;
      canExtract: boolean;
      reason?: string;
      extractSource?: string;
    }>({ type: "GET_PAGE_STATUS" });
    if (status.ok) {
      setPageStatus(status.data);
      // Prefill research citation from the active tab (helps paywalled NYT etc.)
      if (status.data.url && /^https?:/i.test(status.data.url)) {
        setPasteUrl((u) => u || status.data.url || "");
        setPasteTitle((t) => t || status.data.title || "");
      }
    }
    const board = await sendToBackground<OutletBoardData>({
      type: "GET_OUTLET_BOARD",
      minSamples: 1,
    });
    if (board.ok) setOutletBoard(board.data);

    const site = await sendToBackground<{ avgNeutrality?: number } | null>({
      type: "GET_SITE_RATING",
    });
    if (site.ok && site.data && typeof site.data.avgNeutrality === "number") {
      setSiteAvg(site.data.avgNeutrality);
    }
  }, []);

  useEffect(() => {
    void load();
    void applyTheme();
    const onMsg = (msg: {
      type?: string;
      analysis?: BiasAnalysis;
      progress?: AnalysisProgress;
    }) => {
      if (msg.type === "ANALYSIS_UPDATED") {
        setAnalysis(msg.analysis ?? null);
        setBusy(false);
        setProgress({ stage: "done", percent: 100 });
        setDismissed(new Set());
        void load();
      }
      if (msg.type === "ANALYSIS_PROGRESS" && msg.progress) {
        setProgress(msg.progress);
        if (
          msg.progress.stage === "analyzing" ||
          msg.progress.stage === "extracting" ||
          msg.progress.stage === "highlighting"
        ) {
          setBusy(true);
        }
        if (msg.progress.stage === "done" || msg.progress.stage === "error") {
          setBusy(false);
        }
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);

    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "session") return;
      const focus = changes.bn_focus_instance?.newValue as
        | { id: string }
        | undefined;
      if (focus?.id) {
        setSelectedId(focus.id);
        setTab("detected");
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const onActivated = () => {
      void load();
    };
    try {
      chrome.tabs.onActivated.addListener(onActivated);
    } catch {
      /* */
    }
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15_000);
    return () => {
      chrome.runtime.onMessage.removeListener(onMsg);
      chrome.storage.onChanged.removeListener(onStorage);
      document.removeEventListener("visibilitychange", onVis);
      try {
        chrome.tabs.onActivated.removeListener(onActivated);
      } catch {
        /* */
      }
      window.clearInterval(poll);
    };
  }, [load]);

  async function applyTheme() {
    const s = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
    if (!s.ok) return;
    applyThemeMode(s.data.theme);
  }

  async function analyze(force = false) {
    setBusy(true);
    setError(null);
    setProgress({ stage: "analyzing", message: "Analyzing…", percent: 40 });
    const res = await sendToBackground<BiasAnalysis>({
      type: "ANALYZE_PAGE",
      force,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setProgress({ stage: "error", message: res.error });
      return;
    }
    setAnalysis(res.data);
    setProgress({ stage: "done", percent: 100 });
    setDismissed(new Set());
  }

  async function openReader() {
    await sendToBackground({ type: "OPEN_READER_MODE" });
  }

  async function analyzeReader() {
    setBusy(true);
    setError(null);
    const res = await sendToBackground<BiasAnalysis>({
      type: "ANALYZE_WITH_READER",
      force: true,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setProgress({ stage: "error", message: res.error });
      return;
    }
    setAnalysis(res.data);
    setProgress({ stage: "done", percent: 100 });
    void load();
  }

  async function analyzePaste() {
    setBusy(true);
    setError(null);
    setProgress({
      stage: "analyzing",
      message: "Research paste…",
      percent: 40,
    });
    const res = await sendToBackground<BiasAnalysis>({
      type: "ANALYZE_PASTED_TEXT",
      text: pasteText,
      sourceUrl: pasteUrl || undefined,
      title: pasteTitle || undefined,
      tryHighlight,
      accessMethod,
      accessNote: accessNote || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setProgress({ stage: "error", message: res.error });
      return;
    }
    setAnalysis(res.data);
    setProgress({ stage: "done", percent: 100 });
    setTab("detected");
    setDismissed(new Set());
  }

  async function fillPasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t?.trim()) setPasteText(t);
    } catch {
      setError("Clipboard permission denied — paste with Ctrl+V instead.");
    }
  }

  async function prefillPasteFromTab() {
    // Best-effort: use active tab URL/title as citation metadata only
    try {
      const [t] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (t?.url && /^https?:/i.test(t.url)) setPasteUrl(t.url);
      if (t?.title) setPasteTitle(t.title);
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    if (!analysis) return [] as BiasInstance[];
    let list = analysis.instances.filter((i) => !dismissed.has(i.id));
    const floor = Math.max(minConf, settings?.minConfidence ?? 0);
    if (floor > 0) {
      list = list.filter((i) => i.confidence >= floor);
    }
    if (filterType !== "all") {
      list = list.filter((i) => i.bias_type === filterType);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.span_text.toLowerCase().includes(q) ||
          i.concise_explanation.toLowerCase().includes(q) ||
          i.detailed_explanation.toLowerCase().includes(q) ||
          i.evidence_or_counter.toLowerCase().includes(q) ||
          i.bias_type.includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortKey === "severity")
        return b.severity - a.severity || b.confidence - a.confidence;
      if (sortKey === "confidence") return b.confidence - a.confidence;
      return a.bias_type.localeCompare(b.bias_type);
    });
    return list;
  }, [analysis, filterType, query, sortKey, dismissed, minConf, settings]);

  const clusters: BiasCluster[] = useMemo(
    () => clusterInstances(filtered, settings?.clusterPanel !== false),
    [filtered, settings?.clusterPanel]
  );

  const selected =
    analysis?.instances.find((i) => i.id === selectedId) ?? null;

  async function scrollTo(id: string) {
    setSelectedId(id);
    await sendToBackground({ type: "SCROLL_TO_INSTANCE", instanceId: id });
  }

  async function feedback(inst: BiasInstance, helpful: boolean) {
    await sendToBackground({
      type: "SUBMIT_FEEDBACK",
      entry: {
        instanceId: inst.id,
        url: analysis?.url || "",
        biasType: inst.bias_type,
        helpful,
      },
    });
    setFeedbackNote(helpful ? "Thanks — marked helpful." : "Thanks — noted.");
    window.setTimeout(() => setFeedbackNote(null), 2000);
  }

  async function doRewrite(inst: BiasInstance) {
    const res = await sendToBackground<{ rephrase: string; notes: string }>({
      type: "REWRITE_SPAN",
      instanceId: inst.id,
    });
    if (res.ok) {
      setRewrite((r) => ({ ...r, [inst.id]: res.data.rephrase }));
    } else {
      setError(res.error);
    }
  }

  function dismissLowConfidence(threshold = 0.6) {
    if (!analysis) return;
    const next = new Set(dismissed);
    for (const i of analysis.instances) {
      if (i.confidence < threshold) next.add(i.id);
    }
    setDismissed(next);
  }

  function dismissOne(id: string) {
    setDismissed((d) => new Set(d).add(id));
    if (selectedId === id) setSelectedId(null);
  }

  function exportMd() {
    if (!analysis) return;
    downloadText(
      `bias-noticer-${Date.now()}.md`,
      analysisToMarkdown(analysis),
      "text/markdown"
    );
  }

  function exportJson() {
    if (!analysis) return;
    downloadText(
      `bias-noticer-${Date.now()}.json`,
      analysisToJson(analysis),
      "application/json"
    );
  }

  function exportPdf() {
    if (!analysis) return;
    openPrintReport(analysis);
  }

  function exportResearchBriefMd() {
    if (!analysis) return;
    const md = researchBriefToMarkdown(analysis, {
      includeExcerpt: includeExcerptInBrief,
      excerpt: pasteText,
    });
    downloadText(researchBriefFilename(analysis), md, "text/markdown");
  }

  function exportResearchBriefJson() {
    if (!analysis) return;
    const name = researchBriefFilename(analysis).replace(/\.md$/, ".json");
    downloadText(
      name,
      researchBriefToJson(analysis, {
        excerpt: includeExcerptInBrief ? pasteText : undefined,
      }),
      "application/json"
    );
  }

  const typeOptions = useMemo(() => {
    if (!analysis) return [] as BiasType[];
    return [...new Set(analysis.instances.map((i) => i.bias_type))];
  }, [analysis]);

  const isScanning =
    busy ||
    progress.stage === "extracting" ||
    progress.stage === "analyzing" ||
    progress.stage === "highlighting";

  async function refreshOutletBoard() {
    setOutletBusy(true);
    const board = await sendToBackground<OutletBoardData>({
      type: "GET_OUTLET_BOARD",
      minSamples: 1,
    });
    setOutletBusy(false);
    if (board.ok) setOutletBoard(board.data);
    if (selectedOutlet) {
      void openOutletDetail(selectedOutlet.outlet.host);
    }
  }

  async function openOutletDetail(host: string) {
    setOutletBusy(true);
    setSelectedJournalist(null);
    const res = await sendToBackground<OutletDetailData>({
      type: "GET_OUTLET_HISTORY",
      host,
    });
    setOutletBusy(false);
    if (res.ok) {
      setSelectedOutlet(res.data);
      setSelectedAuditId(res.data.history[0]?.id ?? null);
      setTab("outlets");
    } else {
      setError(res.error || "No history for that outlet");
    }
  }

  async function openJournalistDetail(key: string) {
    setOutletBusy(true);
    setSelectedOutlet(null);
    const res = await sendToBackground<JournalistDetailData>({
      type: "GET_JOURNALIST_HISTORY",
      key,
    });
    setOutletBusy(false);
    if (res.ok) {
      setSelectedJournalist(res.data);
      setSelectedAuditId(res.data.history[0]?.id ?? null);
      setTab("outlets");
      setScoreboardView("journalists");
    } else {
      setError(res.error || "No history for that journalist");
    }
  }

  async function clearOutletBoard() {
    if (
      !confirm(
        "Clear all local outlet & journalist scores and scan history on this device? This cannot be undone."
      )
    ) {
      return;
    }
    setOutletBusy(true);
    await sendToBackground({ type: "CLEAR_OUTLET_STATS" });
    setSelectedOutlet(null);
    setSelectedJournalist(null);
    setSelectedAuditId(null);
    await refreshOutletBoard();
    setOutletBusy(false);
  }

  function exportOutletBoard() {
    if (!outletBoard) return;
    const blob = new Blob([JSON.stringify(outletBoard, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bn-outlet-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: PanelTab; label: string }[] = [
    { id: "detected", label: "Detected" },
    { id: "summary", label: "Summary" },
    { id: "evidence", label: "Evidence" },
    { id: "outlets", label: "Outlets" },
    { id: "research", label: "Research" },
    { id: "feedback", label: "Feedback" },
    { id: "glossary", label: "Glossary" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-surface-dark/90">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SunglassesIcon className="h-8 w-8" glow />
            <div>
              <h1 className="font-display text-sm font-bold">Bias Noticer</h1>
              <p className="text-[10px] text-slate-500">
                v{APP_VERSION} · prompt {PROMPT_VERSION}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              className="bn-btn-primary px-2.5 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void analyze(false)}
            >
              {busy ? "…" : analysis ? "Re-scan" : "Scan"}
            </button>
            <button
              className="bn-btn-secondary px-2 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void analyze(true)}
              title="Ignore cache"
            >
              Force
            </button>
            <button
              className="bn-btn-secondary px-2 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void openReader()}
              title="Local reader extract (Alt+R)"
            >
              Reader
            </button>
            <button
              className="bn-btn-secondary px-2 py-1.5 text-xs"
              disabled={busy}
              onClick={() => void analyzeReader()}
              title="Analyze using reader extract text"
            >
              Scan reader
            </button>
            <button
              className="bn-btn-ghost px-2 py-1.5 text-xs"
              onClick={() => chrome.runtime.openOptionsPage()}
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
        </div>

        <nav
          className="mt-3 flex flex-wrap gap-1"
          role="tablist"
          aria-label="Side panel sections"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "bn-tab-active" : "bn-tab-idle"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "detected" && analysis
                ? ` (${filtered.length})`
                : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <Disclaimer />

        {pageStatus &&
          (pageStatus.possiblyPaywalled ||
            !pageStatus.canExtract ||
            pageStatus.wordCount < 320) && (
            <section
              className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-3 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              <p className="font-semibold">
                Limited text on this page
                {pageStatus.wordCount
                  ? ` · ~${pageStatus.wordCount} words visible`
                  : ""}
              </p>
              <p className="mt-1 leading-relaxed opacity-90">
                {pageStatus.reason ||
                  "Paywall or meter detected. The side panel still works — analyze the free teaser, use Reader on DOM text, or paste lawfully obtained full text under Research."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="bn-btn-secondary px-2 py-1 text-[11px]"
                  disabled={busy}
                  onClick={() => void openReader()}
                >
                  Reader (DOM)
                </button>
                <button
                  type="button"
                  className="bn-btn-secondary px-2 py-1 text-[11px]"
                  disabled={busy}
                  onClick={() => void analyzeReader()}
                >
                  Scan reader
                </button>
                <button
                  type="button"
                  className="bn-btn-primary px-2 py-1 text-[11px]"
                  onClick={() => setTab("research")}
                >
                  Research paste
                </button>
                <button
                  type="button"
                  className="bn-btn-ghost px-2 py-1 text-[11px]"
                  disabled={busy}
                  onClick={() => void analyze(true)}
                  title="Analyze whatever free text is already on the page"
                >
                  Scan free teaser
                </button>
              </div>
              {pageStatus.url && (
                <p className="mt-2 truncate text-[10px] opacity-70" title={pageStatus.url}>
                  {pageStatus.title || pageStatus.url}
                </p>
              )}
            </section>
          )}

        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {progress.message || progress.stage}
        </div>

        {error && (
          <div
            className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            <strong className="block">Something went wrong</strong>
            {error}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="bn-btn-secondary text-xs"
                onClick={() => void analyze(true)}
              >
                Retry force scan
              </button>
              <button
                className="bn-btn-ghost text-xs"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                Check API key
              </button>
            </div>
          </div>
        )}

        {!settings?.apiKey?.trim() && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs dark:border-sky-500/30 dark:bg-sky-950/40">
            Running without an xAI key uses heuristics only. Add a key in
            Settings for full BiasExpert analysis.
          </div>
        )}

        {isScanning && !analysis && (
          <ScanningOverlay
            message={progress.message || "Scanning with xAI shades…"}
            percent={progress.percent ?? 35}
          />
        )}

        {isScanning && analysis && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-2 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-950/40 dark:text-brand-100">
            {progress.message || "Refining analysis…"} — provisional signals may
            update when the model finishes.
          </div>
        )}

        {!analysis && !isScanning && (
          <div className="bn-card p-6 text-center animate-fade-in">
            <SunglassesIcon className="mx-auto mb-3 h-14 w-14" glow />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Scan the current article for technique-level highlights. On metered
              pages, open <strong>Reader</strong> first, then{" "}
              <strong>Scan reader</strong>.
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Tip: pin Bias Noticer for one-click shades on every article.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                className="bn-btn-secondary text-xs"
                onClick={() => void openReader()}
              >
                Open Reader
              </button>
              <button
                className="bn-btn-primary text-xs"
                disabled={busy}
                onClick={() => void analyze(false)}
              >
                Put on shades
              </button>
            </div>
          </div>
        )}

        {analysis && analysis.instances.length === 0 && !isScanning && (
          <div className="bn-card p-6 text-center animate-fade-in">
            <ScoreGauge
              score={analysis.summary.neutrality_score}
              size={88}
              className="mx-auto"
            />
            <p className="mt-3 text-sm font-semibold">No strong bias signals</p>
            <p className="mt-1 text-xs text-slate-500">
              This piece reads relatively neutral under current sensitivity. Want
              a deeper pass? Switch to Thorough in Settings, or select a paragraph
              and use “Analyze selection” from the context menu.
            </p>
            <button
              className="bn-btn-secondary mt-3 text-xs"
              onClick={() => setTab("summary")}
            >
              View summary
            </button>
          </div>
        )}

        {analysis && (
          <>
            {tab === "detected" && (
              <section className="space-y-3" role="tabpanel">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[140px] flex-1">
                    <label className="bn-label" htmlFor="bn-search">
                      Search
                    </label>
                    <input
                      id="bn-search"
                      className="bn-input"
                      placeholder="Filter signals…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="bn-label" htmlFor="bn-filter">
                      Type
                    </label>
                    <select
                      id="bn-filter"
                      className="bn-input"
                      value={filterType}
                      onChange={(e) =>
                        setFilterType(e.target.value as BiasType | "all")
                      }
                    >
                      <option value="all">All</option>
                      {typeOptions.map((t) => (
                        <option key={t} value={t}>
                          {getCategoryMeta(t).label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="bn-label" htmlFor="bn-sort">
                      Sort
                    </label>
                    <select
                      id="bn-sort"
                      className="bn-input"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                    >
                      <option value="severity">Severity</option>
                      <option value="confidence">Confidence</option>
                      <option value="type">Type</option>
                    </select>
                  </div>
                  <div>
                    <label className="bn-label" htmlFor="bn-minc">
                      Min conf {(minConf * 100).toFixed(0)}%
                    </label>
                    <input
                      id="bn-minc"
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={minConf}
                      onChange={(e) => setMinConf(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="bn-btn-ghost text-[11px]"
                    onClick={() => dismissLowConfidence(0.6)}
                  >
                    Dismiss all &lt;60% confidence
                  </button>
                  {dismissed.size > 0 && (
                    <button
                      className="bn-btn-ghost text-[11px]"
                      onClick={() => setDismissed(new Set())}
                    >
                      Restore dismissed ({dismissed.size})
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  {filtered.length} of {analysis.instances.length} signals
                  {settings?.clusterPanel !== false
                    ? ` · ${clusters.length} cluster${clusters.length === 1 ? "" : "s"}`
                    : ""}
                </p>

                <ul className="space-y-2">
                  {clusters.map((cluster) => {
                    const multi = cluster.instances.length > 1;
                    const open =
                      !multi ||
                      expandedClusters.has(cluster.id) ||
                      cluster.instances.some((i) => i.id === selectedId);

                    if (!multi) {
                      const inst = cluster.instances[0]!;
                      return (
                        <li key={inst.id}>
                          <SignalCard
                            inst={inst}
                            active={selectedId === inst.id}
                            onSelect={() => {
                              setSelectedId(inst.id);
                              void scrollTo(inst.id);
                            }}
                            onDismiss={() => dismissOne(inst.id)}
                          />
                        </li>
                      );
                    }

                    return (
                      <li key={cluster.id} className="bn-card overflow-hidden">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          onClick={() => {
                            setExpandedClusters((prev) => {
                              const n = new Set(prev);
                              if (n.has(cluster.id)) n.delete(cluster.id);
                              else n.add(cluster.id);
                              return n;
                            });
                          }}
                          aria-expanded={open}
                        >
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <CategoryBadge type={cluster.bias_type} />
                              <span className="text-[11px] text-slate-500">
                                {SEVERITY_LABELS[cluster.maxSeverity]} · avg{" "}
                                {(cluster.avgConfidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-sm font-medium">
                              {cluster.label}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {open ? "Collapse" : "Expand"}
                          </span>
                        </button>
                        {open && (
                          <ul className="space-y-2 border-t border-slate-100 p-2 dark:border-slate-800">
                            {cluster.instances.map((inst) => (
                              <li key={inst.id}>
                                <SignalCard
                                  inst={inst}
                                  active={selectedId === inst.id}
                                  onSelect={() => {
                                    setSelectedId(inst.id);
                                    void scrollTo(inst.id);
                                  }}
                                  onDismiss={() => dismissOne(inst.id)}
                                  compact
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {selected && (
                  <DetailCard
                    selected={selected}
                    rewrite={rewrite[selected.id]}
                    onScroll={() => void scrollTo(selected.id)}
                    onRewrite={() => void doRewrite(selected)}
                    onFeedback={(h) => void feedback(selected, h)}
                  />
                )}
              </section>
            )}

            {tab === "summary" && (
              <section className="bn-card space-y-3 p-4 animate-fade-in" role="tabpanel">
                <div className="flex items-start gap-4">
                  <ScoreGauge
                    score={analysis.summary.neutrality_score}
                    instances={analysis.instances}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 font-display text-base font-semibold">
                      {analysis.title}
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {analysis.summary.content_type.replace(/_/g, " ")} ·{" "}
                      {analysis.source}
                      {analysis.model ? ` · ${analysis.model}` : ""}
                      {siteAvg != null
                        ? ` · site avg ${siteAvg.toFixed(0)}`
                        : ""}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {analysis.summary.overview}
                    </p>
                    {analysis.summary.top_patterns.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {analysis.summary.top_patterns.map((p) => (
                          <li
                            key={p}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800"
                          >
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <div className="bn-label">Technique breakdown</div>
                  <CategoryBreakdown instances={analysis.instances} />
                </div>
                <ConfidenceBand instances={analysis.instances} />
                {analysis.summary.caveats.length > 0 && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300">
                    {analysis.summary.caveats.join(" · ")}
                  </div>
                )}
                {analysis.notes?.length ? (
                  <div className="text-[11px] text-slate-500">
                    {analysis.notes.join(" ")}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button className="bn-btn-secondary text-xs" onClick={exportMd}>
                    Markdown
                  </button>
                  <button
                    className="bn-btn-secondary text-xs"
                    onClick={exportJson}
                  >
                    JSON
                  </button>
                  <button
                    className="bn-btn-secondary text-xs"
                    onClick={exportPdf}
                    title="Opens a print view — use Save as PDF"
                  >
                    Print / PDF
                  </button>
                  <button
                    className="bn-btn-secondary text-xs"
                    onClick={exportResearchBriefMd}
                    title="Audit trail: source URL + access method + analysis"
                  >
                    Research brief
                  </button>
                </div>
              </section>
            )}

            {tab === "evidence" && (
              <section className="space-y-3 animate-fade-in" role="tabpanel">
                <div className="bn-card p-4">
                  <div className="bn-label">Balance — try searching</div>
                  {analysis.summary.recommended_sources_or_searches.length ? (
                    <ul className="mt-1 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                      {analysis.summary.recommended_sources_or_searches.map(
                        (s) => (
                          <li key={s} className="flex gap-2">
                            <span className="text-brand-500">·</span>
                            <span>{s}</span>
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No recommended searches for this run.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="bn-label">Per-signal counterpoints</div>
                  {filtered.slice(0, 12).map((inst) => (
                    <button
                      key={inst.id}
                      className="bn-signal-card"
                      onClick={() => {
                        setSelectedId(inst.id);
                        setTab("detected");
                        void scrollTo(inst.id);
                      }}
                    >
                      <CategoryBadge type={inst.bias_type} />
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                        {inst.evidence_or_counter || "—"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === "outlets" && (
              <section className="space-y-3 animate-fade-in" role="tabpanel">
                {selectedJournalist ? (
                  <>
                    <div className="bn-card space-y-3 p-4">
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-600 underline dark:text-brand-400"
                        onClick={() => {
                          setSelectedJournalist(null);
                          setSelectedAuditId(null);
                        }}
                      >
                        ← Back to journalists
                      </button>
                      <div className="flex items-start gap-3">
                        <GradeBadge
                          score={selectedJournalist.journalist.avgNeutrality}
                          grade={selectedJournalist.journalist.grade}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <h2 className="text-base font-bold">
                            {selectedJournalist.journalist.name}
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            {selectedJournalist.journalist.gradeLabel ||
                              neutralityToGrade(
                                selectedJournalist.journalist.avgNeutrality
                              ).label}{" "}
                            · avg{" "}
                            <strong>
                              {selectedJournalist.journalist.avgNeutrality}
                            </strong>
                            /100 · {selectedJournalist.journalist.samples}{" "}
                            scan
                            {selectedJournalist.journalist.samples === 1
                              ? ""
                              : "s"}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Grade from articles attributed to this byline on
                            this device. Not a professional rating service —
                            your local audit trail only.
                          </p>
                        </div>
                      </div>
                    </div>
                    <AuditHistoryList
                      history={selectedJournalist.history}
                      selectedAuditId={selectedAuditId}
                      setSelectedAuditId={setSelectedAuditId}
                      onOpenOutlet={(host) => void openOutletDetail(host)}
                    />
                  </>
                ) : selectedOutlet ? (
                  <>
                    <div className="bn-card space-y-3 p-4">
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-600 underline dark:text-brand-400"
                        onClick={() => {
                          setSelectedOutlet(null);
                          setSelectedAuditId(null);
                        }}
                      >
                        ← Back to scoreboard
                      </button>
                      <div className="flex items-start gap-3">
                        <GradeBadge
                          score={selectedOutlet.outlet.avgNeutrality}
                          grade={selectedOutlet.outlet.grade}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <h2 className="text-base font-bold">
                            {selectedOutlet.outlet.host}
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            {selectedOutlet.outlet.gradeLabel ||
                              neutralityToGrade(
                                selectedOutlet.outlet.avgNeutrality
                              ).label}{" "}
                            · avg{" "}
                            <strong>
                              {selectedOutlet.outlet.avgNeutrality}
                            </strong>
                            /100 · {selectedOutlet.outlet.samples} scan
                            {selectedOutlet.outlet.samples === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <AuditHistoryList
                      history={selectedOutlet.history}
                      selectedAuditId={selectedAuditId}
                      setSelectedAuditId={setSelectedAuditId}
                      onOpenJournalist={(key) => void openJournalistDetail(key)}
                    />
                  </>
                ) : (
                  <>
                    <div className="bn-card space-y-2 p-4">
                      <h2 className="text-sm font-semibold">Scoreboard</h2>
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Letter grades for outlets and journalists from your
                        local scans. Click any row for full audit history.
                      </p>
                      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                            scoreboardView === "outlets"
                              ? "bg-white shadow dark:bg-slate-700"
                              : "text-slate-500"
                          }`}
                          onClick={() => setScoreboardView("outlets")}
                        >
                          Outlets
                        </button>
                        <button
                          type="button"
                          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                            scoreboardView === "journalists"
                              ? "bg-white shadow dark:bg-slate-700"
                              : "text-slate-500"
                          }`}
                          onClick={() => setScoreboardView("journalists")}
                        >
                          Journalists
                        </button>
                      </div>
                      {outletBoard && (
                        <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                          <span>
                            <strong>{outletBoard.totals.outlets}</strong>{" "}
                            outlets
                          </span>
                          <span>
                            <strong>
                              {outletBoard.totals.journalists ?? 0}
                            </strong>{" "}
                            journalists
                          </span>
                          <span>
                            <strong>{outletBoard.totals.scans}</strong> scans
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          className="bn-btn-secondary px-2 py-1 text-xs"
                          disabled={outletBusy}
                          onClick={() => void refreshOutletBoard()}
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          className="bn-btn-secondary px-2 py-1 text-xs"
                          disabled={!outletBoard}
                          onClick={exportOutletBoard}
                        >
                          Export JSON
                        </button>
                        <button
                          type="button"
                          className="bn-btn-ghost px-2 py-1 text-xs"
                          disabled={outletBusy}
                          onClick={() => void clearOutletBoard()}
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    {scoreboardView === "outlets" ? (
                      <>
                        {(
                          [
                            {
                              key: "unbiased",
                              title: "Most unbiased outlets",
                              list: outletBoard?.mostUnbiased ?? [],
                              accent:
                                "text-emerald-600 dark:text-emerald-400",
                            },
                            {
                              key: "biased",
                              title: "Most biased outlets",
                              list: outletBoard?.mostBiased ?? [],
                              accent: "text-rose-600 dark:text-rose-400",
                            },
                          ] as const
                        ).map((block) => (
                          <div key={block.key} className="bn-card p-4">
                            <h3
                              className={`mb-2 text-xs font-semibold uppercase tracking-wide ${block.accent}`}
                            >
                              {block.title}
                            </h3>
                            {!block.list.length ? (
                              <p className="text-xs text-slate-500">
                                Scan articles to build the board.
                              </p>
                            ) : (
                              <ol className="space-y-1">
                                {block.list.map((o, i) => (
                                  <li key={`${block.key}-${o.host}`}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                      onClick={() =>
                                        void openOutletDetail(o.host)
                                      }
                                    >
                                      <span className="w-4 shrink-0 text-[10px] text-slate-400">
                                        {i + 1}
                                      </span>
                                      <GradeBadge
                                        score={o.avgNeutrality}
                                        grade={o.grade}
                                        size="sm"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold">
                                          {o.host}
                                        </div>
                                        <div className="truncate text-[10px] text-slate-500">
                                          {o.samples} scans · {o.avgNeutrality}
                                          /100
                                        </div>
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {(
                          [
                            {
                              key: "ju",
                              title: "Most unbiased journalists",
                              list:
                                outletBoard?.mostUnbiasedJournalists ?? [],
                              accent:
                                "text-emerald-600 dark:text-emerald-400",
                            },
                            {
                              key: "jb",
                              title: "Most biased journalists",
                              list: outletBoard?.mostBiasedJournalists ?? [],
                              accent: "text-rose-600 dark:text-rose-400",
                            },
                          ] as const
                        ).map((block) => (
                          <div key={block.key} className="bn-card p-4">
                            <h3
                              className={`mb-2 text-xs font-semibold uppercase tracking-wide ${block.accent}`}
                            >
                              {block.title}
                            </h3>
                            {!block.list.length ? (
                              <p className="text-xs text-slate-500">
                                Bylines are captured from article metadata when
                                available. Scan bylined pieces to build this
                                list.
                              </p>
                            ) : (
                              <ol className="space-y-1">
                                {block.list.map((j, i) => (
                                  <li key={`${block.key}-${j.key}`}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                      onClick={() =>
                                        void openJournalistDetail(j.key)
                                      }
                                    >
                                      <span className="w-4 shrink-0 text-[10px] text-slate-400">
                                        {i + 1}
                                      </span>
                                      <GradeBadge
                                        score={j.avgNeutrality}
                                        grade={j.grade}
                                        size="sm"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold">
                                          {j.name}
                                        </div>
                                        <div className="truncate text-[10px] text-slate-500">
                                          {j.samples} scans · {j.avgNeutrality}
                                          /100 · last on {j.lastHost}
                                        </div>
                                      </div>
                                    </button>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    <div className="bn-card p-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recent audits
                      </h3>
                      {!outletBoard?.recentScans.length ? (
                        <p className="text-xs text-slate-500">No scans yet.</p>
                      ) : (
                        <ul className="max-h-56 space-y-1 overflow-y-auto">
                          {outletBoard.recentScans.map((s) => (
                            <li key={s.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                onClick={() => void openOutletDetail(s.host)}
                              >
                                <GradeBadge
                                  score={s.neutrality}
                                  grade={s.grade}
                                  size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-medium">
                                    {s.title}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {s.authors?.length
                                      ? s.authors.join(", ")
                                      : "No byline"}{" "}
                                    · {s.host} · {s.neutrality}/100
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <details className="bn-card p-3 text-[10px] text-slate-500">
                      <summary className="cursor-pointer font-semibold">
                        Grade scale
                      </summary>
                      <ul className="mt-2 grid grid-cols-2 gap-1">
                        {gradeLegend().map((row) => (
                          <li key={row.grade}>
                            <strong>{row.grade}</strong> · {row.range}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </section>
            )}

            {tab === "research" && (
              <section className="bn-card space-y-3 p-4 animate-fade-in" role="tabpanel">
                <h2 className="text-sm font-semibold">Paste &amp; analyze</h2>
                <p className="text-xs leading-relaxed text-slate-500">
                  Legal research path for paywalled or offline copy. Paste text{" "}
                  <strong>you already have access to</strong> (subscription,
                  library, gift link, free teaser, or notes). Bias Noticer does{" "}
                  <em>not</em> fetch or bypass paywalls. Wayback for this NYT
                  URL currently has no usable public snapshot.
                </p>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Source URL (citation)
                  <input
                    className="bn-input mt-1 w-full text-xs"
                    type="url"
                    placeholder="https://www.nytimes.com/…"
                    value={pasteUrl}
                    onChange={(e) => setPasteUrl(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Title (optional)
                  <input
                    className="bn-input mt-1 w-full text-xs"
                    type="text"
                    placeholder="Article headline"
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  How you got this text
                  <select
                    className="bn-input mt-1 w-full text-xs"
                    value={accessMethod}
                    onChange={(e) =>
                      setAccessMethod(e.target.value as ResearchAccessMethod)
                    }
                  >
                    {(
                      Object.keys(ACCESS_METHOD_LABELS) as ResearchAccessMethod[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {ACCESS_METHOD_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Access note (optional)
                  <input
                    className="bn-input mt-1 w-full text-xs"
                    type="text"
                    placeholder="e.g. NYPL card, gift link, free article remaining"
                    value={accessNote}
                    onChange={(e) => setAccessNote(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Article text
                  <textarea
                    className="bn-input mt-1 min-h-[180px] w-full resize-y font-mono text-[11px] leading-relaxed"
                    placeholder="Paste full article text here…"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                </label>
                <p className="text-[10px] text-slate-400">
                  {pasteText.trim()
                    ? `${pasteText.trim().split(/\s+/).filter(Boolean).length} words · ${pasteText.length} chars`
                    : "Empty"}
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={tryHighlight}
                    onChange={(e) => setTryHighlight(e.target.checked)}
                  />
                  Try to highlight matching spans on the current page
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeExcerptInBrief}
                    onChange={(e) => setIncludeExcerptInBrief(e.target.checked)}
                  />
                  Include source excerpt in research brief export
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="bn-btn-primary px-3 py-1.5 text-xs"
                    disabled={busy || pasteText.trim().length < 80}
                    onClick={() => void analyzePaste()}
                  >
                    {busy ? "Analyzing…" : "Analyze paste"}
                  </button>
                  <button
                    className="bn-btn-secondary px-2 py-1.5 text-xs"
                    type="button"
                    onClick={() => void fillPasteFromClipboard()}
                  >
                    From clipboard
                  </button>
                  <button
                    className="bn-btn-secondary px-2 py-1.5 text-xs"
                    type="button"
                    onClick={() => void prefillPasteFromTab()}
                  >
                    Use tab URL
                  </button>
                  <button
                    className="bn-btn-ghost px-2 py-1.5 text-xs"
                    type="button"
                    onClick={() => {
                      setPasteText("");
                      setPasteTitle("");
                      setAccessNote("");
                    }}
                  >
                    Clear
                  </button>
                </div>
                {analysis && (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Research brief
                    </p>
                    {analysis.research ? (
                      <p className="mb-2 text-[10px] leading-relaxed text-slate-500">
                        {ACCESS_METHOD_LABELS[analysis.research.accessMethod]} ·{" "}
                        {analysis.research.wordCount} words ·{" "}
                        {analysis.research.sourceUrl}
                      </p>
                    ) : (
                      <p className="mb-2 text-[10px] text-slate-500">
                        Last scan had no paste provenance — brief will note that.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="bn-btn-secondary px-2 py-1.5 text-xs"
                        type="button"
                        onClick={exportResearchBriefMd}
                      >
                        Save brief (.md)
                      </button>
                      <button
                        className="bn-btn-secondary px-2 py-1.5 text-xs"
                        type="button"
                        onClick={exportResearchBriefJson}
                      >
                        Save brief (.json)
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === "feedback" && (
              <section className="bn-card space-y-3 p-4 animate-fade-in" role="tabpanel">
                <h2 className="text-sm font-semibold">Your feedback</h2>
                <p className="text-xs text-slate-500">
                  Feedback is stored locally only (unless you opt in later in
                  Settings). It never includes full article text.
                </p>
                {feedbackNote && (
                  <p className="text-xs font-medium text-brand-600">{feedbackNote}</p>
                )}
                {selected ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      Rate signal:{" "}
                      <span className="font-medium">
                        {getCategoryMeta(selected.bias_type).label}
                      </span>
                    </p>
                    <blockquote className="border-l-2 border-brand-400 pl-2 text-xs italic">
                      {selected.span_text}
                    </blockquote>
                    <div className="flex gap-2">
                      <button
                        className="bn-btn-secondary text-xs"
                        onClick={() => void feedback(selected, true)}
                      >
                        Helpful
                      </button>
                      <button
                        className="bn-btn-ghost text-xs"
                        onClick={() => void feedback(selected, false)}
                      >
                        Not really
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Select a signal on the Detected tab, then return here to rate
                    it.
                  </p>
                )}
                <button
                  className="bn-btn-ghost text-xs"
                  onClick={() => chrome.runtime.openOptionsPage()}
                >
                  Methodology & privacy →
                </button>
              </section>
            )}

            {tab === "glossary" && (
              <section className="space-y-2 animate-fade-in" role="tabpanel">
                <p className="text-xs text-slate-500">
                  Directionally agnostic technique glossary. Full methodology and
                  system prompt in Settings.
                </p>
                {ALL_BIAS_TYPES.map((t) => {
                  const m = BIAS_TAXONOMY[t];
                  return (
                    <details key={t} className="bn-card p-3 text-sm">
                      <summary className="cursor-pointer font-medium">
                        <span style={{ color: m.hex }}>{m.icon}</span> {m.label}
                      </summary>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {m.shortDefinition}
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <li>· {m.examples[0]}</li>
                        <li>· {m.examples[1]}</li>
                      </ul>
                    </details>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">
        Never censors · Never sells your data · Your key stays local · How
        detection works: Settings → Methodology
      </footer>
    </div>
  );
}

function SignalCard({
  inst,
  active,
  onSelect,
  onDismiss,
  compact,
}: {
  inst: BiasInstance;
  active: boolean;
  onSelect: () => void;
  onDismiss: () => void;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      <button
        className={`bn-signal-card ${active ? "bn-signal-card-active" : ""} ${
          compact ? "p-2.5" : ""
        }`}
        onClick={onSelect}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <CategoryBadge type={inst.bias_type} />
          <span className="text-[11px] text-slate-500">
            {SEVERITY_LABELS[inst.severity]} ·{" "}
            {(inst.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-100">
          “{inst.span_text}”
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
          {inst.concise_explanation}
        </p>
      </button>
      <button
        type="button"
        className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        title="Dismiss this signal"
        aria-label="Dismiss signal"
      >
        ✕
      </button>
    </div>
  );
}

function DetailCard({
  selected,
  rewrite,
  onScroll,
  onRewrite,
  onFeedback,
}: {
  selected: BiasInstance;
  rewrite?: string;
  onScroll: () => void;
  onRewrite: () => void;
  onFeedback: (helpful: boolean) => void;
}) {
  return (
    <section className="bn-card animate-slide-up space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <CategoryBadge type={selected.bias_type} />
        <button
          className="text-xs text-brand-600 dark:text-brand-400"
          onClick={onScroll}
        >
          Scroll to in article
        </button>
      </div>
      <blockquote className="border-l-2 border-brand-400 pl-3 text-sm italic text-slate-700 dark:text-slate-200">
        {selected.span_text}
      </blockquote>
      <div>
        <div className="bn-label">Why this is flagged</div>
        <p className="text-sm leading-relaxed">
          {selected.detailed_explanation || selected.concise_explanation}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {getCategoryMeta(selected.bias_type).shortDefinition}
        </p>
      </div>
      <div>
        <div className="bn-label">Evidence / counterpoints</div>
        <p className="text-sm leading-relaxed">
          {selected.evidence_or_counter || "—"}
        </p>
      </div>
      <div>
        <div className="bn-label">Alternative framing</div>
        <p className="text-sm leading-relaxed">
          {selected.alternative_perspective || "—"}
        </p>
      </div>
      {(selected.suggested_rephrase || rewrite) && (
        <div>
          <div className="bn-label">Neutral rephrase</div>
          <p className="rounded-xl bg-slate-50 p-2 text-sm dark:bg-slate-800/80">
            {rewrite || selected.suggested_rephrase}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="bn-btn-secondary text-xs" onClick={onRewrite}>
          Generate balanced rewrite
        </button>
        <button
          className="bn-btn-ghost text-xs"
          onClick={() => onFeedback(true)}
        >
          Helpful
        </button>
        <button
          className="bn-btn-ghost text-xs"
          onClick={() => onFeedback(false)}
        >
          Not really
        </button>
      </div>
    </section>
  );
}
