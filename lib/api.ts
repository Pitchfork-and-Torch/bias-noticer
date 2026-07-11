/**
 * Bias Noticer — xAI Grok API client
 *
 * BYOK (bring your own key). Calls are made from the service worker only.
 * Keys never leave chrome.storage.local except in Authorization headers.
 */

import type {
  BiasAnalysis,
  BiasInstance,
  BiasType,
  ExtensionSettings,
  PageExtract,
} from "./types";
import { buildRewritePrompt, buildUserPrompt, DEFAULT_SYSTEM_PROMPT } from "./prompt";
import { analysisLimiter, rewriteLimiter } from "./rate-limit";
import { DEFAULT_MODEL, hashString } from "./storage";
import { ALL_BIAS_TYPES } from "./taxonomy";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

interface GrokChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
  model?: string;
}

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return s.trim();
}

function extractJsonObject(raw: string): unknown {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to recover the outermost object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model returned non-JSON content");
  }
}

function isBiasType(v: unknown): v is BiasType {
  return typeof v === "string" && (ALL_BIAS_TYPES as string[]).includes(v);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeInstance(raw: Record<string, unknown>, idx: number): BiasInstance | null {
  const span = String(raw.span_text ?? raw.span ?? "").trim();
  if (!span || span.length < 2) return null;
  const biasType = isBiasType(raw.bias_type) ? raw.bias_type : "loaded_language";
  const severity = clamp(Number(raw.severity) || 2, 1, 5) as 1 | 2 | 3 | 4 | 5;
  const confidence = clamp(Number(raw.confidence) || 0.5, 0, 1);

  return {
    id: `g_${hashString(`${span}|${biasType}|${idx}`).slice(0, 14)}`,
    span_text: span,
    context: raw.context ? String(raw.context) : undefined,
    bias_type: biasType,
    severity,
    confidence,
    concise_explanation: String(
      raw.concise_explanation ?? raw.explanation ?? "Potential bias signal."
    ).slice(0, 280),
    detailed_explanation: String(
      raw.detailed_explanation ?? raw.concise_explanation ?? ""
    ).slice(0, 2000),
    evidence_or_counter: String(raw.evidence_or_counter ?? "").slice(0, 2000),
    alternative_perspective: String(raw.alternative_perspective ?? "").slice(0, 2000),
    suggested_rephrase: raw.suggested_rephrase
      ? String(raw.suggested_rephrase)
      : undefined,
    char_start:
      typeof raw.char_start === "number" ? (raw.char_start as number) : undefined,
    char_end: typeof raw.char_end === "number" ? (raw.char_end as number) : undefined,
  };
}

function normalizeAnalysis(
  data: unknown,
  extract: PageExtract,
  model?: string
): BiasAnalysis {
  const obj = (data ?? {}) as Record<string, unknown>;
  const summaryRaw = (obj.summary ?? {}) as Record<string, unknown>;
  const instancesRaw = Array.isArray(obj.instances) ? obj.instances : [];

  const instances = instancesRaw
    .map((item, i) =>
      item && typeof item === "object"
        ? normalizeInstance(item as Record<string, unknown>, i)
        : null
    )
    .filter((x): x is BiasInstance => Boolean(x));

  return {
    version: 1,
    url: extract.url,
    title: extract.title,
    analyzed_at: new Date().toISOString(),
    content_hash: extract.contentHash,
    source: "grok",
    model: model ?? "grok",
    summary: {
      neutrality_score: clamp(Number(summaryRaw.neutrality_score) || 50, 0, 100),
      content_type: (summaryRaw.content_type as BiasAnalysis["summary"]["content_type"]) ||
        "unknown",
      top_patterns: Array.isArray(summaryRaw.top_patterns)
        ? summaryRaw.top_patterns.map(String).slice(0, 5)
        : [],
      recommended_sources_or_searches: Array.isArray(
        summaryRaw.recommended_sources_or_searches
      )
        ? summaryRaw.recommended_sources_or_searches.map(String).slice(0, 8)
        : [],
      overview: String(summaryRaw.overview ?? "Analysis complete.").slice(0, 2000),
      caveats: Array.isArray(summaryRaw.caveats)
        ? summaryRaw.caveats.map(String)
        : [],
    },
    instances,
  };
}

const DEFAULT_TIMEOUT_MS = 90_000;

function redactSecrets(s: string): string {
  return s
    .replace(/xai-[A-Za-z0-9_-]{10,}/g, "xai-***")
    .replace(/Bearer\s+\S+/gi, "Bearer ***");
}

async function chatCompletion(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}): Promise<{ content: string; model?: string }> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: opts.model,
      temperature: opts.temperature ?? 0.2,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    // Prefer structured JSON when analyzing (xAI chat API supports json_object)
    if (opts.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = redactSecrets(await res.text().catch(() => ""));
      if (res.status === 401) {
        throw new Error("Invalid API key (401). Check your xAI key in Settings.");
      }
      if (res.status === 429) {
        throw new Error("Rate limited by xAI. Wait a moment and try again.");
      }
      if (res.status === 402 || /credit|billing|balance|payment/i.test(errText)) {
        throw new Error(
          "xAI billing/credits issue. Top up at console.x.ai, then retry."
        );
      }
      throw new Error(
        `xAI API error ${res.status}: ${errText.slice(0, 200) || res.statusText}`
      );
    }

    const data = (await res.json()) as GrokChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(
        redactSecrets(data.error?.message || "Empty response from xAI")
      );
    }
    return { content, model: data.model };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `xAI request timed out after ${Math.round(timeoutMs / 1000)}s. Try again or shorten the article.`
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function testApiKey(
  apiKey: string,
  model = DEFAULT_MODEL
): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const { model: m } = await chatCompletion({
      apiKey,
      model,
      system: "Reply with exactly: ok",
      user: "ping",
      temperature: 0,
    });
    return { ok: true, model: m || model };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function analyzeWithGrok(
  extract: PageExtract,
  settings: ExtensionSettings
): Promise<BiasAnalysis> {
  if (!settings.apiKey?.trim()) {
    throw new Error("No API key configured");
  }

  const limit = analysisLimiter.tryTake(1);
  if (!limit.allowed) {
    throw new Error(
      `Slow down — analysis rate limit. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s to protect your credits.`
    );
  }

  const system =
    settings.useCustomPrompt && settings.customSystemPrompt.trim()
      ? settings.customSystemPrompt
      : DEFAULT_SYSTEM_PROMPT;

  const user = buildUserPrompt({
    title: extract.title,
    url: extract.url,
    text: extract.text,
    siteName: extract.siteName,
    byline: extract.byline,
    sensitivity: settings.sensitivity,
    enabledCategories: settings.enabledCategories,
    limitedMode: settings.neverSendFullText,
  });

  let content: string;
  let model: string | undefined;
  try {
    const result = await chatCompletion({
      apiKey: settings.apiKey.trim(),
      model: settings.model || DEFAULT_MODEL,
      system,
      user,
      temperature: 0.25,
      jsonMode: true,
      maxTokens: 4096,
      timeoutMs: 120_000,
    });
    content = result.content;
    model = result.model;
  } catch (first) {
    // Fallback without json_object if the model rejects response_format
    const msg = first instanceof Error ? first.message : String(first);
    if (/response_format|json_object|invalid/i.test(msg)) {
      const result = await chatCompletion({
        apiKey: settings.apiKey.trim(),
        model: settings.model || DEFAULT_MODEL,
        system,
        user,
        temperature: 0.25,
        maxTokens: 4096,
        timeoutMs: 120_000,
      });
      content = result.content;
      model = result.model;
    } else {
      throw first;
    }
  }

  const parsed = extractJsonObject(content);
  let analysis = normalizeAnalysis(parsed, extract, model);

  // Apply client-side sensitivity / category filters as a second pass
  analysis = applyClientFilters(analysis, settings);
  return analysis;
}

export function applyClientFilters(
  analysis: BiasAnalysis,
  settings: ExtensionSettings
): BiasAnalysis {
  const confFloor =
    settings.sensitivity === "conservative"
      ? 0.72
      : settings.sensitivity === "thorough"
        ? 0.4
        : 0.52;
  const sevFloor = settings.sensitivity === "conservative" ? 3 : 1;

  const instances = analysis.instances.filter(
    (i) =>
      settings.enabledCategories.includes(i.bias_type) &&
      i.confidence >= confFloor &&
      i.severity >= sevFloor
  );

  return { ...analysis, instances };
}

export async function rewriteSpanWithGrok(
  settings: ExtensionSettings,
  input: {
    span: string;
    context: string;
    biasType: string;
    explanation: string;
  }
): Promise<{ rephrase: string; notes: string }> {
  if (!settings.apiKey?.trim()) {
    throw new Error("API key required for rewrite");
  }
  const limit = rewriteLimiter.tryTake(1);
  if (!limit.allowed) {
    throw new Error(
      `Rewrite rate limit — wait ${Math.ceil(limit.retryAfterMs / 1000)}s.`
    );
  }
  const { content } = await chatCompletion({
    apiKey: settings.apiKey.trim(),
    model: settings.model || DEFAULT_MODEL,
    system:
      "You rewrite short passages more neutrally. Output only JSON with keys rephrase and notes.",
    user: buildRewritePrompt(input),
    temperature: 0.3,
  });
  const parsed = extractJsonObject(content) as Record<string, unknown>;
  return {
    rephrase: String(parsed.rephrase ?? input.span),
    notes: String(parsed.notes ?? ""),
  };
}
