/**
 * Bias Noticer — Local Reader Mode (ethical extract)
 *
 * IMPORTANT (ethics & law):
 * - We ONLY reformat / analyze text the browser already received in the page DOM
 *   (or structured data embedded in the document).
 * - We do NOT authenticate as someone else, crack paywalls, or fetch paywalled
 *   content from third-party bypass services.
 * - UI copy: "Reader extract" — for personal media literacy analysis of content
 *   your browser loaded. Users remain responsible for site ToS and subscriptions.
 *
 * This mirrors browser reader-view UX: clean typography + optional analysis.
 */

import { Readability } from "@mozilla/readability";

export const BN_READER_ROOT_ID = "bn-reader-root";

export interface ReaderArticle {
  title: string;
  byline: string;
  siteName: string;
  /** Plain text for model */
  text: string;
  /** Sanitized HTML body for display */
  contentHtml: string;
  wordCount: number;
  /** How text was recovered */
  source:
    | "readability"
    | "jsonld"
    | "meta"
    | "paragraphs"
    | "combined";
  /** True if we recovered substantially more text than thin extract */
  improved: boolean;
}

/** Aggressive multi-strategy article recovery from current document only */
export function extractReaderArticle(doc: Document = document): ReaderArticle {
  const strategies: Array<{ text: string; html: string; source: ReaderArticle["source"] }> = [];

  // 1) Classic Readability
  try {
    const clone = doc.cloneNode(true) as Document;
    clone
      .querySelectorAll(
        "script, style, noscript, iframe, nav, footer, aside, [role='navigation'], [aria-hidden='true']"
      )
      .forEach((el) => el.remove());
    // Soft-show common paywall-hidden nodes that remain in DOM
    clone
      .querySelectorAll(
        "[aria-hidden='true'], .hide, .hidden, [hidden], .meteredContent, .paywall, .offer-rail"
      )
      .forEach((el) => {
        // Don't remove; try to read text if present
        el.removeAttribute("hidden");
        el.removeAttribute("aria-hidden");
        (el as HTMLElement).style.display = "block";
        (el as HTMLElement).style.visibility = "visible";
        (el as HTMLElement).style.height = "auto";
        (el as HTMLElement).style.overflow = "visible";
      });
    const article = new Readability(clone, { charThreshold: 120 }).parse();
    if (article?.content) {
      const tmp = doc.implementation.createHTMLDocument("r");
      tmp.body.innerHTML = article.content;
      const text = cleanText(tmp.body.textContent || "");
      if (text.length > 200) {
        strategies.push({
          text,
          html: sanitizeArticleHtml(article.content),
          source: "readability",
        });
      }
    }
  } catch {
    /* continue */
  }

  // 2) JSON-LD articleBody
  const ld = extractJsonLdArticle(doc);
  if (ld.text.length > 200) {
    strategies.push({
      text: ld.text,
      html: paragraphsToHtml(ld.text),
      source: "jsonld",
    });
  }

  // 3) Meta / microdata
  const metaBody =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    "";
  // 4) All substantial paragraphs in article-ish containers
  const para = extractParagraphDump(doc);
  if (para.text.length > 200) {
    strategies.push({
      text: para.text,
      html: para.html,
      source: "paragraphs",
    });
  }

  // 5) Common news story modules (NYT, WaPo, Guardian class patterns)
  const story = extractStoryModules(doc);
  if (story.text.length > 200) {
    strategies.push({
      text: story.text,
      html: story.html,
      source: "paragraphs",
    });
  }

  // Pick longest high-quality text; prefer readability when close
  strategies.sort((a, b) => b.text.length - a.text.length);
  const best = strategies[0];
  const title =
    doc.querySelector("h1")?.textContent?.trim() ||
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    doc.title ||
    "Article";
  const byline = extractByline(doc);
  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
    location.hostname.replace(/^www\./, "");

  if (!best) {
    const fallback = cleanText(doc.body?.innerText || "").slice(0, 50_000);
    return {
      title,
      byline,
      siteName,
      text: fallback,
      contentHtml: paragraphsToHtml(fallback),
      wordCount: countWords(fallback),
      source: "paragraphs",
      improved: false,
    };
  }

  // Combine readability + jsonld if both add unique length
  let text = best.text;
  let html = best.html;
  let source = best.source;
  if (strategies.length > 1) {
    const second = strategies[1]!;
    if (second.text.length > text.length * 1.15) {
      text = second.text;
      html = second.html;
      source = "combined";
    } else if (
      second.text.length > 400 &&
      !text.includes(second.text.slice(0, 80))
    ) {
      text = `${text}\n\n${second.text}`;
      html = `${html}${second.html}`;
      source = "combined";
    }
  }

  void metaBody; // reserved for future excerpt merge

  const wordCount = countWords(text);
  return {
    title,
    byline,
    siteName,
    text,
    contentHtml: html,
    wordCount,
    source,
    improved: wordCount > 280,
  };
}

function extractJsonLdArticle(doc: Document): { text: string } {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  );
  const chunks: string[] = [];
  for (const s of scripts) {
    try {
      const raw = JSON.parse(s.textContent || "null");
      const nodes = Array.isArray(raw) ? raw : [raw];
      const stack = [...nodes];
      while (stack.length) {
        const n = stack.pop();
        if (!n || typeof n !== "object") continue;
        const o = n as Record<string, unknown>;
        if (Array.isArray(o["@graph"])) stack.push(...(o["@graph"] as unknown[]));
        const type = String(o["@type"] || "");
        if (/Article|NewsArticle|ReportageNewsArticle|BlogPosting/i.test(type)) {
          const body = o.articleBody || o.text || o.description;
          if (typeof body === "string" && body.length > 80) chunks.push(body);
        }
      }
    } catch {
      /* skip bad json-ld */
    }
  }
  return { text: cleanText(chunks.join("\n\n")) };
}

/** Prefer real journalist bylines over share chrome */
function extractByline(doc: Document): string {
  const selectors = [
    'meta[name="byl"]',
    'meta[name="author"]',
    'meta[property="article:author"]',
    '[itemprop="author"] [itemprop="name"]',
    '[itemprop="author"]',
    '[rel="author"]',
    ".byline",
    ".author",
    ".authors",
    ".ArticleHeader-byline",
    "[data-testid='byline']",
    ".gnt_ar_by",
    ".story-meta__authors",
  ];
  for (const sel of selectors) {
    if (sel.startsWith("meta")) {
      const c = doc.querySelector(sel)?.getAttribute("content")?.trim();
      if (c && c.length > 2 && c.length < 200) return c;
      continue;
    }
    const el = doc.querySelector(sel);
    const t = el?.textContent?.replace(/\s+/g, " ").trim();
    if (t && t.length > 2 && t.length < 200) return t;
  }
  return "";
}

function extractParagraphDump(doc: Document): { text: string; html: string } {
  const root =
    doc.querySelector("article") ||
    doc.querySelector('[data-testid="article-body"]') ||
    doc.querySelector(".article-body, .StoryBodyCompanionColumn, main") ||
    doc.body;
  if (!root) return { text: "", html: "" };
  const paras = Array.from(root.querySelectorAll("p"))
    .map((p) => (p.textContent || "").trim())
    .filter((p) => p.length > 40 && !/subscribe|sign in|create an account/i.test(p));
  const text = cleanText(paras.join("\n\n"));
  return { text, html: paragraphsToHtml(text) };
}

/** Extra selectors used by major publishers when <article> is sparse */
function extractStoryModules(doc: Document): { text: string; html: string } {
  const selectors = [
    '[data-testid="article-body"]',
    '[name="articleBody"]',
    ".StoryBodyCompanionColumn",
    ".meteredContent",
    ".article-body",
    ".story-body",
    "#story",
    ".paywall",
    "section[name='articleBody']",
    "[itemprop='articleBody']",
  ];
  const chunks: string[] = [];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((node) => {
      const t = cleanText(node.textContent || "");
      if (t.length > 120) chunks.push(t);
    });
  }
  // Dedupe by first 80 chars
  const seen = new Set<string>();
  const unique = chunks.filter((c) => {
    const k = c.slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const text = cleanText(unique.join("\n\n"));
  return { text, html: paragraphsToHtml(text) };
}

function cleanText(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function paragraphsToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

function sanitizeArticleHtml(html: string): string {
  // Strip scripts/styles; keep simple tags
  const tmp = document.implementation.createHTMLDocument("s");
  tmp.body.innerHTML = html;
  tmp.body
    .querySelectorAll("script, style, iframe, object, embed, form, input, button")
    .forEach((el) => el.remove());
  tmp.body.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name) || attr.name === "srcset") {
        el.removeAttribute(attr.name);
      }
      if (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute("href");
      }
    });
  });
  return tmp.body.innerHTML;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isReaderOpen(): boolean {
  return Boolean(document.getElementById(BN_READER_ROOT_ID));
}

export function closeReaderMode(): void {
  document.getElementById(BN_READER_ROOT_ID)?.remove();
  document.documentElement.style.overflow = "";
}

/**
 * Full-screen local reader shell. Analysis can target this extracted text.
 */
export function openReaderMode(
  article: ReaderArticle,
  opts?: {
    onAnalyze?: () => void;
    onClose?: () => void;
    paywallHint?: boolean;
  }
): void {
  closeReaderMode();
  document.documentElement.style.overflow = "hidden";

  const root = document.createElement("div");
  root.id = BN_READER_ROOT_ID;
  root.className = "bn-ui";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Bias Noticer reader extract");

  root.innerHTML = `
    <div class="bn-reader-shell">
      <header class="bn-reader-bar">
        <div class="bn-reader-brand">
          <strong>Reader extract</strong>
          <span class="bn-reader-meta">${escapeHtml(article.siteName)} · ${article.wordCount} words · ${escapeHtml(article.source)}</span>
        </div>
        <div class="bn-reader-actions">
          <button type="button" data-bn-reader="analyze" class="bn-reader-primary">Analyze this text</button>
          <button type="button" data-bn-reader="close" class="bn-reader-ghost">Close</button>
        </div>
      </header>
      ${
        opts?.paywallHint
          ? `<div class="bn-reader-note">Paywall or meter detected on the live page. This view only reformats text already present in your browser document — it does not log you in or call bypass services. Educational / personal analysis use.</div>`
          : `<div class="bn-reader-note">Clean reading view built locally from this page. Privacy-first: nothing is sent until you run analysis with your key.</div>`
      }
      <article class="bn-reader-article">
        <h1>${escapeHtml(article.title)}</h1>
        ${article.byline ? `<p class="bn-reader-byline">${escapeHtml(article.byline)}</p>` : ""}
        <div class="bn-reader-body">${article.contentHtml}</div>
      </article>
    </div>
  `;

  // Inject styles once
  if (!document.getElementById("bn-reader-styles")) {
    const style = document.createElement("style");
    style.id = "bn-reader-styles";
    style.textContent = READER_CSS;
    document.documentElement.appendChild(style);
  }

  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const act = t.getAttribute("data-bn-reader");
    if (act === "close") {
      closeReaderMode();
      opts?.onClose?.();
    }
    if (act === "analyze") {
      opts?.onAnalyze?.();
    }
  });

  document.documentElement.appendChild(root);
}

const READER_CSS = `
#${BN_READER_ROOT_ID} {
  position: fixed; inset: 0; z-index: 2147483640;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(6px);
  display: grid; place-items: stretch;
  font-family: Inter, system-ui, sans-serif;
}
#${BN_READER_ROOT_ID} .bn-reader-shell {
  margin: 0 auto; width: min(820px, 100%);
  background: #fafaf9; color: #0f172a;
  display: flex; flex-direction: column;
  max-height: 100vh; box-shadow: 0 0 0 1px rgba(15,23,42,0.08), 0 24px 80px rgba(0,0,0,0.35);
}
#${BN_READER_ROOT_ID} .bn-reader-bar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;
  padding: 12px 16px; background: #0f172a; color: #e2e8f0;
  position: sticky; top: 0; z-index: 2;
}
#${BN_READER_ROOT_ID} .bn-reader-meta { display:block; font-size: 11px; opacity: 0.75; margin-top: 2px; }
#${BN_READER_ROOT_ID} .bn-reader-actions { display: flex; gap: 8px; }
#${BN_READER_ROOT_ID} .bn-reader-primary {
  border: 0; border-radius: 10px; padding: 8px 12px; font-weight: 600; cursor: pointer;
  background: #0ea5e9; color: white;
}
#${BN_READER_ROOT_ID} .bn-reader-ghost {
  border: 1px solid rgba(226,232,240,0.35); border-radius: 10px; padding: 8px 12px;
  background: transparent; color: #e2e8f0; cursor: pointer; font-weight: 600;
}
#${BN_READER_ROOT_ID} .bn-reader-note {
  padding: 10px 16px; font-size: 12px; line-height: 1.45;
  background: #ecfeff; color: #0c4a6e; border-bottom: 1px solid #a5f3fc;
}
#${BN_READER_ROOT_ID} .bn-reader-article {
  overflow: auto; padding: 28px 22px 64px; flex: 1;
  font-family: Georgia, "Times New Roman", serif; font-size: 18px; line-height: 1.7;
}
#${BN_READER_ROOT_ID} .bn-reader-article h1 {
  font-family: Inter, system-ui, sans-serif; font-size: 1.75rem; line-height: 1.25; margin: 0 0 12px;
}
#${BN_READER_ROOT_ID} .bn-reader-byline { font-size: 0.9rem; color: #64748b; margin-bottom: 1.25rem; }
#${BN_READER_ROOT_ID} .bn-reader-body p { margin: 0 0 1rem; }
@media (prefers-color-scheme: dark) {
  #${BN_READER_ROOT_ID} .bn-reader-shell { background: #0b1220; color: #e2e8f0; }
  #${BN_READER_ROOT_ID} .bn-reader-note { background: #082f49; color: #e0f2fe; border-color: #0c4a6e; }
  #${BN_READER_ROOT_ID} .bn-reader-byline { color: #94a3b8; }
}
@media (prefers-reduced-motion: reduce) {
  #${BN_READER_ROOT_ID} { backdrop-filter: none; }
}
`;
