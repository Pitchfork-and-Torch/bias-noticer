/**
 * Local outlet + article scoreboard.
 * Hostname aggregates + audit report history. No full article text stored.
 */

import { neutralityToGrade, type LetterGrade } from "./grades";

export interface SiteRating {
  host: string;
  samples: number;
  avgNeutrality: number;
  lastScore: number;
  lastTitle: string;
  lastAt: string;
  topTypes: string[];
  /** Running sum of signal counts across scans */
  totalSignals?: number;
  minScore?: number;
  maxScore?: number;
  /** Letter grade from avg neutrality */
  grade?: LetterGrade;
  gradeLabel?: string;
}

/** Compact audit report row (no full article body) */
export interface ArticleScan {
  id: string;
  url: string;
  host: string;
  title: string;
  /** Display names attributed on the article */
  authors?: string[];
  neutrality: number;
  grade?: LetterGrade;
  gradeLabel?: string;
  signalCount: number;
  source: string;
  topTypes: string[];
  scannedAt: string;
  contentHash?: string;
  /** Short model overview */
  overview?: string;
  contentType?: string;
  caveats?: string[];
  /** Top signals for history UI */
  signals?: Array<{
    type: string;
    severity: number;
    confidence: number;
    span: string;
    explanation: string;
  }>;
}

export interface JournalistRating {
  /** Normalized key for storage */
  key: string;
  /** Display name */
  name: string;
  samples: number;
  avgNeutrality: number;
  lastScore: number;
  lastTitle: string;
  lastHost: string;
  lastAt: string;
  topTypes: string[];
  totalSignals?: number;
  minScore?: number;
  maxScore?: number;
  grade?: LetterGrade;
  gradeLabel?: string;
}

export interface OutletDetail {
  outlet: SiteRating;
  history: ArticleScan[];
}

export interface JournalistDetail {
  journalist: JournalistRating;
  history: ArticleScan[];
}

export interface OutletBoard {
  mostUnbiased: SiteRating[];
  mostBiased: SiteRating[];
  allOutlets: SiteRating[];
  mostUnbiasedJournalists: JournalistRating[];
  mostBiasedJournalists: JournalistRating[];
  allJournalists: JournalistRating[];
  recentScans: ArticleScan[];
  totals: {
    outlets: number;
    journalists: number;
    scans: number;
    globalAvgNeutrality: number | null;
  };
  /** Min samples required for ranked lists */
  minSamples: number;
}

const PREFIX = "bn_site_";
const JOUR_PREFIX = "bn_jour_";
const HISTORY_KEY = "bn_scan_history";
const MAX_HISTORY = 800;
const DEFAULT_MIN_SAMPLES = 1;

/** Parse "By Jane Doe and John Smith" → ["Jane Doe", "John Smith"] */
export function parseAuthorNames(byline?: string | null): string[] {
  if (!byline?.trim()) return [];
  let s = byline.trim();
  s = s.replace(/^\s*by\s+/i, "");
  s = s.replace(/\s*\|\s*.*$/, ""); // drop "| The Times"
  s = s.replace(/\s+in\s+.+$/i, "");
  s = s.replace(/\s+updated\s+.+$/i, "");
  // Split on common conjunctions / separators
  const parts = s
    .split(/\s*(?:,|;|\||\/|&| and | And | AND |\s+with\s+)\s*/i)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 2 && p.length <= 80)
    .filter((p) => !/^(staff|editors?|ap|reuters|associated press|opinion)$/i.test(p))
    .filter((p) => /[a-zA-Z]/.test(p));
  // Dedupe case-insensitive
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = journalistKey(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.slice(0, 6);
}

export function journalistKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function hostKey(url: string): string | null {
  return hostFromUrl(url);
}

export async function getSiteRating(url: string): Promise<SiteRating | null> {
  const host = hostKey(url);
  if (!host) return null;
  const key = PREFIX + host;
  const res = await chrome.storage.local.get(key);
  return (res[key] as SiteRating | undefined) ?? null;
}

function withGrade(r: SiteRating): SiteRating {
  const g = neutralityToGrade(r.avgNeutrality);
  return { ...r, grade: g.grade, gradeLabel: g.label };
}

function withJournalistGrade(r: JournalistRating): JournalistRating {
  const g = neutralityToGrade(r.avgNeutrality);
  return { ...r, grade: g.grade, gradeLabel: g.label };
}

function withScanGrade(s: ArticleScan): ArticleScan {
  const g = neutralityToGrade(s.neutrality);
  return { ...s, grade: g.grade, gradeLabel: g.label };
}

export async function listAllJournalistRatings(): Promise<JournalistRating[]> {
  const all = await chrome.storage.local.get(null);
  const out: JournalistRating[] = [];
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(JOUR_PREFIX) || !v || typeof v !== "object") continue;
    const r = v as JournalistRating;
    if (r.key && typeof r.avgNeutrality === "number") {
      out.push(withJournalistGrade(r));
    }
  }
  return out;
}

export async function listAllSiteRatings(): Promise<SiteRating[]> {
  const all = await chrome.storage.local.get(null);
  const out: SiteRating[] = [];
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(PREFIX) || !v || typeof v !== "object") continue;
    const r = v as SiteRating;
    if (r.host && typeof r.avgNeutrality === "number") out.push(withGrade(r));
  }
  return out;
}

export async function getScanHistory(): Promise<ArticleScan[]> {
  const res = await chrome.storage.local.get(HISTORY_KEY);
  const list = (res[HISTORY_KEY] as ArticleScan[] | undefined) ?? [];
  return list.map(withScanGrade);
}

export async function getOutletHistory(host: string): Promise<OutletDetail | null> {
  const h = host.replace(/^www\./, "").toLowerCase();
  const all = await listAllSiteRatings();
  const outlet = all.find((o) => o.host === h);
  if (!outlet) {
    // Synthetic empty outlet shell if only history exists
    const history = (await getScanHistory()).filter((s) => s.host === h);
    if (!history.length) return null;
    const avg =
      history.reduce((s, x) => s + x.neutrality, 0) / history.length;
    const g = neutralityToGrade(avg);
    return {
      outlet: {
        host: h,
        samples: history.length,
        avgNeutrality: Math.round(avg * 10) / 10,
        lastScore: history[0]!.neutrality,
        lastTitle: history[0]!.title,
        lastAt: history[0]!.scannedAt,
        topTypes: history[0]!.topTypes,
        grade: g.grade,
        gradeLabel: g.label,
      },
      history,
    };
  }
  const history = (await getScanHistory()).filter((s) => s.host === h);
  return { outlet: withGrade(outlet), history };
}

export async function getJournalistHistory(
  keyOrName: string
): Promise<JournalistDetail | null> {
  const key = journalistKey(keyOrName) || keyOrName.toLowerCase();
  const all = await listAllJournalistRatings();
  let journalist = all.find((j) => j.key === key);
  const history = (await getScanHistory()).filter((s) =>
    (s.authors || []).some((a) => journalistKey(a) === key)
  );
  if (!journalist) {
    if (!history.length) return null;
    const avg =
      history.reduce((s, x) => s + x.neutrality, 0) / history.length;
    const g = neutralityToGrade(avg);
    journalist = {
      key,
      name: history[0]!.authors?.find((a) => journalistKey(a) === key) || keyOrName,
      samples: history.length,
      avgNeutrality: Math.round(avg * 10) / 10,
      lastScore: history[0]!.neutrality,
      lastTitle: history[0]!.title,
      lastHost: history[0]!.host,
      lastAt: history[0]!.scannedAt,
      topTypes: history[0]!.topTypes,
      grade: g.grade,
      gradeLabel: g.label,
    };
  }
  return { journalist: withJournalistGrade(journalist), history };
}

/**
 * Record one article scan and roll into outlet + journalist aggregates.
 * Skips demo scans so they don't pollute scores.
 */
export async function recordArticleScan(input: {
  url: string;
  title: string;
  byline?: string;
  authors?: string[];
  neutrality: number;
  signalCount: number;
  source: string;
  topTypes: string[];
  contentHash?: string;
  overview?: string;
  contentType?: string;
  caveats?: string[];
  signals?: ArticleScan["signals"];
  /** When true, skip history + outlet (e.g. demo) */
  skip?: boolean;
}): Promise<{ site: SiteRating | null; scan: ArticleScan | null }> {
  if (input.skip || input.source === "demo") {
    return { site: null, scan: null };
  }
  // Ignore non-http research placeholders
  if (!/^https?:\/\//i.test(input.url)) {
    return { site: null, scan: null };
  }

  const host = hostKey(input.url);
  if (!host) return { site: null, scan: null };

  const authors =
    input.authors?.length
      ? input.authors
      : parseAuthorNames(input.byline);

  const neutrality = clamp(input.neutrality, 0, 100);
  const g = neutralityToGrade(neutrality);
  const scan: ArticleScan = {
    id: `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    url: input.url,
    host,
    title: (input.title || host).slice(0, 240),
    authors: authors.length ? authors : undefined,
    neutrality,
    grade: g.grade,
    gradeLabel: g.label,
    signalCount: Math.max(0, input.signalCount | 0),
    source: input.source,
    topTypes: input.topTypes.slice(0, 5),
    scannedAt: new Date().toISOString(),
    contentHash: input.contentHash,
    overview: input.overview?.slice(0, 800),
    contentType: input.contentType,
    caveats: (input.caveats || []).slice(0, 8).map((c) => c.slice(0, 280)),
    signals: (input.signals || []).slice(0, 20).map((s) => ({
      type: s.type,
      severity: s.severity,
      confidence: s.confidence,
      span: s.span.slice(0, 160),
      explanation: s.explanation.slice(0, 400),
    })),
  };

  // History: newest first, dedupe same URL+hash within last entry
  const history = await getScanHistory();
  const last = history[0];
  let doubleCount = true;
  if (
    last &&
    last.url === scan.url &&
    last.contentHash &&
    scan.contentHash &&
    last.contentHash === scan.contentHash &&
    Date.now() - Date.parse(last.scannedAt) < 60_000
  ) {
    // Re-scan same content within 1 min → update last row instead of double-count
    history[0] = scan;
    doubleCount = false;
  } else {
    history.unshift(scan);
  }
  await chrome.storage.local.set({
    [HISTORY_KEY]: history.slice(0, MAX_HISTORY),
  });

  let site: SiteRating | null = null;
  if (doubleCount) {
    site = await updateSiteRating(input.url, {
      neutrality,
      title: scan.title,
      topTypes: scan.topTypes,
      signalCount: scan.signalCount,
    });
    for (const name of authors) {
      await updateJournalistRating(name, {
        neutrality,
        title: scan.title,
        host,
        topTypes: scan.topTypes,
        signalCount: scan.signalCount,
      });
    }
  } else {
    site = await getSiteRating(input.url);
  }

  return { site, scan };
}

export async function updateJournalistRating(
  name: string,
  input: {
    neutrality: number;
    title: string;
    host: string;
    topTypes: string[];
    signalCount?: number;
  }
): Promise<JournalistRating | null> {
  const key = journalistKey(name);
  if (!key) return null;
  const storageKey = JOUR_PREFIX + key;
  const res = await chrome.storage.local.get(storageKey);
  const prev = (res[storageKey] as JournalistRating | undefined) || {
    key,
    name: name.trim(),
    samples: 0,
    avgNeutrality: input.neutrality,
    lastScore: input.neutrality,
    lastTitle: input.title,
    lastHost: input.host,
    lastAt: new Date().toISOString(),
    topTypes: input.topTypes,
    totalSignals: 0,
    minScore: input.neutrality,
    maxScore: input.neutrality,
  };
  const samples = prev.samples + 1;
  const avgNeutrality =
    (prev.avgNeutrality * prev.samples + input.neutrality) / samples;
  const sig = input.signalCount ?? 0;
  const next: JournalistRating = {
    key,
    name: prev.name || name.trim(),
    samples,
    avgNeutrality: Math.round(avgNeutrality * 10) / 10,
    lastScore: input.neutrality,
    lastTitle: input.title,
    lastHost: input.host,
    lastAt: new Date().toISOString(),
    topTypes: input.topTypes.slice(0, 5),
    totalSignals: (prev.totalSignals ?? 0) + sig,
    minScore: Math.min(prev.minScore ?? input.neutrality, input.neutrality),
    maxScore: Math.max(prev.maxScore ?? input.neutrality, input.neutrality),
  };
  await chrome.storage.local.set({ [storageKey]: next });
  return withJournalistGrade(next);
}

export async function updateSiteRating(
  url: string,
  input: {
    neutrality: number;
    title: string;
    topTypes: string[];
    signalCount?: number;
  }
): Promise<SiteRating | null> {
  const host = hostKey(url);
  if (!host) return null;
  const key = PREFIX + host;
  const prev = (await getSiteRating(url)) || {
    host,
    samples: 0,
    avgNeutrality: input.neutrality,
    lastScore: input.neutrality,
    lastTitle: input.title,
    lastAt: new Date().toISOString(),
    topTypes: input.topTypes,
    totalSignals: 0,
    minScore: input.neutrality,
    maxScore: input.neutrality,
  };
  const samples = prev.samples + 1;
  const avgNeutrality =
    (prev.avgNeutrality * prev.samples + input.neutrality) / samples;
  const sig = input.signalCount ?? 0;
  const next: SiteRating = {
    host,
    samples,
    avgNeutrality: Math.round(avgNeutrality * 10) / 10,
    lastScore: input.neutrality,
    lastTitle: input.title,
    lastAt: new Date().toISOString(),
    topTypes: input.topTypes.slice(0, 5),
    totalSignals: (prev.totalSignals ?? 0) + sig,
    minScore: Math.min(prev.minScore ?? input.neutrality, input.neutrality),
    maxScore: Math.max(prev.maxScore ?? input.neutrality, input.neutrality),
  };
  await chrome.storage.local.set({ [key]: next });
  return next;
}

export async function getOutletBoard(
  opts?: { minSamples?: number; limit?: number; recentLimit?: number }
): Promise<OutletBoard> {
  const minSamples = opts?.minSamples ?? DEFAULT_MIN_SAMPLES;
  const limit = opts?.limit ?? 15;
  const recentLimit = opts?.recentLimit ?? 40;

  const all = await listAllSiteRatings();
  const ranked = all
    .filter((r) => r.samples >= minSamples)
    .sort((a, b) => b.avgNeutrality - a.avgNeutrality);

  const mostUnbiased = ranked.slice(0, limit);
  const mostBiased = [...ranked]
    .sort((a, b) => a.avgNeutrality - b.avgNeutrality)
    .slice(0, limit);

  const journalists = await listAllJournalistRatings();
  const jRanked = journalists
    .filter((r) => r.samples >= minSamples)
    .sort((a, b) => b.avgNeutrality - a.avgNeutrality);
  const mostUnbiasedJournalists = jRanked.slice(0, limit);
  const mostBiasedJournalists = [...jRanked]
    .sort((a, b) => a.avgNeutrality - b.avgNeutrality)
    .slice(0, limit);

  const recentScans = (await getScanHistory()).slice(0, recentLimit);

  let globalAvg: number | null = null;
  if (all.length) {
    const wSum = all.reduce((s, r) => s + r.avgNeutrality * r.samples, 0);
    const wN = all.reduce((s, r) => s + r.samples, 0);
    globalAvg = wN ? Math.round((wSum / wN) * 10) / 10 : null;
  }

  return {
    mostUnbiased: mostUnbiased.map(withGrade),
    mostBiased: mostBiased.map(withGrade),
    allOutlets: ranked.map(withGrade),
    mostUnbiasedJournalists: mostUnbiasedJournalists.map(withJournalistGrade),
    mostBiasedJournalists: mostBiasedJournalists.map(withJournalistGrade),
    allJournalists: jRanked.map(withJournalistGrade),
    recentScans: recentScans.map(withScanGrade),
    totals: {
      outlets: all.length,
      journalists: journalists.length,
      scans: all.reduce((s, r) => s + r.samples, 0),
      globalAvgNeutrality: globalAvg,
    },
    minSamples,
  };
}

export async function clearOutletStats(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(
    (k) =>
      k.startsWith(PREFIX) || k.startsWith(JOUR_PREFIX) || k === HISTORY_KEY
  );
  if (keys.length) await chrome.storage.local.remove(keys);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
