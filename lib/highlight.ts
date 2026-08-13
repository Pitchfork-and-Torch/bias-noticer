/**
 * Bias Noticer — Non-destructive DOM highlighting (HighlightManager)
 *
 * Matching strategy (in order):
 * 1. Exact case-sensitive within a single text node
 * 2. Case-insensitive single node
 * 3. Whitespace-normalized multi-node map (handles soft hyphens, NBSP, odd wraps)
 * 4. Fuzzy: longest distinctive substring (≥12 chars) of the span
 *
 * Wrapping:
 * - Single-node: Range.surroundContents when safe
 * - Multi-node: extractContents → mark → insertNode
 * - Collision: skip if range intersects an existing .bn-highlight
 * - Marks use createElement + textContent patterns; tooltips escape HTML
 *
 * Never mutates React fiber props — only DOM text under content roots.
 * Content script pairs this with a debounced MutationObserver for SPA re-renders.
 */

import type { BiasInstance, HighlightStyle } from "./types";
import { getCategoryMeta } from "./taxonomy";

export const BN_MARK_CLASS = "bn-highlight";
export const BN_STYLE_ID = "bias-noticer-styles";
export const BN_PAYWALL_ID = "bn-paywall-banner";

const SKIP_SELECTOR =
  "script, style, noscript, textarea, input, select, option, [contenteditable='true'], .bn-ui, .bn-tooltip, .bn-toast, #" +
  BN_PAYWALL_ID;

export interface HighlightOptions {
  style: HighlightStyle;
  intensity: number;
  theme: "light" | "dark" | "they_live";
  reducedMotion: boolean;
}

export interface ApplyResult {
  applied: number;
  missed: string[];
  /** How many used fuzzy / multi-node paths */
  fuzzy: number;
  multiNode: number;
}

interface TextPoint {
  node: Text;
  offset: number;
}

interface TextHit {
  start: TextPoint;
  end: TextPoint;
  method: "exact" | "ci" | "normalized" | "fuzzy";
}

export function ensureHighlightStyles(opts: HighlightOptions): void {
  let el = document.getElementById(BN_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = BN_STYLE_ID;
    document.documentElement.appendChild(el);
  }

  const intensity = Math.max(0.2, Math.min(1, opts.intensity));
  const motion = opts.reducedMotion
    ? ""
    : `
  .bn-highlight.bn-pulse {
    animation: bn-emphasis 1.35s ease-out 1;
    z-index: 1;
  }
  @keyframes bn-emphasis {
    0% {
      box-shadow: 0 0 0 0 rgba(14,165,233,0.65), 0 0 0 0 rgba(14,165,233,0.25);
      filter: brightness(1.08);
    }
    40% {
      box-shadow: 0 0 0 4px rgba(14,165,233,0.35), 0 0 16px 2px rgba(14,165,233,0.2);
    }
    100% {
      box-shadow: 0 0 0 8px rgba(14,165,233,0), 0 0 0 0 rgba(14,165,233,0);
      filter: brightness(1);
    }
  }
  .bn-shades-overlay {
    animation: bn-shades 0.7s ease-out forwards;
  }
  @keyframes bn-shades {
    0% { opacity: 0.55; }
    100% { opacity: 0; }
  }
  .bn-paywall-banner {
    animation: bn-slide 0.25s ease-out;
  }
  @keyframes bn-slide {
    from { transform: translateY(-8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

  const theyLive =
    opts.theme === "they_live"
      ? `
  .bn-highlight {
    text-shadow: 0 0 6px rgba(0, 240, 255, 0.35);
  }
  .bn-highlight[data-bn-style="underline"] {
    text-decoration-color: #00f0ff !important;
  }
`
      : "";

  el.textContent = `
  :root { --bn-intensity: ${intensity}; }
  .bn-highlight {
    cursor: pointer;
    border-radius: 2px;
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
    position: relative;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
  .bn-highlight:focus-visible {
    outline: 2px solid #0ea5e9;
    outline-offset: 2px;
  }
  .bn-highlight[data-bn-style="underline"] {
    background: transparent;
    text-decoration-line: underline;
    text-decoration-style: wavy;
    text-decoration-thickness: from-font;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 100%), transparent);
  }
  .bn-highlight[data-bn-style="tint"] {
    background: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 22%), transparent);
  }
  .bn-highlight[data-bn-style="border"] {
    background: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 10%), transparent);
    box-shadow: inset 3px 0 0 0 color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 90%), transparent);
    padding-left: 2px;
  }
  .bn-highlight[data-bn-style="icon"]::before {
    content: attr(data-bn-icon);
    font-size: 0.7em;
    margin-right: 0.2em;
    opacity: 0.85;
  }
  .bn-highlight[data-bn-style="icon"] {
    background: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 14%), transparent);
  }
  .bn-highlight[data-bn-style="glow"] {
    background: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 12%), transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 35%), transparent),
      0 0 10px color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 40%), transparent);
  }
  .bn-highlight:hover, .bn-highlight.bn-active {
    background: color-mix(in srgb, var(--bn-color) calc(var(--bn-intensity) * 28%), transparent);
  }
  .bn-highlight.bn-active {
    outline: 2px solid color-mix(in srgb, var(--bn-color) 80%, #0ea5e9);
    outline-offset: 2px;
  }
  .bn-tooltip {
    position: fixed;
    z-index: 2147483646;
    max-width: 320px;
    padding: 10px 12px;
    border-radius: 12px;
    font: 13px/1.45 Inter, system-ui, sans-serif;
    color: ${opts.theme === "light" ? "#0f172a" : "#e2e8f0"};
    background: ${
      opts.theme === "light"
        ? "rgba(255,255,255,0.92)"
        : "rgba(15, 23, 42, 0.92)"
    };
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(148,163,184,0.25);
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.12s ease, transform 0.12s ease;
  }
  .bn-tooltip.bn-visible {
    opacity: 1;
    transform: translateY(0);
  }
  .bn-tooltip .bn-tip-type {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bn-color, #0ea5e9);
    margin-bottom: 4px;
  }
  .bn-tooltip .bn-tip-meta {
    font-size: 11px;
    opacity: 0.65;
    margin-top: 6px;
  }
  .bn-toast {
    position: fixed;
    z-index: 2147483647;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 999px;
    font: 600 13px/1 Inter, system-ui, sans-serif;
    color: #e0f2fe;
    background: linear-gradient(135deg, #0c4a6e, #082f49);
    box-shadow: 0 8px 30px rgba(8,47,73,0.45), 0 0 0 1px rgba(56,189,248,0.25);
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: none;
  }
  .bn-toast.bn-visible { opacity: 1; }
  .bn-shades-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
    pointer-events: none;
    background:
      repeating-linear-gradient(
        0deg,
        rgba(0,0,0,0.04),
        rgba(0,0,0,0.04) 1px,
        transparent 2px,
        transparent 3px
      ),
      radial-gradient(ellipse at center, rgba(0,240,255,0.08), transparent 60%);
  }
  .bn-paywall-banner {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483646;
    max-width: min(480px, calc(100vw - 24px));
    padding: 12px 14px;
    border-radius: 14px;
    font: 13px/1.45 Inter, system-ui, sans-serif;
    color: #0c4a6e;
    background: rgba(224, 242, 254, 0.96);
    border: 1px solid rgba(14, 165, 233, 0.35);
    box-shadow: 0 12px 40px rgba(8, 47, 73, 0.18);
  }
  .bn-paywall-banner strong { display: block; margin-bottom: 4px; }
  .bn-paywall-banner button {
    margin-top: 8px;
    margin-right: 8px;
    border: 0;
    border-radius: 8px;
    padding: 6px 10px;
    font: 600 12px Inter, system-ui, sans-serif;
    cursor: pointer;
    background: #0284c7;
    color: white;
  }
  .bn-paywall-banner button.bn-secondary {
    background: transparent;
    color: #0369a1;
    border: 1px solid rgba(3, 105, 161, 0.35);
  }
  .bn-nav-chip {
    position: fixed;
    z-index: 2147483646;
    right: 16px;
    bottom: 16px;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 999px;
    font: 600 12px Inter, system-ui, sans-serif;
    color: #e2e8f0;
    background: rgba(15, 23, 42, 0.92);
    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
    border: 1px solid rgba(148,163,184,0.25);
  }
  .bn-nav-chip button {
    border: 0;
    background: #0ea5e9;
    color: white;
    border-radius: 999px;
    width: 28px;
    height: 28px;
    font-weight: 700;
    cursor: pointer;
  }
  .bn-nav-chip button:disabled { opacity: 0.4; cursor: default; }
  @media (prefers-reduced-motion: reduce) {
    .bn-highlight.bn-pulse, .bn-shades-overlay, .bn-tooltip, .bn-paywall-banner {
      animation: none !important;
      transition: none !important;
    }
  }
  ${motion}
  ${theyLive}
  `;
}

function getSearchRoots(): Element[] {
  const nodes = [
    document.querySelector("article"),
    document.querySelector('[role="main"]'),
    document.querySelector("main"),
    document.querySelector(
      ".article-body, .story-body, .post-content, .entry-content, .article__body, [data-component='text-block']"
    ),
  ].filter(Boolean) as Element[];
  if (nodes.length) return nodes;
  return document.body ? [document.body] : [];
}

function isSkipped(node: Node): boolean {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  if (!el) return true;
  if (el.closest(SKIP_SELECTOR)) return true;
  if (el.closest(`.${BN_MARK_CLASS}`)) return true;
  return false;
}

/** Collect walkable text nodes under roots */
function collectTextNodes(): Text[] {
  const out: Text[] = [];
  for (const root of getSearchRoots()) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isSkipped(node)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n = walker.nextNode() as Text | null;
    while (n) {
      out.push(n);
      n = walker.nextNode() as Text | null;
    }
  }
  return out;
}

function normalizeWs(s: string): string {
  return s
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "") // soft hyphen / zero-width
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build concatenated text with a map from each concatenated index → TextPoint.
 * Spaces between adjacent text nodes are collapsed carefully.
 */
function buildTextMap(nodes: Text[]): {
  full: string;
  map: TextPoint[]; // map[i] = source of full[i]
} {
  let full = "";
  const map: TextPoint[] = [];

  for (const node of nodes) {
    const value = node.nodeValue || "";
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]!;
      // Collapse runs of whitespace in the map to a single space for matching
      if (/\s/.test(ch)) {
        if (full.endsWith(" ")) continue;
        full += " ";
        map.push({ node, offset: i });
      } else {
        full += ch;
        map.push({ node, offset: i });
      }
    }
    // Soft boundary between nodes
    if (full.length && !full.endsWith(" ")) {
      // no extra space — node content already has spacing usually
    }
  }
  return { full, map };
}

function findInMap(
  needle: string,
  nodes: Text[],
  usedRanges: Array<{ startKey: string; endKey: string }>
): TextHit | null {
  if (!needle || needle.length < 2 || !nodes.length) return null;

  const trySingle = (caseSensitive: boolean): TextHit | null => {
    for (const node of nodes) {
      const value = node.nodeValue || "";
      const hay = caseSensitive ? value : value.toLowerCase();
      const nd = caseSensitive ? needle : needle.toLowerCase();
      let from = 0;
      while (from < hay.length) {
        const idx = hay.indexOf(nd, from);
        if (idx < 0) break;
        const start = { node, offset: idx };
        const end = { node, offset: idx + needle.length };
        const key = pointKey(start) + "|" + pointKey(end);
        if (!usedRanges.some((u) => u.startKey + "|" + u.endKey === key)) {
          if (!rangeOverlapsHighlight(start, end)) {
            return {
              start,
              end,
              method: caseSensitive ? "exact" : "ci",
            };
          }
        }
        from = idx + 1;
      }
    }
    return null;
  };

  const exact = trySingle(true);
  if (exact) return exact;
  const ci = trySingle(false);
  if (ci) return ci;

  // Normalized multi-node
  const { full, map } = buildTextMap(nodes);
  const normNeedle = normalizeWs(needle);
  if (normNeedle.length < 2) return null;

  const fullLower = full.toLowerCase();
  const needleLower = normNeedle.toLowerCase();

  let searchFrom = 0;
  while (searchFrom < fullLower.length) {
    const idx = fullLower.indexOf(needleLower, searchFrom);
    if (idx < 0) break;
    const endIdx = idx + needleLower.length - 1;
    if (idx >= map.length || endIdx >= map.length) break;
    const start = map[idx]!;
    const endPoint = map[endIdx]!;
    // end offset is exclusive in Range API → +1 on same char if possible
    const end: TextPoint = advancePoint(endPoint);
    const sk = pointKey(start);
    const ek = pointKey(end);
    if (
      !usedRanges.some((u) => u.startKey === sk && u.endKey === ek) &&
      !rangeOverlapsHighlight(start, end)
    ) {
      return { start, end, method: "normalized" };
    }
    searchFrom = idx + 1;
  }

  // Fuzzy: try distinctive chunks of the needle (middle slice, then word windows)
  const candidates = fuzzyCandidates(normNeedle);
  for (const cand of candidates) {
    const c = cand.toLowerCase();
    const idx = fullLower.indexOf(c);
    if (idx < 0) continue;
    const endIdx = idx + c.length - 1;
    if (idx >= map.length || endIdx >= map.length) continue;
    const start = map[idx]!;
    const end = advancePoint(map[endIdx]!);
    if (!rangeOverlapsHighlight(start, end)) {
      return { start, end, method: "fuzzy" };
    }
  }

  return null;
}

function fuzzyCandidates(text: string): string[] {
  const t = text.trim();
  if (t.length < 12) return [];
  const out: string[] = [];
  // Middle 60%
  const a = Math.floor(t.length * 0.2);
  const b = Math.ceil(t.length * 0.8);
  out.push(t.slice(a, b));
  // First 40 chars and last 40 if long
  if (t.length > 24) {
    out.push(t.slice(0, Math.min(40, t.length)));
    out.push(t.slice(Math.max(0, t.length - 40)));
  }
  // Word windows of ~5 words
  const words = t.split(/\s+/);
  if (words.length >= 5) {
    for (let i = 0; i <= words.length - 5; i++) {
      const win = words.slice(i, i + 5).join(" ");
      if (win.length >= 16) out.push(win);
    }
  }
  // Prefer longer unique-ish strings first
  return [...new Set(out)].sort((x, y) => y.length - x.length).slice(0, 12);
}

function pointKey(p: TextPoint): string {
  return `${pathOf(p.node)}:${p.offset}`;
}

function advancePoint(p: TextPoint): TextPoint {
  const len = (p.node.nodeValue || "").length;
  if (p.offset + 1 <= len) return { node: p.node, offset: p.offset + 1 };
  return p;
}

function pathOf(node: Node): string {
  const parts: string[] = [];
  let n: Node | null = node;
  while (n && n !== document.body && parts.length < 14) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const parent = el.parentElement;
      const idx = parent ? Array.from(parent.children).indexOf(el) : 0;
      parts.push(`${el.tagName.toLowerCase()}[${idx}]`);
    } else {
      parts.push("t");
    }
    n = n.parentNode;
  }
  return parts.reverse().join(">");
}

function rangeOverlapsHighlight(start: TextPoint, end: TextPoint): boolean {
  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const marks = document.querySelectorAll(`.${BN_MARK_CLASS}`);
    for (const mark of marks) {
      const mr = document.createRange();
      mr.selectNodeContents(mark);
      // overlap if start < otherEnd && end > otherStart
      if (
        range.compareBoundaryPoints(Range.END_TO_START, mr) < 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, mr) > 0
      ) {
        return true;
      }
    }
  } catch {
    return true;
  }
  return false;
}

function createMark(inst: BiasInstance, opts: HighlightOptions): HTMLElement {
  const mark = document.createElement("mark");
  mark.className = BN_MARK_CLASS;
  mark.dataset.bnId = inst.id;
  mark.dataset.bnType = inst.bias_type;
  mark.dataset.bnStyle = opts.style;
  mark.dataset.bnSeverity = String(inst.severity);
  const meta = getCategoryMeta(inst.bias_type);
  mark.dataset.bnIcon = meta.icon;
  mark.style.setProperty("--bn-color", meta.hex);
  mark.setAttribute("tabindex", "0");
  mark.setAttribute("role", "button");
  mark.setAttribute(
    "aria-label",
    `Bias signal: ${meta.label}. ${inst.concise_explanation}`
  );
  return mark;
}

function wrapHit(
  hit: TextHit,
  inst: BiasInstance,
  opts: HighlightOptions
): boolean {
  try {
    const range = document.createRange();
    range.setStart(hit.start.node, hit.start.offset);
    range.setEnd(hit.end.node, hit.end.offset);
    if (range.collapsed) return false;

    // Don't wrap UI
    const anc = range.commonAncestorContainer;
    const ancEl =
      anc.nodeType === Node.ELEMENT_NODE
        ? (anc as Element)
        : anc.parentElement;
    if (ancEl?.closest(SKIP_SELECTOR)) return false;

    const mark = createMark(inst, opts);

    // Same text node & simple path → surroundContents
    if (hit.start.node === hit.end.node) {
      try {
        range.surroundContents(mark);
        return true;
      } catch {
        // fall through
      }
    }

    // Multi-node / partial element path
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);
    // Normalize adjacent text
    mark.parentNode?.normalize();
    return true;
  } catch {
    return false;
  }
}

export function clearHighlights(): void {
  progressiveObserver?.disconnect();
  progressiveObserver = null;
  document.querySelectorAll(`.${BN_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
  document.getElementById("bn-tooltip")?.remove();
  document.getElementById("bn-nav-chip")?.remove();
}

export function applyHighlights(
  instances: BiasInstance[],
  opts: HighlightOptions
): ApplyResult {
  return HighlightManager.apply(instances, opts);
}

/**
 * Central manager for highlight lifecycle.
 * Prefer this class for new call sites; free functions remain for compatibility.
 */
export class HighlightManager {
  static apply(
    instances: BiasInstance[],
    opts: HighlightOptions
  ): ApplyResult {
    ensureHighlightStyles(opts);
    clearHighlights();

    const nodes = collectTextNodes();
    const used: Array<{ startKey: string; endKey: string }> = [];
    let applied = 0;
    let fuzzy = 0;
    let multiNode = 0;
    const missed: string[] = [];

    // Longer first → fewer accidental short collisions
    const sorted = [...instances].sort(
      (a, b) => b.span_text.length - a.span_text.length
    );

    for (const inst of sorted) {
      const needle = inst.span_text.trim();
      if (needle.length < 2) {
        missed.push(inst.id);
        continue;
      }
      const hit = findInMap(needle, nodes, used);
      if (!hit) {
        missed.push(inst.id);
        continue;
      }
      const ok = wrapHit(hit, inst, opts);
      if (!ok) {
        missed.push(inst.id);
        continue;
      }
      used.push({
        startKey: pointKey(hit.start),
        endKey: pointKey(hit.end),
      });
      applied++;
      if (hit.method === "fuzzy") fuzzy++;
      if (hit.start.node !== hit.end.node || hit.method === "normalized") {
        multiNode++;
      }
    }

    // Progressive reveal: off-screen marks start dim; IntersectionObserver
    // brings them to full intensity without layout thrash on long articles.
    if (!opts.reducedMotion) {
      setupProgressiveReveal();
    }

    return { applied, missed, fuzzy, multiNode };
  }

  static clear(): void {
    clearHighlights();
  }

  static scrollTo(instanceId: string): boolean {
    return scrollToHighlight(instanceId);
  }

  /** Count live marks — used by MutationObserver re-apply logic */
  static count(): number {
    return document.querySelectorAll(`.${BN_MARK_CLASS}`).length;
  }
}

let progressiveObserver: IntersectionObserver | null = null;

function setupProgressiveReveal(): void {
  progressiveObserver?.disconnect();
  const marks = document.querySelectorAll(`.${BN_MARK_CLASS}`);
  if (!marks.length || typeof IntersectionObserver === "undefined") return;

  marks.forEach((m) => {
    (m as HTMLElement).style.opacity = "0.55";
  });

  progressiveObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transition = "opacity 0.25s ease";
          progressiveObserver?.unobserve(el);
        }
      }
    },
    { root: null, rootMargin: "80px 0px", threshold: 0.05 }
  );

  marks.forEach((m) => progressiveObserver!.observe(m));
}

export function scrollToHighlight(instanceId: string): boolean {
  const el = document.querySelector(
    `.${BN_MARK_CLASS}[data-bn-id="${CSS.escape(instanceId)}"]`
  ) as HTMLElement | null;
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("bn-pulse", "bn-active");
  el.focus({ preventScroll: true });
  window.setTimeout(() => el.classList.remove("bn-pulse", "bn-active"), 1400);
  return true;
}

export function getHighlightIdsInOrder(): string[] {
  return Array.from(document.querySelectorAll(`.${BN_MARK_CLASS}`))
    .map((el) => (el as HTMLElement).dataset.bnId || "")
    .filter(Boolean);
}

export function navigateHighlight(delta: number, currentId?: string | null): string | null {
  const ids = getHighlightIdsInOrder();
  if (!ids.length) return null;
  let idx = currentId ? ids.indexOf(currentId) : -1;
  if (idx < 0) idx = delta > 0 ? -1 : 0;
  const next = ids[(idx + delta + ids.length) % ids.length]!;
  scrollToHighlight(next);
  return next;
}

export function showToast(message: string, ms = 2200): void {
  let toast = document.getElementById("bn-toast") as HTMLElement | null;
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bn-toast";
    toast.className = "bn-toast bn-ui";
    toast.setAttribute("role", "status");
    document.documentElement.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("bn-visible");
  window.setTimeout(() => toast?.classList.remove("bn-visible"), ms);
}

export function playShadesAnimation(reducedMotion: boolean): void {
  if (reducedMotion) return;
  const overlay = document.createElement("div");
  overlay.className = "bn-shades-overlay bn-ui";
  document.documentElement.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), 750);
}

export function showPaywallBanner(
  wordCount: number,
  opts?: { onOpenReader?: () => void }
): void {
  document.getElementById(BN_PAYWALL_ID)?.remove();
  const banner = document.createElement("div");
  banner.id = BN_PAYWALL_ID;
  banner.className = "bn-paywall-banner bn-ui";
  banner.setAttribute("role", "status");
  banner.innerHTML = `
    <strong>Limited text / possible paywall</strong>
    <div>Only ~${wordCount} words visible. Side panel still works for free-teaser scan, Reader (DOM), or Research paste. Open panel: <kbd>Ctrl+Shift+Y</kbd> (⌘⇧Y). Bias Noticer never bypasses paywalls.</div>
    <div>
      <button type="button" data-bn-act="reader">Open Reader extract</button>
      <button type="button" class="bn-secondary" data-bn-act="panel">Open side panel</button>
      <button type="button" class="bn-secondary" data-bn-act="dismiss">Dismiss</button>
    </div>
  `;
  banner.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const act = t.getAttribute("data-bn-act");
    if (act === "reader") {
      banner.remove();
      opts?.onOpenReader?.();
    }
    if (act === "panel") {
      banner.remove();
      // Content-script clicks are NOT valid for sidePanel.open — tell the user.
      showToast("Open side panel: Ctrl+Shift+Y (⌘⇧Y)");
    }
    if (act === "dismiss") banner.remove();
  });
  document.documentElement.appendChild(banner);
  window.setTimeout(() => banner.remove(), 18000);
}

export function ensureNavChip(
  total: number,
  onPrev: () => void,
  onNext: () => void
): void {
  let chip = document.getElementById("bn-nav-chip") as HTMLElement | null;
  if (total <= 1) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement("div");
    chip.id = "bn-nav-chip";
    chip.className = "bn-nav-chip bn-ui";
    chip.innerHTML = `
      <button type="button" data-bn-nav="prev" title="Previous signal (Alt+[)">‹</button>
      <span data-bn-nav-label></span>
      <button type="button" data-bn-nav="next" title="Next signal (Alt+])">›</button>
    `;
    chip.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const nav = t.getAttribute("data-bn-nav");
      if (nav === "prev") onPrev();
      if (nav === "next") onNext();
    });
    document.documentElement.appendChild(chip);
  }
  const label = chip.querySelector("[data-bn-nav-label]");
  if (label) label.textContent = `${total} signals · Alt+[ ]`;
}

export function createTooltipController() {
  let tip = document.getElementById("bn-tooltip") as HTMLElement | null;
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "bn-tooltip";
    tip.className = "bn-tooltip bn-ui";
    tip.setAttribute("role", "tooltip");
    document.documentElement.appendChild(tip);
  }

  let hideTimer: number | undefined;
  let showTimer: number | undefined;

  const hide = () => {
    tip?.classList.remove("bn-visible");
  };

  const showFor = (
    mark: HTMLElement,
    explanation: string,
    typeLabel: string,
    meta: string
  ) => {
    if (!tip) return;
    tip.innerHTML = `
      <div class="bn-tip-type" style="--bn-color:${mark.style.getPropertyValue("--bn-color") || "#0ea5e9"}">${typeLabel}</div>
      <div>${escapeHtml(explanation)}</div>
      <div class="bn-tip-meta">${escapeHtml(meta)} · click for details · Alt+[ ] navigate</div>
    `;
    const rect = mark.getBoundingClientRect();
    const tipW = 300;
    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    let top = rect.bottom + 8;
    if (top + 120 > window.innerHeight) {
      top = rect.top - 8 - 100;
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
    tip.style.width = `${tipW}px`;
    tip.classList.add("bn-visible");
  };

  return {
    scheduleShow(
      mark: HTMLElement,
      explanation: string,
      typeLabel: string,
      meta: string,
      delay = 180
    ) {
      window.clearTimeout(hideTimer);
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(
        () => showFor(mark, explanation, typeLabel, meta),
        delay
      );
    },
    scheduleHide(delay = 120) {
      window.clearTimeout(showTimer);
      hideTimer = window.setTimeout(hide, delay);
    },
    hide,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
