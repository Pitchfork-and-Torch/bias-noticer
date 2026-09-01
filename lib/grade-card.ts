/**
 * Local grades-card export for tweets / posts.
 *
 * Renders PNG or JPEG in the extension page via Canvas 2D.
 * Never uploads article text. The card carries only share-safe fields:
 * title, hostname, letter grade, neutrality, technique *labels* + counts.
 * No span quotes, overviews, evidence, or body text.
 */

import type { BiasAnalysis, BiasInstance } from "./types";
import { getCategoryMeta } from "./taxonomy";
import { displayNeutrality, neutralityToGrade } from "./grades";
import { APP_VERSION } from "./version";

export const GRADE_CARD_WIDTH = 1200;
export const GRADE_CARD_HEIGHT = 630;
export const GRADE_CARD_PRODUCT_URL = "jonbailey.xyz/bias-noticer";
export const GRADE_CARD_DISCLAIMER =
  "Techniques over tribes. Not a left/right meter. Not a truth score.";

export type GradeCardKind = "article" | "outlet" | "journalist";
export type GradeCardFormat = "png" | "jpeg";

export interface GradeCardTechnique {
  label: string;
  count: number;
  hex: string;
}

export interface GradeCardModel {
  kind: GradeCardKind;
  /** Headline, outlet host, or journalist name — never article body */
  title: string;
  /** Hostname or scoreboard subtitle */
  subtitle: string;
  neutrality: number;
  grade: string;
  gradeLabel: string;
  gradeColor: string;
  signalCount?: number;
  sampleCount?: number;
  techniques: GradeCardTechnique[];
  contentType?: string;
  source?: string;
  analyzedAt?: string;
  version: string;
}

const TITLE_MAX = 96;
const SUBTITLE_MAX = 48;

export function hostFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "unknown-host";
  } catch {
    return "unknown-host";
  }
}

export function truncateShareText(s: string, max: number): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function techniquesFromInstances(
  instances: BiasInstance[]
): GradeCardTechnique[] {
  const m = new Map<string, GradeCardTechnique>();
  for (const inst of instances) {
    if (inst.verification === "rejected") continue;
    const meta = getCategoryMeta(inst.bias_type);
    const prev = m.get(meta.label);
    if (prev) prev.count += 1;
    else m.set(meta.label, { label: meta.label, count: 1, hex: meta.hex });
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 5);
}

/** Build a share-safe card model. Callers must not pass span/body into title. */
export function analysisToGradeCardModel(analysis: BiasAnalysis): GradeCardModel {
  const score = displayNeutrality(analysis.summary);
  const info = neutralityToGrade(score);
  const host = hostFromUrl(analysis.url);
  return {
    kind: "article",
    title: truncateShareText(analysis.title || "Untitled scan", TITLE_MAX),
    subtitle: truncateShareText(host, SUBTITLE_MAX),
    neutrality: score,
    grade: info.grade,
    gradeLabel: info.label,
    gradeColor: info.color,
    signalCount: analysis.instances.filter((i) => i.verification !== "rejected")
      .length,
    techniques: techniquesFromInstances(analysis.instances),
    contentType: analysis.summary.content_type?.replace(/_/g, " "),
    source: analysis.source,
    analyzedAt: (analysis.analyzed_at || "").slice(0, 10) || undefined,
    version: APP_VERSION,
  };
}

export function scoreboardToGradeCardModel(input: {
  kind: "outlet" | "journalist";
  title: string;
  subtitle?: string;
  neutrality: number;
  sampleCount: number;
  topTypes?: string[];
}): GradeCardModel {
  const info = neutralityToGrade(input.neutrality);
  const techniques: GradeCardTechnique[] = (input.topTypes || [])
    .slice(0, 5)
    .map((typeOrLabel) => {
      const meta = getCategoryMeta(typeOrLabel as never);
      const label =
        meta.label && meta.label !== typeOrLabel && !typeOrLabel.includes(" ")
          ? meta.label
          : typeOrLabel.replace(/_/g, " ");
      return { label, count: 1, hex: meta.hex || "#64748b" };
    });
  return {
    kind: input.kind,
    title: truncateShareText(input.title, TITLE_MAX),
    subtitle: truncateShareText(
      input.subtitle ||
        (input.kind === "outlet" ? "Outlet scoreboard" : "Journalist scoreboard"),
      SUBTITLE_MAX
    ),
    neutrality: Math.max(0, Math.min(100, Math.round(input.neutrality))),
    grade: info.grade,
    gradeLabel: info.label,
    gradeColor: info.color,
    sampleCount: input.sampleCount,
    techniques,
    version: APP_VERSION,
  };
}

/**
 * Fail closed if a model accidentally includes article-body-like fields.
 * Used by validators and as a runtime guard before draw/download.
 */
export function gradeCardModelIsShareSafe(
  model: GradeCardModel,
  forbiddenSnippets: string[] = []
): boolean {
  const blob = JSON.stringify(model).toLowerCase();
  if (blob.includes("span_text") || blob.includes("detailed_explanation")) {
    return false;
  }
  for (const raw of forbiddenSnippets) {
    const s = raw.trim();
    if (s.length < 12) continue;
    if (blob.includes(s.toLowerCase())) return false;
  }
  return true;
}

export function gradeCardFilename(
  model: GradeCardModel,
  format: GradeCardFormat
): string {
  const slug = (model.subtitle || model.title)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "scan";
  const day = model.analyzedAt || new Date().toISOString().slice(0, 10);
  return `bn-grade-card-${slug}-${model.grade}-${day}.${format === "jpeg" ? "jpg" : "png"}`;
}

export function gradeCardTweetText(model: GradeCardModel): string {
  const who =
    model.kind === "article"
      ? model.subtitle
      : model.title;
  const extra =
    model.kind === "article" && model.signalCount != null
      ? ` · ${model.signalCount} signal${model.signalCount === 1 ? "" : "s"}`
      : model.sampleCount != null
        ? ` · ${model.sampleCount} local scan${model.sampleCount === 1 ? "" : "s"}`
        : "";
  return [
    `${model.grade} (${model.neutrality}/100) on ${who}${extra}`,
    `${model.gradeLabel} — framing load, not a left/right score.`,
    `Bias Noticer · ${GRADE_CARD_DISCLAIMER}`,
    `https://${GRADE_CARD_PRODUCT_URL}`,
  ].join("\n");
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.length && lines.length === maxLines) {
    let last = lines[maxLines - 1]!;
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = last.endsWith("…") ? last : `${last}…`;
  }
  return lines;
}

function drawSunglasses(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
  ctx.fillStyle = "rgba(8, 16, 32, 0.85)";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // left lens
  roundRect(ctx, 0, 8, 28, 16, 4);
  ctx.fill();
  ctx.stroke();
  // right lens
  roundRect(ctx, 40, 8, 28, 16, 4);
  ctx.fill();
  ctx.stroke();
  // bridge
  ctx.beginPath();
  ctx.moveTo(28, 14);
  ctx.quadraticCurveTo(34, 10, 40, 14);
  ctx.stroke();
  // temples
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(-10, 8);
  ctx.moveTo(68, 12);
  ctx.lineTo(78, 8);
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  score: number,
  color: string
) {
  ctx.save();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  const start = -Math.PI / 2;
  const end = start + (Math.max(0, Math.min(100, score)) / 100) * Math.PI * 2;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();
  ctx.restore();
}

export function drawGradeCard(
  ctx: CanvasRenderingContext2D,
  model: GradeCardModel
): void {
  const w = GRADE_CARD_WIDTH;
  const h = GRADE_CARD_HEIGHT;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(0.45, "#0d1528");
  bg.addColorStop(1, "#0a101c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(180, 160, 20, 180, 160, 420);
  glow.addColorStop(0, "rgba(56, 189, 248, 0.16)");
  glow.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(980, 80, 10, 980, 80, 360);
  glow2.addColorStop(0, "rgba(129, 140, 248, 0.14)");
  glow2.addColorStop(1, "rgba(129, 140, 248, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 40; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // Frame
  ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
  ctx.lineWidth = 2;
  roundRect(ctx, 28, 24, w - 56, h - 48, 28);
  ctx.stroke();

  // Brand
  drawSunglasses(ctx, 64, 48, 1.05);
  ctx.fillStyle = "#e8eef9";
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.fillText("Bias Noticer", 160, 68);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 15px Inter, system-ui, sans-serif";
  ctx.fillText("See through the propaganda.", 160, 92);

  const kindLabel =
    model.kind === "outlet"
      ? "Outlet grade  ·  your local scans"
      : model.kind === "journalist"
        ? "Journalist grade  ·  your local scans"
        : "Article grade  ·  framing load";
  ctx.fillStyle = "#38bdf8";
  ctx.font = "600 13px Inter, system-ui, sans-serif";
  ctx.fillText(kindLabel.toUpperCase(), 64, 136);

  // Grade cluster
  const cx = 210;
  const cy = 330;
  drawRing(ctx, cx, cy, 118, model.neutrality, model.gradeColor);
  ctx.fillStyle = model.gradeColor;
  ctx.font = "800 72px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(model.grade, cx, cy + 8);
  ctx.fillStyle = "#e8eef9";
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.fillText(`${model.neutrality}`, cx, cy + 52);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px Inter, system-ui, sans-serif";
  ctx.fillText("neutrality / 100", cx, cy + 78);
  ctx.textAlign = "left";

  // Copy column
  const colX = 400;
  ctx.fillStyle = "#64748b";
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  ctx.fillText(model.subtitle, colX, 180);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 36px Inter, system-ui, sans-serif";
  const titleLines = wrapLines(ctx, model.title, 720, 2);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, colX, 228 + i * 44);
  });

  ctx.fillStyle = model.gradeColor;
  ctx.font = "600 20px Inter, system-ui, sans-serif";
  ctx.fillText(model.gradeLabel, colX, 228 + titleLines.length * 44 + 16);

  const metaBits = [
    model.contentType,
    model.source ? `source: ${model.source.replace(/_/g, " ")}` : "",
    model.signalCount != null
      ? `${model.signalCount} signal${model.signalCount === 1 ? "" : "s"}`
      : "",
    model.sampleCount != null
      ? `${model.sampleCount} local scan${model.sampleCount === 1 ? "" : "s"}`
      : "",
    model.analyzedAt,
  ].filter(Boolean) as string[];
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 15px Inter, system-ui, sans-serif";
  ctx.fillText(metaBits.join("  ·  "), colX, 360);

  let chipX = colX;
  const chipY = 392;
  for (const t of model.techniques) {
    ctx.font = "600 14px Inter, system-ui, sans-serif";
    const label = t.count > 1 ? `${t.label}  ×${t.count}` : t.label;
    const tw = ctx.measureText(label).width;
    const cw = tw + 28;
    if (chipX + cw > 1140) break;
    ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    ctx.strokeStyle = `${t.hex}99`;
    ctx.lineWidth = 1.5;
    roundRect(ctx, chipX, chipY, cw, 34, 17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(label, chipX + 14, chipY + 23);
    chipX += cw + 10;
  }

  // Footer
  ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
  ctx.fillRect(64, 520, w - 128, 1);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 14px Inter, system-ui, sans-serif";
  ctx.fillText(GRADE_CARD_DISCLAIMER, 64, 552);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 15px Inter, system-ui, sans-serif";
  ctx.fillText(
    `${GRADE_CARD_PRODUCT_URL}   ·   v${model.version}   ·   rendered on your device`,
    64,
    580
  );
}

export function renderGradeCardCanvas(model: GradeCardModel): HTMLCanvasElement {
  if (!gradeCardModelIsShareSafe(model)) {
    throw new Error("Grade card refused: model is not share-safe");
  }
  const canvas = document.createElement("canvas");
  canvas.width = GRADE_CARD_WIDTH;
  canvas.height = GRADE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  drawGradeCard(ctx, model);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: GradeCardFormat
): Promise<Blob> {
  const type = format === "jpeg" ? "image/jpeg" : "image/png";
  const quality = format === "jpeg" ? 0.88 : undefined;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not encode grade card"));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadGradeCard(
  model: GradeCardModel,
  format: GradeCardFormat = "png"
): Promise<void> {
  const canvas = renderGradeCardCanvas(model);
  const blob = await canvasToBlob(canvas, format);
  downloadBlob(gradeCardFilename(model, format), blob);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
