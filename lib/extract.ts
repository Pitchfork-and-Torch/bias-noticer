/**
 * Bias Noticer — Readable content extraction
 *
 * Multi-strategy, local-only extraction (Readability + JSON-LD + paragraphs).
 * Fast path: reuse last extract for same URL within a short TTL in content world.
 */

import { hashString } from "./storage";
import { isLikelyNewsDomain } from "./news-domains";
import { extractReaderArticle } from "./reader-mode";
import type { PageExtract } from "./types";

const PAYWALL_HINTS =
  /subscribe to (continue|read)|create a free account|sign in to continue|remaining free articles|paywall|members only|already a subscriber|register to read|unlock this article|this article is for subscribers|metered|you have \d+ free|already a Times subscriber|subscriber[- ]only|gift this article|continue reading the full|to keep reading|subscribe for full access|you'?ve reached your limit|for subscribers only/i;

/** In-page memo for sub-second re-scans */
let memo: { url: string; at: number; extract: PageExtract } | null = null;
const MEMO_TTL_MS = 12_000;

export function extractPageContent(
  doc: Document = document,
  opts?: { force?: boolean; preferReader?: boolean }
): PageExtract {
  const url = location.href;
  if (
    !opts?.force &&
    memo &&
    memo.url === url &&
    Date.now() - memo.at < MEMO_TTL_MS
  ) {
    return memo.extract;
  }

  const reader = extractReaderArticle(doc);
  let text = reader.text;
  let title = reader.title || doc.title || "";
  let byline = reader.byline || undefined;
  let siteName = reader.siteName || undefined;

  // Cap extremely long pages (comments + infinite scroll noise)
  const maxChars = 80_000;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + "\n\n[truncated for analysis]";
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const bodySample = (doc.body?.innerText || "").slice(0, 5000);
  const hintHit = PAYWALL_HINTS.test(bodySample) || PAYWALL_HINTS.test(text);
  const looksLikeArticlePath =
    /\/(20\d{2}|news|article|story|opinion|politics|world|business|media)\b/i.test(
      url
    );
  const possiblyPaywalled =
    wordCount < 160 ||
    hintHit ||
    (looksLikeArticlePath && wordCount < 320);

  const extract: PageExtract = {
    url,
    title,
    text,
    byline,
    siteName,
    excerpt: text.slice(0, 240),
    contentHash: hashString(text.slice(0, 5000) + "|" + title + "|" + url),
    wordCount,
    isLikelyNews: isLikelyNewsDomain(url) || wordCount > 400,
    possiblyPaywalled,
    extractSource: reader.source,
  };

  memo = { url, at: Date.now(), extract };
  return extract;
}

export function invalidateExtractMemo(): void {
  memo = null;
}

/** Extract currently selected text if any */
export function extractSelection(): string {
  return (window.getSelection()?.toString() || "").trim();
}
