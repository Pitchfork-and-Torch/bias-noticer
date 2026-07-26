/**
 * Pass 0 — local structure extraction (no network).
 * Feeds multi-pass analysis and radar positioning without LLM cost.
 */

import type { ContentType, PageExtract } from "./types";

export interface QuotedSpan {
  text: string;
  char_start: number;
  char_end: number;
}

export interface StructureExtract {
  title: string;
  headline: string;
  byline?: string;
  siteName?: string;
  wordCount: number;
  /** First ~2 sentences / lead graf */
  lead: string;
  /** Last ~400 chars for close framing */
  close: string;
  /** Rough paragraph count */
  paragraphCount: number;
  /** Double-quoted spans found in body */
  quotes: QuotedSpan[];
  /** Named-ish sources (Mr./Ms./Dr./“said X”) heuristics */
  namedSources: string[];
  /** Very light local genre guess */
  contentTypeGuess: ContentType;
  notes: string[];
}

const QUOTE_RE = /[“"]([^”"]{12,280})[”"]/g;
const SAID_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:said|says|told|according to|wrote|claimed|argued)\b/g;
const TITLE_SOURCE_RE =
  /\b(?:Dr|Mr|Ms|Mrs|Prof|Senator|Rep|Gov)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;

function guessContentType(
  title: string,
  text: string,
  siteName?: string
): ContentType {
  const blob = `${title}\n${text.slice(0, 1200)}\n${siteName || ""}`.toLowerCase();
  if (/\b(op-?ed|opinion|column|editorial|guest essay)\b/.test(blob)) {
    return "opinion";
  }
  if (/\b(satire|the onion|babylon bee|not the bee)\b/.test(blob)) {
    return "satire";
  }
  if (/\b(press release|for immediate release|media contact)\b/.test(blob)) {
    return "press_release";
  }
  if (/\b(abstract|doi:|peer[- ]reviewed|journal of)\b/.test(blob)) {
    return "academic";
  }
  if (/\b(holding|court|plaintiff|defendant|statute|pursuant to)\b/.test(blob)) {
    return "legal";
  }
  if (/\b(analysis|explainer|what it means|deep dive)\b/.test(blob)) {
    return "analysis";
  }
  return "hard_news";
}

function extractQuotes(text: string, limit = 24): QuotedSpan[] {
  const out: QuotedSpan[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(QUOTE_RE.source, "g");
  while ((m = re.exec(text)) !== null && out.length < limit) {
    const inner = m[1]?.trim();
    if (!inner) continue;
    out.push({
      text: inner,
      char_start: m.index,
      char_end: m.index + m[0].length,
    });
  }
  return out;
}

function extractNamedSources(text: string, limit = 16): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const said = new RegExp(SAID_RE.source, "g");
  while ((m = said.exec(text)) !== null && names.size < limit) {
    const n = m[1]?.trim();
    if (n && n.length >= 3) names.add(n);
  }
  const titled = new RegExp(TITLE_SOURCE_RE.source, "g");
  while ((m = titled.exec(text)) !== null && names.size < limit) {
    const n = m[0]?.trim();
    if (n) names.add(n);
  }
  return [...names];
}

/**
 * Fast local structure pass used before / alongside LLM analysis.
 */
export function extractStructure(extract: PageExtract): StructureExtract {
  const text = extract.text || "";
  const title = extract.title || "Untitled";
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lead =
    paragraphs[0]?.slice(0, 500) ||
    text.slice(0, 400).replace(/\s+/g, " ").trim();
  const close = text.slice(Math.max(0, text.length - 400)).trim();
  const quotes = extractQuotes(text);
  const namedSources = extractNamedSources(text);
  const contentTypeGuess = guessContentType(
    title,
    text,
    extract.siteName
  );

  const notes: string[] = [];
  if (quotes.length === 0) {
    notes.push("No double-quoted spans detected (may still have single quotes).");
  }
  if (namedSources.length <= 1 && extract.wordCount > 200) {
    notes.push("Few named speakers detected — source diversity may be limited.");
  }
  if (extract.possiblyPaywalled) {
    notes.push("Thin or paywalled shell — structure is incomplete.");
  }

  return {
    title,
    headline: title,
    byline: extract.byline,
    siteName: extract.siteName,
    wordCount: extract.wordCount,
    lead,
    close,
    paragraphCount: Math.max(paragraphs.length, text ? 1 : 0),
    quotes,
    namedSources,
    contentTypeGuess,
    notes,
  };
}

/** True when a candidate span heavily overlaps a quoted region */
export function spanLooksQuoted(
  span: string,
  structure: StructureExtract
): boolean {
  const s = span.trim().toLowerCase();
  if (s.length < 8) return false;
  return structure.quotes.some((q) => {
    const qt = q.text.toLowerCase();
    return qt.includes(s) || s.includes(qt.slice(0, Math.min(40, qt.length)));
  });
}

export function structureSummaryLine(s: StructureExtract): string {
  return [
    `genre~${s.contentTypeGuess}`,
    `${s.wordCount} words`,
    `${s.paragraphCount} grafs`,
    `${s.quotes.length} quotes`,
    `${s.namedSources.length} named sources`,
  ].join(" · ");
}
