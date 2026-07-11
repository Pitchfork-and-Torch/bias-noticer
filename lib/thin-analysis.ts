/**
 * Structured analysis when the page body is too thin for a useful Grok call
 * (paywall shells, login walls, empty loaders).
 */
import type { BiasAnalysis, PageExtract } from "./types";

export function buildThinPageAnalysis(extract: PageExtract): BiasAnalysis {
  return {
    version: 1,
    url: extract.url,
    title: extract.title,
    analyzed_at: new Date().toISOString(),
    content_hash: extract.contentHash,
    source: "heuristic",
    summary: {
      neutrality_score: 50,
      content_type: "unknown",
      top_patterns: ["insufficient_text"],
      recommended_sources_or_searches: [
        "Log in with a subscription or library access, then re-scan",
        "Use Reader extract if more text is already in the DOM",
        "Research tab → paste lawfully obtained full text",
      ],
      overview:
        extract.wordCount < 40
          ? `Almost no article body was available (~${extract.wordCount} words). This is typical of a hard paywall or loading shell. Bias Noticer did not bypass access controls.`
          : `Only a short free teaser was available (~${extract.wordCount} words). Any signals would be incomplete. Prefer full-text access or Research paste for a real audit.`,
      caveats: [
        "Thin or paywalled page — analysis intentionally limited to avoid burning API credits on incomplete text.",
        "Not a paywall bypass. Support journalism you value.",
      ],
    },
    instances: [],
    notes: [
      "thin_page",
      `wordCount=${extract.wordCount}`,
      extract.possiblyPaywalled ? "paywall_hint" : "short_body",
    ],
  };
}

export function isTooThinForModel(extract: PageExtract): boolean {
  return extract.wordCount < 80;
}

export function isThinButScannable(extract: PageExtract): boolean {
  return extract.wordCount >= 80 && (extract.possiblyPaywalled || extract.wordCount < 320);
}
