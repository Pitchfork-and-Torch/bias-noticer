import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "../../components/CategoryBadge";
import { Disclaimer } from "../../components/Disclaimer";
import { ScoreGauge } from "../../components/ScoreGauge";
import { ScanningOverlay } from "../../components/ScanningOverlay";
import { SunglassesIcon } from "../../components/SunglassesIcon";
import { sendToBackground, getActiveTab } from "../../lib/messaging";
import { getCategoryMeta } from "../../lib/taxonomy";
import type {
  AnalysisProgress,
  BiasAnalysis,
  ExtensionSettings,
} from "../../lib/types";
import { applyTheme as applyThemeMode } from "../../lib/theme";
import { APP_VERSION } from "../../lib/version";

export function PopupApp() {
  const [analysis, setAnalysis] = useState<BiasAnalysis | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({ stage: "idle" });
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageTitle, setPageTitle] = useState("");

  const refresh = useCallback(async () => {
    const tab = await getActiveTab();
    setPageTitle(tab?.title || "");
    const s = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
    if (s.ok) setSettings(s.data);
    const a = await sendToBackground<{
      analysis: BiasAnalysis | null;
      progress: AnalysisProgress;
    }>({ type: "GET_ANALYSIS" });
    if (a.ok) {
      setAnalysis(a.data.analysis);
      setProgress(a.data.progress);
    }
  }, []);

  useEffect(() => {
    void refresh();
    applyTheme();
    const listener = (msg: {
      type?: string;
      analysis?: BiasAnalysis;
      progress?: AnalysisProgress;
    }) => {
      if (msg.type === "ANALYSIS_UPDATED") {
        setAnalysis(msg.analysis ?? null);
        setProgress({ stage: "done", percent: 100 });
        setBusy(false);
      }
      if (msg.type === "ANALYSIS_PROGRESS" && msg.progress) {
        setProgress(msg.progress);
        if (msg.progress.stage === "analyzing" || msg.progress.stage === "extracting") {
          setBusy(true);
        }
        if (msg.progress.stage === "done" || msg.progress.stage === "error") {
          setBusy(false);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [refresh]);

  async function applyTheme() {
    const s = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
    if (!s.ok) return;
    applyThemeMode(s.data.theme);
  }

  async function analyze(force = false) {
    setBusy(true);
    setError(null);
    setProgress({ stage: "analyzing", message: "Working…", percent: 40 });
    try {
      const tab = await getActiveTab();
      const res = await sendToBackground<BiasAnalysis>(
        {
          type: "ANALYZE_PAGE",
          force,
          tabId: tab?.id,
        },
        { timeoutMs: 150_000 }
      );
      if (!res.ok) {
        setError(res.error);
        setProgress({ stage: "error", message: res.error });
        return;
      }
      setAnalysis(res.data);
      setProgress({ stage: "done", percent: 100 });
    } finally {
      setBusy(false);
    }
  }

  async function runDemo() {
    setBusy(true);
    setError(null);
    setProgress({ stage: "analyzing", message: "Demo mode…", percent: 30 });
    try {
      const tab = await getActiveTab();
      const res = await sendToBackground<BiasAnalysis>(
        {
          type: "RUN_DEMO",
          tabId: tab?.id,
        },
        { timeoutMs: 60_000 }
      );
      if (!res.ok) {
        setError(res.error);
        setProgress({ stage: "error", message: res.error });
        return;
      }
      setAnalysis(res.data);
      setProgress({ stage: "done", percent: 100 });
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    await sendToBackground({ type: "CLEAR_HIGHLIGHTS" });
    setAnalysis(null);
    setProgress({ stage: "idle" });
  }

  /**
   * Open side panel from the popup click itself (user gesture).
   * Routing through the service worker loses the gesture and Chrome rejects
   * sidePanel.open() — that was the "Could not analyze / sidePanel.open" bug.
   */
  function openPanel() {
    setError(null);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setError("No active tab. Focus an article tab, then try again.");
        return;
      }
      const tabId = tab.id;
      // Keep this chain tight so the user gesture is still valid
      chrome.sidePanel.setOptions(
        { tabId, path: "sidepanel.html", enabled: true },
        () => {
          chrome.sidePanel
            .open({ tabId })
            .then(() => {
              window.close();
            })
            .catch(() => {
              // windowId fallback
              if (typeof tab.windowId === "number") {
                chrome.sidePanel
                  .open({ windowId: tab.windowId })
                  .then(() => window.close())
                  .catch((e: Error) => {
                    setError(
                      `Side panel blocked (${e?.message || "no gesture"}). Press Ctrl+Shift+Y on the article tab, or right‑click → Open Bias Noticer side panel.`
                    );
                  });
              } else {
                setError(
                  "Side panel blocked. Press Ctrl+Shift+Y on the article tab."
                );
              }
            });
        }
      );
    });
  }

  async function nav(delta: number) {
    await sendToBackground({ type: "NAV_HIGHLIGHT", delta });
  }

  const counts = useMemo(() => {
    if (!analysis) return [] as { type: string; n: number }[];
    const m = new Map<string, number>();
    for (const i of analysis.instances) {
      m.set(i.bias_type, (m.get(i.bias_type) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, n]) => ({ type, n }));
  }, [analysis]);

  const hasKey = Boolean(settings?.apiKey?.trim());

  return (
    <div className="w-[360px] p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SunglassesIcon className="h-9 w-9" glow />
          <div>
            <h1 className="font-display text-base font-bold leading-tight">
              Bias Noticer
            </h1>
            <p className="text-[11px] text-slate-500">
              See through the propaganda. · v{APP_VERSION}
            </p>
          </div>
        </div>
        <button
          className="bn-btn-ghost px-2 py-1 text-xs"
          onClick={() => chrome.runtime.openOptionsPage()}
          title="Settings"
        >
          Settings
        </button>
      </header>

      {settings && !settings.onboardingComplete && (
        <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-950 dark:border-brand-500/30 dark:bg-brand-950/40 dark:text-brand-100">
          <strong>Welcome.</strong> Pin Bias Noticer from the extensions menu,
          then take the short tour.{" "}
          <button
            className="font-semibold underline"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Open tour
          </button>
        </div>
      )}

      <p className="mb-3 line-clamp-2 text-xs text-slate-500" title={pageTitle}>
        {pageTitle || "Current tab"}
      </p>

      {!hasKey && (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-100">
          No xAI API key — using local heuristics.{" "}
          <button
            className="font-semibold underline"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Add key for full power
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className="bn-btn-primary flex-1"
          disabled={busy}
          onClick={() => void analyze(false)}
        >
          {busy ? "Scanning…" : analysis ? "Re-scan" : "Put on shades"}
        </button>
        <button
          className="bn-btn-secondary"
          disabled={busy}
          onClick={() => void analyze(true)}
          title="Ignore cache"
        >
          Force
        </button>
        <button
          className="bn-btn-secondary"
          disabled={busy}
          onClick={() => void sendToBackground({ type: "OPEN_READER_MODE" })}
          title="Local reader extract (Alt+R)"
        >
          Reader
        </button>
        <button
          className="bn-btn-secondary"
          disabled={busy}
          onClick={() => void runDemo()}
          title="Paint demo highlights on this page (no API)"
        >
          Demo
        </button>
        <button
          className="bn-btn-secondary"
          disabled={busy}
          onClick={() => openPanel()}
          title="Open side panel (user gesture). Or press Ctrl+Shift+Y"
        >
          Panel
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-snug text-slate-500">
        <strong>Ctrl+Shift+Y</strong> side panel · <strong>Ctrl+Shift+B</strong>{" "}
        shades · paywalled pages: Reader / Research paste (no bypass).
      </p>

      {busy && !analysis && (
        <div className="mb-3">
          <ScanningOverlay
            message={progress.message || "Scanning with xAI shades…"}
            percent={progress.percent ?? 40}
            showSkeleton={false}
          />
        </div>
      )}

      {progress.stage !== "idle" &&
        progress.stage !== "done" &&
        analysis && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-slate-500">
            <span>{progress.message || progress.stage}</span>
            <span>{progress.percent ?? 0}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progress.percent ?? 30}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200" role="alert">
          <strong className="block">
            {/sidePanel|side panel|Ctrl\+Shift\+Y/i.test(error)
              ? "Side panel"
              : "Could not analyze"}
          </strong>
          {error}
          {!/sidePanel|side panel|Ctrl\+Shift\+Y/i.test(error) && (
            <button
              className="mt-1 font-semibold underline"
              onClick={() => void analyze(true)}
            >
              Retry with force scan
            </button>
          )}
        </div>
      )}

      {analysis ? (
        <div className="bn-card animate-fade-in p-3">
          <div className="flex items-center gap-4">
            <ScoreGauge
              score={
                typeof analysis.summary.calibrated_neutrality === "number"
                  ? analysis.summary.calibrated_neutrality
                  : analysis.summary.neutrality_score
              }
              size={88}
              instances={analysis.instances}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {analysis.summary.content_type.replace(/_/g, " ")} ·{" "}
                {analysis.source}
              </div>
              <p className="mt-1 line-clamp-3 text-sm leading-snug text-slate-700 dark:text-slate-200">
                {analysis.summary.overview}
              </p>
              <div className="mt-2 text-sm font-semibold">
                {analysis.instances.length} signal
                {analysis.instances.length === 1 ? "" : "s"}
              </div>
              {analysis.highlightStats && (
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {analysis.highlightStats.applied} on page
                  {analysis.highlightStats.missed
                    ? ` · ${analysis.highlightStats.missed} unmatched`
                    : ""}
                  {analysis.highlightStats.fuzzy
                    ? ` · ${analysis.highlightStats.fuzzy} fuzzy`
                    : ""}
                </div>
              )}
            </div>
          </div>

          {counts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {counts.map(({ type, n }) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <CategoryBadge type={type as never} />
                  <span className="text-[11px] text-slate-500">×{n}</span>
                </span>
              ))}
            </div>
          )}

          {analysis.instances[0] && (
            <button
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-left text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
              onClick={() => void openPanel()}
            >
              <div className="mb-1">
                <CategoryBadge type={analysis.instances[0].bias_type} />
              </div>
              <div className="line-clamp-2 text-slate-600 dark:text-slate-300">
                “{analysis.instances[0].span_text}”
              </div>
              <div className="mt-1 text-[11px] text-brand-600 dark:text-brand-400">
                Open side panel for full context →
              </div>
            </button>
          )}

          <div className="mt-3 flex gap-2">
            <button className="bn-btn-primary flex-1" onClick={() => void openPanel()}>
              Side panel
            </button>
            <button
              className="bn-btn-secondary px-2"
              title="Previous signal (Alt+[)"
              onClick={() => void nav(-1)}
            >
              ‹
            </button>
            <button
              className="bn-btn-secondary px-2"
              title="Next signal (Alt+])"
              onClick={() => void nav(1)}
            >
              ›
            </button>
            <button className="bn-btn-ghost" onClick={() => void clearAll()}>
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="bn-card p-4 text-center">
          <SunglassesIcon className="mx-auto mb-2 h-12 w-12 opacity-80" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Activate shades on a news or long-form page to reveal rhetorical
            techniques and framing choices.
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            Ctrl/⌘+Shift+B · Demo paints sample highlights · Alt+[ ] navigate
          </p>
        </div>
      )}

      <div className="mt-3">
        <Disclaimer compact />
      </div>
    </div>
  );
}

// silence unused in strict builds
void getCategoryMeta;
