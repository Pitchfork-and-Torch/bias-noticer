/**
 * Bias Noticer — Service worker (Manifest V3 background)
 *
 * Orchestrates:
 *  - Analysis requests (extract → Grok or heuristics → cache)
 *  - Demo mode for live UX testing without API
 *  - Progress broadcast + action badge
 *  - Side panel, keyboard commands, context menu
 */

import { analyzeWithGrok, rewriteSpanWithGrok, testApiKey } from "../lib/api";
import {
  clearTab,
  getTabAnalysis,
  getTabProgress,
  setTabAnalysis,
  setTabProgress,
} from "../lib/cache";
import { runHeuristicAnalysis } from "../lib/heuristics";
import { buildPageDemoAnalysis } from "../lib/mock-analysis";
import {
  buildThinPageAnalysis,
  isTooThinForModel,
} from "../lib/thin-analysis";
import { domainAllowed, isLikelyNewsDomain } from "../lib/news-domains";
import { getPromptMeta } from "../lib/prompt";
import { resolvePreset } from "../lib/presets";
import {
  addFeedback,
  getCachedAnalysis,
  getSettings,
  hashString,
  saveSettings,
  setCachedAnalysis,
} from "../lib/storage";
import {
  clearOutletStats,
  getOutletBoard,
  getOutletHistory,
  getJournalistHistory,
  getSiteRating,
  recordArticleScan,
} from "../lib/site-cache";
import type {
  AnalysisProgress,
  BiasAnalysis,
  MessageResponse,
  MessageType,
  PageExtract,
} from "../lib/types";

/** Debounce map for smart auto-scan */
const autoScanTimers = new Map<number, number>();
/** In-flight analysis locks */
const analyzing = new Set<number>();

export default defineBackground(() => {
  try {
    // Popup remains the toolbar default; panel opens via Ctrl+Shift+Y, menu, or popup button.
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
    chrome.sidePanel?.setOptions?.({ path: "sidepanel.html", enabled: true });
  } catch {
    /* older chrome */
  }

  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      chrome.runtime.openOptionsPage();
    }
    try {
      await chrome.sidePanel?.setOptions?.({
        path: "sidepanel.html",
        enabled: true,
      });
    } catch {
      /* */
    }
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "bn-analyze-page",
        title: "Analyze page with Bias Noticer",
        contexts: ["page"],
      });
      chrome.contextMenus.create({
        id: "bn-analyze-selection",
        title: "Analyze selection with Bias Noticer",
        contexts: ["selection"],
      });
      chrome.contextMenus.create({
        id: "bn-demo",
        title: "Bias Noticer: Demo highlights on this page",
        contexts: ["page"],
      });
      chrome.contextMenus.create({
        id: "bn-open-panel",
        title: "Open Bias Noticer side panel",
        contexts: ["page", "action"],
      });
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "bn-open-panel") {
      // Context menu counts as a user gesture — open is allowed here
      await openSidePanel(tab.id);
      return;
    }
    if (info.menuItemId === "bn-analyze-page") {
      // Analyze first; open panel only as soft UX (gesture still valid in this handler)
      try {
        await runAnalysisForTab(tab.id, true);
      } catch (e) {
        console.warn("analyze-page failed", e);
      }
      await openSidePanel(tab.id); // ignore failure
    } else if (info.menuItemId === "bn-analyze-selection" && info.selectionText) {
      try {
        await runSelectionAnalysis(tab.id, info.selectionText);
      } catch (e) {
        console.warn("selection analyze failed", e);
      }
      await openSidePanel(tab.id);
    } else if (info.menuItemId === "bn-demo") {
      try {
        await runDemoForTab(tab.id);
      } catch (e) {
        console.warn("demo failed", e);
      }
      await openSidePanel(tab.id);
    }
  });

  chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) return;
    if (command === "toggle-analysis") {
      const existing = getTabAnalysis(tab.id);
      if (existing) {
        setTabAnalysis(tab.id, null);
        setTabProgress(tab.id, { stage: "idle" });
        await updateBadge(tab.id, null);
        await chrome.tabs
          .sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" })
          .catch(() => {});
      } else {
        // Never fail analysis because panel open failed
        try {
          await runAnalysisForTab(tab.id, false);
        } catch (e) {
          console.warn("toggle-analysis failed", e);
        }
        // Soft-open: keyboard command is a valid gesture on most Chromium builds
        await openSidePanel(tab.id);
      }
    } else if (command === "open-side-panel") {
      await openSidePanel(tab.id);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTab(tabId);
    analyzing.delete(tabId);
    autoScanTimers.delete(tabId);
  });

  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    await updateBadge(tabId, getTabAnalysis(tabId));
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message as MessageType, sender)
      .then(sendResponse)
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        } satisfies MessageResponse)
      );
    return true;
  });

  // Smart auto-scan (debounced)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.url) return;
    if (!/^https?:/i.test(tab.url)) return;
    const settings = await getSettings();
    if (!settings.smartAutoScan) return;
    if (
      !domainAllowed(tab.url, settings.domainWhitelist, settings.domainBlacklist)
    ) {
      return;
    }
    if (
      settings.domainWhitelist.length === 0 &&
      !isLikelyNewsDomain(tab.url)
    ) {
      return;
    }
    if (getTabAnalysis(tabId) || analyzing.has(tabId)) return;

    const prev = autoScanTimers.get(tabId);
    if (prev) clearTimeout(prev);
    const handle = setTimeout(() => {
      void runAnalysisForTab(tabId, false);
    }, 1200) as unknown as number;
    autoScanTimers.set(tabId, handle);
  });
});

/**
 * Open the side panel for a tab. Prefer windowId (more reliable on some
 * Chromium builds). Must run from a user gesture when possible (toolbar /
 * command / popup). Content-script requests may fail — callers should surface
 * the Ctrl+Shift+Y fallback.
 */
async function openSidePanel(tabId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const tab = await chrome.tabs.get(tabId);
    // Enable panel for this tab explicitly (helps after navigation / paywall shells)
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: true,
      });
    } catch {
      /* setOptions optional on older builds */
    }
    if (typeof tab.windowId === "number") {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        return { ok: true };
      } catch {
        /* fall through to tabId */
      }
    }
    await chrome.sidePanel.open({ tabId });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("sidePanel.open failed", msg);
    return {
      ok: false,
      error:
        msg ||
        "Could not open side panel. Press Ctrl+Shift+Y (⌘⇧Y) or use the toolbar puzzle menu.",
    };
  }
}

function broadcastProgress(tabId: number, progress: AnalysisProgress) {
  setTabProgress(tabId, progress);
  chrome.runtime
    .sendMessage({ type: "ANALYSIS_PROGRESS", progress, tabId } satisfies MessageType)
    .catch(() => {});
}

async function updateBadge(tabId: number, analysis: BiasAnalysis | null) {
  try {
    if (!analysis) {
      await chrome.action.setBadgeText({ tabId, text: "" });
      return;
    }
    const n = analysis.instances.length;
    await chrome.action.setBadgeText({
      tabId,
      text: n > 0 ? String(Math.min(n, 99)) : "0",
    });
    const score = analysis.summary.neutrality_score;
    const color =
      score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : score >= 30 ? "#ea580c" : "#dc2626";
    await chrome.action.setBadgeBackgroundColor({ tabId, color });
    await chrome.action.setTitle({
      tabId,
      title: `Bias Noticer · ${n} signals · neutrality ${score}`,
    });
  } catch {
    /* badge APIs unavailable */
  }
}

async function handleMessage(
  message: MessageType,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  // Explicit tabId on the message wins (popup/sidepanel can pass it).
  // Otherwise only trust sender.tab for real http(s) pages — extension pages
  // opened as tabs also set sender.tab and must not steal the target.
  const explicitTabId =
    "tabId" in message && typeof (message as { tabId?: number }).tabId === "number"
      ? (message as { tabId?: number }).tabId
      : undefined;
  const tabId =
    explicitTabId ?? (await resolveTargetTabId(sender));

  switch (message.type) {
    case "GET_SETTINGS": {
      return { ok: true, data: await getSettings() };
    }
    case "SAVE_SETTINGS": {
      return { ok: true, data: await saveSettings(message.settings) };
    }
    case "TEST_API_KEY": {
      const settings = await getSettings();
      const key = message.apiKey ?? settings.apiKey;
      const result = await testApiKey(key, settings.model);
      return result.ok
        ? { ok: true, data: result }
        : { ok: false, error: result.error };
    }
    case "ANALYZE_PAGE": {
      const id = tabId;
      if (!id) return { ok: false, error: "No active tab" };
      const analysis = await runAnalysisForTab(id, Boolean(message.force));
      return { ok: true, data: analysis };
    }
    case "RUN_DEMO": {
      const id = tabId;
      if (!id) return { ok: false, error: "No active tab" };
      const analysis = await runDemoForTab(id);
      return { ok: true, data: analysis };
    }
    case "ANALYZE_SELECTION": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No active tab" };
      const analysis = await runSelectionAnalysis(id, message.text);
      return { ok: true, data: analysis };
    }
    case "ANALYZE_PASTED_TEXT": {
      const id = tabId ?? (await activeTabId());
      if (!id) {
        // Panel-only analysis without a content tab is still useful for research.
        // Use a synthetic tab id bucket of 0 for cache.
        const analysis = await runPastedTextAnalysis(0, message);
        return { ok: true, data: analysis };
      }
      const analysis = await runPastedTextAnalysis(id, message);
      return { ok: true, data: analysis };
    }
    case "GET_ANALYSIS": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: true, data: { analysis: null, progress: { stage: "idle" } } };
      return {
        ok: true,
        data: {
          analysis: getTabAnalysis(id),
          progress: getTabProgress(id),
        },
      };
    }
    case "CLEAR_HIGHLIGHTS": {
      const id = tabId ?? (await activeTabId());
      if (id) {
        setTabAnalysis(id, null);
        setTabProgress(id, { stage: "idle" });
        await updateBadge(id, null);
        await chrome.tabs
          .sendMessage(id, { type: "CLEAR_HIGHLIGHTS" })
          .catch(() => {});
      }
      return { ok: true, data: true };
    }
    case "SCROLL_TO_INSTANCE": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      await chrome.tabs
        .sendMessage(id, {
          type: "SCROLL_TO_INSTANCE",
          instanceId: message.instanceId,
        })
        .catch(() => {});
      return { ok: true, data: true };
    }
    case "NAV_HIGHLIGHT": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      const res = await chrome.tabs
        .sendMessage(id, { type: "NAV_HIGHLIGHT", delta: message.delta })
        .catch(() => null);
      return { ok: true, data: res };
    }
    case "REWRITE_SPAN": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      const analysis = getTabAnalysis(id);
      const inst = analysis?.instances.find((i) => i.id === message.instanceId);
      if (!inst) return { ok: false, error: "Instance not found" };
      const settings = await getSettings();
      const result = await rewriteSpanWithGrok(settings, {
        span: inst.span_text,
        context: inst.context || inst.span_text,
        biasType: inst.bias_type,
        explanation: inst.concise_explanation,
      });
      return { ok: true, data: result };
    }
    case "SUBMIT_FEEDBACK": {
      return { ok: true, data: await addFeedback(message.entry) };
    }
    case "OPEN_SIDE_PANEL": {
      const id =
        ("tabId" in message && typeof message.tabId === "number"
          ? message.tabId
          : undefined) ??
        tabId ??
        (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      const opened = await openSidePanel(id);
      return opened.ok
        ? { ok: true, data: true }
        : {
            ok: false,
            error:
              opened.error ||
              "Side panel blocked (need a user gesture). Press Ctrl+Shift+Y.",
          };
    }
    case "GET_PAGE_STATUS": {
      const id =
        ("tabId" in message && typeof message.tabId === "number"
          ? message.tabId
          : undefined) ??
        tabId ??
        (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      try {
        const tab = await chrome.tabs.get(id);
        const url = tab.url || "";
        if (!/^https?:/i.test(url)) {
          return {
            ok: true,
            data: {
              tabId: id,
              url,
              title: tab.title || "",
              wordCount: 0,
              possiblyPaywalled: false,
              canExtract: false,
              reason: "Not an http(s) page",
            },
          };
        }
        const ok = await ensureContentScript(id);
        if (!ok) {
          return {
            ok: true,
            data: {
              tabId: id,
              url,
              title: tab.title || "",
              wordCount: 0,
              possiblyPaywalled: true,
              canExtract: false,
              reason:
                "Content script could not attach (page may still be loading). Use Research paste or wait and retry.",
            },
          };
        }
        const res = (await chrome.tabs.sendMessage(id, {
          type: "GET_PAGE_META",
        })) as MessageResponse<PageExtract>;
        if (!res?.ok || !res.data) {
          return {
            ok: true,
            data: {
              tabId: id,
              url,
              title: tab.title || "",
              wordCount: 0,
              possiblyPaywalled: true,
              canExtract: false,
              reason: res && !res.ok ? res.error : "Extract failed",
            },
          };
        }
        const ex = res.data;
        return {
          ok: true,
          data: {
            tabId: id,
            url: ex.url,
            title: ex.title,
            wordCount: ex.wordCount,
            possiblyPaywalled: ex.possiblyPaywalled,
            canExtract: true,
            extractSource: ex.extractSource,
            reason: ex.possiblyPaywalled
              ? "Limited text on page — use Reader on DOM text, Research paste, or a subscription/library login."
              : undefined,
          },
        };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    case "HIGHLIGHT_CLICKED": {
      await chrome.storage.session.set({
        bn_focus_instance: {
          id: message.instanceId,
          at: Date.now(),
        },
      });
      return { ok: true, data: true };
    }
    case "HIGHLIGHT_STATS": {
      const id = tabId ?? (await activeTabId());
      if (id && message.stats) {
        const current = getTabAnalysis(id);
        if (current) {
          const next = { ...current, highlightStats: message.stats };
          setTabAnalysis(id, next);
        }
      }
      return { ok: true, data: true };
    }
    case "OPEN_READER_MODE": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      await ensureContentScript(id);
      await chrome.tabs
        .sendMessage(id, { type: "OPEN_READER_MODE" })
        .catch(() => {});
      return { ok: true, data: true };
    }
    case "CLOSE_READER_MODE": {
      const id = tabId ?? (await activeTabId());
      if (id) {
        await chrome.tabs
          .sendMessage(id, { type: "CLOSE_READER_MODE" })
          .catch(() => {});
      }
      return { ok: true, data: true };
    }
    case "ANALYZE_WITH_READER": {
      const id = tabId ?? (await activeTabId());
      if (!id) return { ok: false, error: "No tab" };
      const analysis = await runAnalysisForTab(id, true, {
        preferReader: true,
      });
      return { ok: true, data: analysis };
    }
    case "GET_SITE_RATING": {
      const id = tabId ?? (await activeTabId());
      let url = "";
      if (id) {
        const tab = await chrome.tabs.get(id).catch(() => null);
        url = tab?.url || "";
      }
      if (!url) {
        const [active] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        url = active?.url || "";
      }
      const rating = url ? await getSiteRating(url) : null;
      return { ok: true, data: rating };
    }
    case "GET_OUTLET_BOARD": {
      const board = await getOutletBoard({
        minSamples: message.minSamples ?? 1,
        limit: 20,
        recentLimit: 50,
      });
      return { ok: true, data: board };
    }
    case "GET_OUTLET_HISTORY": {
      const detail = await getOutletHistory(message.host);
      return detail
        ? { ok: true, data: detail }
        : { ok: false, error: "No history for that outlet yet" };
    }
    case "GET_JOURNALIST_HISTORY": {
      const detail = await getJournalistHistory(message.key);
      return detail
        ? { ok: true, data: detail }
        : { ok: false, error: "No history for that journalist yet" };
    }
    case "CLEAR_OUTLET_STATS": {
      await clearOutletStats();
      return { ok: true, data: true };
    }
    case "GET_PROMPT_META": {
      return { ok: true, data: getPromptMeta() };
    }
    case "CONTENT_EXTRACTED":
    case "ANALYSIS_UPDATED":
    case "ANALYSIS_PROGRESS":
    case "GET_PAGE_META":
    case "SHOW_PAYWALL":
    case "SHADES_TOAST":
    case "ERROR":
      return { ok: true, data: null };
    default:
      return { ok: false, error: "Unknown message" };
  }
}

/**
 * Prefer the sender's tab only when it is a normal web page. Messages from
 * options/sidepanel/popup tabs must fall through to the focused article tab.
 */
async function resolveTargetTabId(
  sender: chrome.runtime.MessageSender
): Promise<number | null> {
  const url = sender.tab?.url || "";
  if (sender.tab?.id != null && /^https?:\/\//i.test(url)) {
    return sender.tab.id;
  }
  return activeTabId();
}

async function activeTabId(): Promise<number | null> {
  // lastFocusedWindow is more reliable when the message originates from an
  // extension page tab (options) in another window.
  const [focused] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (focused?.id != null && /^https?:\/\//i.test(focused.url || "")) {
    return focused.id;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null && /^https?:\/\//i.test(tab.url || "")) {
    return tab.id;
  }
  // Last resort: any active http(s) tab
  const all = await chrome.tabs.query({ active: true });
  const http = all.find((t) => t.id != null && /^https?:\/\//i.test(t.url || ""));
  return http?.id ?? tab?.id ?? focused?.id ?? null;
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const ping = (await chrome.tabs.sendMessage(tabId, {
      type: "PING",
    })) as MessageResponse;
    if (ping?.ok) return true;
  } catch {
    /* not injected yet */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-scripts/content.js"],
    });
    await new Promise((r) => setTimeout(r, 250));
    const ping = (await chrome.tabs.sendMessage(tabId, {
      type: "PING",
    })) as MessageResponse;
    return Boolean(ping?.ok);
  } catch {
    return false;
  }
}

async function requestExtract(
  tabId: number,
  opts?: { preferReader?: boolean }
): Promise<PageExtract> {
  const ok = await ensureContentScript(tabId);
  if (!ok) {
    throw new Error(
      "Cannot access this page. Try a normal http(s) article tab (not chrome:// or the Web Store)."
    );
  }
  const res = (await chrome.tabs.sendMessage(tabId, {
    type: "GET_PAGE_META",
    preferReader: opts?.preferReader,
  } as MessageType & { preferReader?: boolean })) as MessageResponse<PageExtract>;
  if (!res?.ok || !res.data) {
    const err = res && !res.ok ? res.error : "Failed to extract page content";
    throw new Error(err);
  }
  return res.data;
}

async function runDemoForTab(tabId: number): Promise<BiasAnalysis> {
  broadcastProgress(tabId, {
    stage: "extracting",
    message: "Demo: reading page…",
    percent: 20,
  });
  const extract = await requestExtract(tabId);
  const analysis = buildPageDemoAnalysis({
    url: extract.url,
    title: extract.title,
    text: extract.text || documentFallbackTitle(extract),
    contentHash: extract.contentHash,
  });
  setTabAnalysis(tabId, analysis);
  const settings = await getSettings();
  broadcastProgress(tabId, {
    stage: "highlighting",
    message: "Demo: painting highlights…",
    percent: 80,
  });
  await pushAnalysisToContent(tabId, analysis, settings);
  if (extract.possiblyPaywalled) {
    await chrome.tabs
      .sendMessage(tabId, {
        type: "SHOW_PAYWALL",
        wordCount: extract.wordCount,
      } satisfies MessageType)
      .catch(() => {});
  }
  broadcastProgress(tabId, { stage: "done", percent: 100, message: "Demo ready" });
  await updateBadge(tabId, analysis);
  chrome.runtime
    .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
    .catch(() => {});
  return analysis;
}

function documentFallbackTitle(extract: PageExtract): string {
  return extract.title || "Page";
}

async function runAnalysisForTab(
  tabId: number,
  force: boolean,
  opts?: { preferReader?: boolean }
): Promise<BiasAnalysis> {
  if (analyzing.has(tabId)) {
    const existing = getTabAnalysis(tabId);
    if (existing && !force) return existing;
  }
  analyzing.add(tabId);

  try {
    broadcastProgress(tabId, {
      stage: "extracting",
      message: opts?.preferReader
        ? "Reading via local reader extract…"
        : "Reading page…",
      percent: 15,
    });

    const settings = await getSettings();
    const extract = await requestExtract(tabId, {
      preferReader: opts?.preferReader,
    });

    if (extract.possiblyPaywalled) {
      await chrome.tabs
        .sendMessage(tabId, {
          type: "SHOW_PAYWALL",
          wordCount: extract.wordCount,
        } satisfies MessageType)
        .catch(() => {});
    }

    if (!force && settings.enableCache) {
      const cached = await getCachedAnalysis(
        extract.url,
        extract.contentHash,
        settings.cacheTtlHours ?? 72
      );
      if (cached?.analysis) {
        const analysis = {
          ...(cached.analysis as BiasAnalysis),
          source: "cache" as const,
        };
        setTabAnalysis(tabId, analysis);
        broadcastProgress(tabId, {
          stage: "done",
          percent: 100,
          message: "Loaded from cache",
        });
        await pushAnalysisToContent(tabId, analysis, settings);
        await updateBadge(tabId, analysis);
        chrome.runtime
          .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
          .catch(() => {});
        return analysis;
      }
    }

    // Too thin for a useful model call (hard paywall / empty shell)
    if (isTooThinForModel(extract)) {
      const analysis = buildThinPageAnalysis(extract);
      setTabAnalysis(tabId, analysis);
      broadcastProgress(tabId, {
        stage: "done",
        percent: 100,
        message: "Limited text — open Research or log in",
      });
      await pushAnalysisToContent(tabId, analysis, settings);
      await updateBadge(tabId, analysis);
      chrome.runtime
        .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
        .catch(() => {});
      return analysis;
    }

    const hasKey = Boolean(settings.apiKey?.trim());
    broadcastProgress(tabId, {
      stage: "analyzing",
      message: hasKey
        ? settings.hybridQuickScan
          ? "Quick local scan + consulting Grok…"
          : "Consulting Grok…"
        : "Running local heuristics…",
      percent: 45,
    });

    let analysis: BiasAnalysis;

    // Hybrid: paint provisional heuristic signals while the model runs
    if (hasKey && settings.hybridQuickScan && !settings.neverSendFullText) {
      const provisional = runHeuristicAnalysis(extract);
      provisional.notes = [
        ...(provisional.notes || []),
        "Provisional local signals — full Grok analysis loading…",
      ];
      setTabAnalysis(tabId, provisional);
      await pushAnalysisToContent(tabId, provisional, settings);
      await updateBadge(tabId, provisional);
      chrome.runtime
        .sendMessage({ type: "ANALYSIS_UPDATED", analysis: provisional })
        .catch(() => {});
      broadcastProgress(tabId, {
        stage: "analyzing",
        message: "Deep analysis with Grok…",
        percent: 60,
      });
    }

    if (!hasKey || settings.neverSendFullText) {
      if (settings.neverSendFullText && hasKey) {
        const limited: PageExtract = {
          ...extract,
          text: extract.text.slice(0, 6000),
        };
        try {
          analysis = await analyzeWithGrok(limited, {
            ...settings,
            neverSendFullText: true,
          });
          analysis.notes = [
            ...(analysis.notes || []),
            "Limited mode: only a short excerpt was sent to the API.",
          ];
        } catch {
          analysis = runHeuristicAnalysis(extract);
        }
      } else {
        analysis = runHeuristicAnalysis(extract);
      }
    } else {
      try {
        analysis = await analyzeWithGrok(extract, settings);
      } catch (e) {
        analysis = runHeuristicAnalysis(extract);
        analysis.notes = [
          ...(analysis.notes || []),
          `Grok unavailable: ${e instanceof Error ? e.message : String(e)}. Showing local heuristics.`,
        ];
      }
    }

    if (extract.possiblyPaywalled) {
      analysis.summary.caveats = [
        ...new Set([
          ...analysis.summary.caveats,
          "Thin or paywalled text — analysis may be incomplete",
        ]),
      ];
    }

    setTabAnalysis(tabId, analysis);
    if (settings.enableCache && analysis.source !== "demo") {
      await setCachedAnalysis(extract.url, extract.contentHash, analysis);
    }

    // Article + outlet scoreboard (hostname + score history only — no full text)
    try {
      await recordArticleScan({
        url: extract.url,
        title: analysis.title,
        byline: extract.byline,
        neutrality: analysis.summary.neutrality_score,
        signalCount: analysis.instances.length,
        source: analysis.source,
        topTypes: analysis.instances.slice(0, 5).map((i) => i.bias_type),
        contentHash: analysis.content_hash,
        overview: analysis.summary.overview,
        contentType: analysis.summary.content_type,
        caveats: analysis.summary.caveats,
        signals: analysis.instances.slice(0, 20).map((i) => ({
          type: i.bias_type,
          severity: i.severity,
          confidence: i.confidence,
          span: i.span_text,
          explanation: i.concise_explanation,
        })),
        skip: analysis.source === "demo" || analysis.notes?.includes("thin_page"),
      });
    } catch {
      /* non-fatal */
    }

    broadcastProgress(tabId, {
      stage: "highlighting",
      message: "Applying highlights…",
      percent: 85,
    });
    await pushAnalysisToContent(tabId, analysis, settings);
    broadcastProgress(tabId, {
      stage: "done",
      percent: 100,
      message: "Done",
    });
    await updateBadge(tabId, analysis);

    chrome.runtime
      .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
      .catch(() => {});

    return analysis;
  } finally {
    analyzing.delete(tabId);
  }
}

async function runSelectionAnalysis(
  tabId: number,
  text: string
): Promise<BiasAnalysis> {
  const settings = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const extract: PageExtract = {
    url: tab?.url || "selection",
    title: `Selection on ${tab?.title || "page"}`,
    text,
    contentHash: `sel_${text.length}_${text.slice(0, 40)}`,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    isLikelyNews: false,
    possiblyPaywalled: false,
  };

  broadcastProgress(tabId, {
    stage: "analyzing",
    message: "Analyzing selection…",
    percent: 50,
  });

  let analysis: BiasAnalysis;
  if (settings.apiKey?.trim()) {
    try {
      analysis = await analyzeWithGrok(extract, settings);
    } catch {
      analysis = runHeuristicAnalysis(extract);
    }
  } else {
    analysis = runHeuristicAnalysis(extract);
  }

  setTabAnalysis(tabId, analysis);
  await pushAnalysisToContent(tabId, analysis, settings);
  broadcastProgress(tabId, { stage: "done", percent: 100 });
  await updateBadge(tabId, analysis);
  chrome.runtime
    .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
    .catch(() => {});
  return analysis;
}

/**
 * Legal research path: analyze text the user pasted after obtaining it lawfully
 * (subscription, library, gift link, free teaser, etc.). Does not fetch paywalls.
 */
async function runPastedTextAnalysis(
  tabId: number,
  message: Extract<MessageType, { type: "ANALYZE_PASTED_TEXT" }>
): Promise<BiasAnalysis> {
  const text = (message.text || "").trim();
  if (text.length < 80) {
    throw new Error(
      "Paste at least ~80 characters of article text you already have access to."
    );
  }
  if (text.length > 100_000) {
    throw new Error("Pasted text is too long (max ~100k characters).");
  }

  const settings = await getSettings();
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const sourceUrl =
    (message.sourceUrl || "").trim() ||
    tab?.url ||
    "pasted://research";
  const title =
    (message.title || "").trim() ||
    `Pasted research text${tab?.title ? ` · ${tab.title}` : ""}`;

  const extract: PageExtract = {
    url: sourceUrl,
    title,
    text,
    siteName: (() => {
      try {
        return new URL(sourceUrl).hostname.replace(/^www\./, "");
      } catch {
        return "pasted";
      }
    })(),
    contentHash: `paste_${hashString(text.slice(0, 8000))}`,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    isLikelyNews: true,
    possiblyPaywalled: false,
    extractSource: "paragraphs",
  };

  broadcastProgress(tabId, {
    stage: "analyzing",
    message: "Research paste: analyzing…",
    percent: 45,
  });

  let analysis: BiasAnalysis;
  if (settings.apiKey?.trim()) {
    try {
      analysis = await analyzeWithGrok(extract, settings);
    } catch (e) {
      // Fall back to heuristics but surface API issues in caveats
      analysis = runHeuristicAnalysis(extract);
      analysis.summary.caveats = [
        ...(analysis.summary.caveats || []),
        `Grok unavailable (${e instanceof Error ? e.message : String(e)}); used local heuristics.`,
      ];
    }
  } else {
    analysis = runHeuristicAnalysis(extract);
  }

  const accessMethod = message.accessMethod || "paste_other";
  const accessLabel: Record<string, string> = {
    subscription: "subscription / paid login",
    library: "library or institutional access",
    gift_link: "publisher gift / shared link",
    free_teaser: "free teaser / metered allotment",
    reader_dom: "reader extract of DOM text already loaded",
    public_archive: "public web archive snapshot (user-opened)",
    paste_other: "other lawful access (operator-attested)",
  };
  const accessNote = (message.accessNote || "").trim();

  analysis.research = {
    accessMethod,
    sourceUrl,
    accessNote: accessNote || undefined,
    wordCount: extract.wordCount,
    preparedAt: new Date().toISOString(),
    attestation:
      "Operator attests this text was obtained lawfully for personal media-literacy research. Bias Noticer did not fetch or bypass any paywall.",
  };

  analysis.summary.caveats = [
    ...(analysis.summary.caveats || []),
    "Source: user-pasted text for personal media-literacy research. Bias Noticer did not bypass any paywall.",
    `Access method: ${accessLabel[accessMethod] || accessMethod}${accessNote ? ` — ${accessNote}` : ""}.`,
  ];

  // Count paste scans toward outlet board when a real URL was cited
  try {
    await recordArticleScan({
      url: sourceUrl,
      title: analysis.title,
      neutrality: analysis.summary.neutrality_score,
      signalCount: analysis.instances.length,
      source: analysis.source,
      topTypes: analysis.instances.slice(0, 5).map((i) => i.bias_type),
      contentHash: analysis.content_hash,
      overview: analysis.summary.overview,
      contentType: analysis.summary.content_type,
      caveats: analysis.summary.caveats,
      signals: analysis.instances.slice(0, 20).map((i) => ({
        type: i.bias_type,
        severity: i.severity,
        confidence: i.confidence,
        span: i.span_text,
        explanation: i.concise_explanation,
      })),
    });
  } catch {
    /* non-fatal */
  }

  setTabAnalysis(tabId, analysis);

  const tryHighlight = message.tryHighlight !== false && tabId > 0;
  if (tryHighlight) {
    await pushAnalysisToContent(tabId, analysis, settings);
  }

  broadcastProgress(tabId, {
    stage: "done",
    percent: 100,
    message: "Paste analysis ready",
  });
  if (tabId > 0) await updateBadge(tabId, analysis);
  chrome.runtime
    .sendMessage({ type: "ANALYSIS_UPDATED", analysis })
    .catch(() => {});
  return analysis;
}

async function pushAnalysisToContent(
  tabId: number,
  analysis: BiasAnalysis,
  settings: Awaited<ReturnType<typeof getSettings>>
) {
  await ensureContentScript(tabId);
  const resolved = resolvePreset(
    settings.highlightPreset ?? "balanced",
    settings.highlightStyle,
    settings.highlightIntensity
  );
  await chrome.tabs
    .sendMessage(tabId, {
      type: "ANALYSIS_UPDATED",
      analysis,
      highlightStyle: resolved.highlightStyle,
      highlightIntensity: resolved.highlightIntensity,
      theme: settings.theme,
      enableShadesAnimation: settings.enableShadesAnimation,
    } as MessageType & Record<string, unknown>)
    .catch(() => {});
}
