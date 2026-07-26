/**
 * Bias Noticer — Content script
 *
 * Extract → highlight → tooltips → reader mode → keyboard nav
 */

import {
  extractPageContent,
  extractSelection,
  invalidateExtractMemo,
} from "../lib/extract";
import {
  applyHighlights,
  clearHighlights,
  createTooltipController,
  ensureNavChip,
  navigateHighlight,
  playShadesAnimation,
  scrollToHighlight,
  showPaywallBanner,
  showToast,
  type HighlightOptions,
} from "../lib/highlight";
import {
  closeReaderMode,
  extractReaderArticle,
  openReaderMode,
} from "../lib/reader-mode";
import { getCategoryMeta, SEVERITY_LABELS } from "../lib/taxonomy";
import type { BiasAnalysis, MessageType, PageExtract } from "../lib/types";
import { hashString } from "../lib/storage";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    // Guard against double-inject via chrome.scripting.executeScript
    const w = window as Window & { __BN_CONTENT__?: boolean };
    if (w.__BN_CONTENT__) return;
    w.__BN_CONTENT__ = true;
    try {
      document.documentElement.dataset.bnReady = "1";
    } catch {
      /* */
    }

    let currentAnalysis: BiasAnalysis | null = null;
    let activeInstanceId: string | null = null;
    let lastReaderText: string | null = null;
    let highlightOpts: HighlightOptions = {
      style: "underline",
      intensity: 0.75,
      theme: "dark",
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    };
    let reapplyTimer: number | undefined;
    const tooltip = createTooltipController();
    let shadesPlayedForUrl = "";

    function resolveTheme(theme: string): "light" | "dark" | "they_live" {
      if (theme === "they_live") return "they_live";
      if (theme === "light") return "light";
      if (theme === "dark") return "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    function openReader() {
      const article = extractReaderArticle(document);
      lastReaderText = article.text;
      const thin = article.wordCount < 360;
      openReaderMode(article, {
        paywallHint: thin,
        onAnalyze: () => {
          chrome.runtime
            .sendMessage({ type: "ANALYZE_WITH_READER", force: true })
            .catch(() => {});
          showToast("Analyzing reader extract…");
        },
        onClose: () => {
          /* keep lastReaderText for subsequent analysis */
        },
      });
      showToast(
        article.improved
          ? `Reader ready · ${article.wordCount} words`
          : `Reader · only ${article.wordCount} words found in DOM`
      );
    }

    function paint(analysis: BiasAnalysis) {
      currentAnalysis = analysis;
      // Prefer highlighting inside reader body when open
      const { applied, missed, fuzzy, multiNode } = applyHighlights(
        analysis.instances,
        highlightOpts
      );
      bindHighlightEvents();

      analysis.highlightStats = {
        applied,
        missed: missed.length,
        fuzzy,
        multiNode,
      };

      chrome.runtime
        .sendMessage({
          type: "HIGHLIGHT_STATS",
          stats: analysis.highlightStats,
        })
        .catch(() => {});

      ensureNavChip(
        applied,
        () => {
          activeInstanceId = navigateHighlight(-1, activeInstanceId);
          if (activeInstanceId) notifyFocus(activeInstanceId);
        },
        () => {
          activeInstanceId = navigateHighlight(1, activeInstanceId);
          if (activeInstanceId) notifyFocus(activeInstanceId);
        }
      );

      if (
        analysis.url === location.href ||
        analysis.source === "demo" ||
        analysis.source === "heuristic" ||
        analysis.source === "grok" ||
        analysis.source === "cache"
      ) {
        if (shadesPlayedForUrl !== location.href) {
          shadesPlayedForUrl = location.href;
          playShadesAnimation(highlightOpts.reducedMotion);
        }
        const mode =
          analysis.source === "demo"
            ? "Demo shades"
            : analysis.source === "heuristic"
              ? "Shades on (local heuristics)"
              : analysis.source === "cache"
                ? "Shades on (cached)"
                : "Shades activated";
        showToast(
          `${mode} · ${applied}/${analysis.instances.length} signals`
        );
        if (missed.length && applied === 0) {
          showToast(
            "Signals unmatched in page — try Reader extract then re-scan",
            3200
          );
        }
      }
    }

    function notifyFocus(id: string) {
      chrome.runtime
        .sendMessage({ type: "HIGHLIGHT_CLICKED", instanceId: id })
        .catch(() => {});
    }

    function bindHighlightEvents() {
      document.querySelectorAll(".bn-highlight").forEach((node) => {
        const mark = node as HTMLElement;
        if (mark.dataset.bnBound === "1") return;
        mark.dataset.bnBound = "1";

        const id = mark.dataset.bnId || "";
        const inst = currentAnalysis?.instances.find((i) => i.id === id);

        const onEnter = () => {
          if (!inst) return;
          const meta = getCategoryMeta(inst.bias_type);
          tooltip.scheduleShow(
            mark,
            inst.concise_explanation,
            meta.label,
            `Severity ${inst.severity}/5 · ${(inst.confidence * 100).toFixed(0)}% · ${SEVERITY_LABELS[inst.severity] ?? ""}`
          );
        };
        const onLeave = () => tooltip.scheduleHide();

        mark.addEventListener("mouseenter", onEnter);
        mark.addEventListener("mouseleave", onLeave);
        mark.addEventListener("focus", onEnter);
        mark.addEventListener("blur", onLeave);
        mark.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          activeInstanceId = id;
          notifyFocus(id);
          // sidePanel.open cannot run from content scripts — use keyboard
          showToast("Side panel: Ctrl+Shift+Y");
        });
        mark.addEventListener("keydown", (e) => {
          if (
            (e as KeyboardEvent).key === "Enter" ||
            (e as KeyboardEvent).key === " "
          ) {
            e.preventDefault();
            mark.click();
          }
        });
      });
    }

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.altKey && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          openReader();
          return;
        }
        if (!currentAnalysis?.instances.length) return;
        if (!e.altKey) return;
        if (e.key === "[" || e.code === "BracketLeft") {
          e.preventDefault();
          activeInstanceId = navigateHighlight(-1, activeInstanceId);
          if (activeInstanceId) notifyFocus(activeInstanceId);
        } else if (e.key === "]" || e.code === "BracketRight") {
          e.preventDefault();
          activeInstanceId = navigateHighlight(1, activeInstanceId);
          if (activeInstanceId) notifyFocus(activeInstanceId);
        }
      },
      true
    );

    const observer = new MutationObserver(() => {
      if (!currentAnalysis?.instances.length) return;
      const marks = document.querySelectorAll(".bn-highlight").length;
      if (marks === 0) {
        window.clearTimeout(reapplyTimer);
        reapplyTimer = window.setTimeout(() => {
          if (currentAnalysis) paint(currentAnalysis);
        }, 450);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    function buildExtractForReader(): PageExtract {
      const base = extractPageContent(document, { force: true });
      const reader = extractReaderArticle(document);
      const text = lastReaderText || reader.text || base.text;
      return {
        ...base,
        title: reader.title || base.title,
        byline: reader.byline || base.byline,
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        contentHash: hashString(text.slice(0, 5000) + "|reader|" + base.url),
        extractSource: reader.source,
        possiblyPaywalled: false,
      };
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const msg = message as MessageType & Record<string, unknown>;

      switch (msg.type) {
        case "PING": {
          sendResponse({
            ok: true,
            data: {
              ready: true,
              url: location.href,
              hasAnalysis: Boolean(currentAnalysis),
            },
          });
          break;
        }
        case "GET_PAGE_META": {
          try {
            const preferReader = Boolean(msg.preferReader || lastReaderText);
            const extract = preferReader
              ? buildExtractForReader()
              : extractPageContent(document);
            sendResponse({ ok: true, data: extract });
          } catch (e) {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        }
        case "OPEN_READER_MODE": {
          openReader();
          sendResponse({ ok: true, data: true });
          break;
        }
        case "CLOSE_READER_MODE": {
          closeReaderMode();
          sendResponse({ ok: true, data: true });
          break;
        }
        case "ANALYSIS_UPDATED": {
          const analysis = msg.analysis as BiasAnalysis | null;
          if (msg.highlightStyle) {
            highlightOpts = {
              ...highlightOpts,
              style: msg.highlightStyle as HighlightOptions["style"],
              intensity: Number(msg.highlightIntensity ?? 0.75),
              theme: resolveTheme(String(msg.theme || "system")),
            };
          }
          if (analysis) paint(analysis);
          else {
            currentAnalysis = null;
            activeInstanceId = null;
            clearHighlights();
          }
          sendResponse({ ok: true, data: true });
          break;
        }
        case "CLEAR_HIGHLIGHTS": {
          currentAnalysis = null;
          activeInstanceId = null;
          clearHighlights();
          tooltip.hide();
          document.getElementById("bn-paywall-banner")?.remove();
          showToast("Shades off");
          sendResponse({ ok: true, data: true });
          break;
        }
        case "SCROLL_TO_INSTANCE": {
          const id = String(msg.instanceId);
          const ok = scrollToHighlight(id);
          if (ok) activeInstanceId = id;
          sendResponse({ ok: true, data: ok });
          break;
        }
        case "NAV_HIGHLIGHT": {
          const delta = Number(msg.delta) || 1;
          activeInstanceId = navigateHighlight(delta, activeInstanceId);
          if (activeInstanceId) notifyFocus(activeInstanceId);
          sendResponse({ ok: true, data: activeInstanceId });
          break;
        }
        case "SHADES_TOAST": {
          showToast(
            String((msg as { message?: string }).message || "Bias Noticer")
          );
          sendResponse({ ok: true, data: true });
          break;
        }
        case "SHOW_PAYWALL": {
          showPaywallBanner(Number(msg.wordCount || 0), {
            onOpenReader: () => openReader(),
          });
          sendResponse({ ok: true, data: true });
          break;
        }
        default:
          sendResponse({ ok: true, data: null });
      }
      return true;
    });

    // Soft auto-detect thin content once (non-intrusive)
    window.setTimeout(() => {
      try {
        const ex = extractPageContent(document);
        if (ex.possiblyPaywalled) {
          showPaywallBanner(ex.wordCount, { onOpenReader: () => openReader() });
        }
      } catch {
        /* ignore */
      }
    }, 1800);

    void extractSelection;
    void invalidateExtractMemo;
  },
});
