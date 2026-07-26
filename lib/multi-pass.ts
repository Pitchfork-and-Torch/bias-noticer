/**
 * Multi-pass analysis pipeline orchestration.
 *
 * Pass 0: structure (local)
 * Pass 1: primary technique detection (Grok or heuristics)
 * Pass 2: verification / grounding
 * Pass 3: missing context (optional thorough)
 *
 * Merge rules prefer under-flagging: rejected spans drop; downgraded keep lower severity.
 */

import type {
  AnalysisDepth,
  AnalysisPipelineMeta,
  BiasAnalysis,
  BiasInstance,
  MissingContextFinding,
  PageExtract,
} from "./types";
import {
  extractStructure,
  spanLooksQuoted,
  structureSummaryLine,
  type StructureExtract,
} from "./structure";
import { PROMPT_VERSION } from "./prompt";
import {
  computeCalibratedNeutrality,
  applyContentTypeNeutralityNudge,
} from "./grades";

export interface VerifyResult {
  /** Instance ids or span fingerprints to keep with optional overrides */
  keep: Array<{
    span_text: string;
    bias_type?: string;
    severity?: number;
    confidence?: number;
    voice?: BiasInstance["voice"];
    why_flagged?: string;
    status: "confirmed" | "downgraded" | "rejected";
    reason?: string;
  }>;
  notes?: string[];
}

export interface ContextPassResult {
  missing_context: MissingContextFinding[];
  headline_body_note?: string;
  recommended_searches?: string[];
  notes?: string[];
}

export function resolveDepth(
  multiPass: boolean,
  depth: AnalysisDepth | undefined,
  sensitivity: string
): AnalysisDepth {
  if (!multiPass) return "quick";
  if (depth) return depth;
  // Map thorough sensitivity to thorough depth when multi-pass is on
  if (sensitivity === "thorough") return "thorough";
  if (sensitivity === "conservative") return "standard";
  return "standard";
}

function spanKey(span: string, type: string): string {
  return `${type}|${span.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`;
}

/**
 * Merge Pass 2 verification into primary instances.
 * Unmatched primary instances stay as "unverified" (kept) when verify list is incomplete.
 */
export function mergeVerification(
  instances: BiasInstance[],
  verify: VerifyResult | null,
  structure: StructureExtract
): BiasInstance[] {
  if (!verify?.keep?.length) {
    return instances.map((i) => ({
      ...i,
      verification: i.verification ?? "unverified",
      voice:
        i.voice ??
        (spanLooksQuoted(i.span_text, structure) ? "quoted" : "unknown"),
      origin_pass: i.origin_pass ?? "primary",
    }));
  }

  const byKey = new Map(
    verify.keep.map((k) => [
      spanKey(k.span_text, String(k.bias_type || "")),
      k,
    ])
  );
  // Also index by span only for fuzzy match
  const bySpan = new Map(
    verify.keep.map((k) => [k.span_text.trim().toLowerCase().slice(0, 80), k])
  );

  const out: BiasInstance[] = [];
  for (const inst of instances) {
    const k1 = byKey.get(spanKey(inst.span_text, inst.bias_type));
    const k2 =
      k1 ||
      bySpan.get(inst.span_text.trim().toLowerCase().slice(0, 80));

    if (!k2) {
      out.push({
        ...inst,
        verification: "unverified",
        voice:
          inst.voice ??
          (spanLooksQuoted(inst.span_text, structure) ? "quoted" : "unknown"),
      });
      continue;
    }

    if (k2.status === "rejected") {
      continue; // under-flag: drop
    }

    let severity = inst.severity;
    let confidence = inst.confidence;
    if (typeof k2.severity === "number") {
      severity = Math.max(1, Math.min(5, Math.round(k2.severity))) as BiasInstance["severity"];
    }
    if (typeof k2.confidence === "number") {
      confidence = Math.max(0, Math.min(1, k2.confidence));
    }
    if (k2.status === "downgraded") {
      severity = Math.max(1, severity - 1) as BiasInstance["severity"];
      confidence = Math.max(0.3, confidence - 0.12);
    }

    out.push({
      ...inst,
      severity,
      confidence,
      voice:
        k2.voice ||
        inst.voice ||
        (spanLooksQuoted(inst.span_text, structure) ? "quoted" : "unknown"),
      why_flagged: k2.why_flagged || k2.reason || inst.why_flagged,
      verification: k2.status,
      origin_pass: "verify",
      concise_explanation:
        k2.status === "downgraded" && k2.reason
          ? `${inst.concise_explanation} (${k2.reason})`
          : inst.concise_explanation,
    });
  }
  return out;
}

export function attachMissingContext(
  analysis: BiasAnalysis,
  context: ContextPassResult | null
): BiasAnalysis {
  if (!context) return analysis;
  const missing = context.missing_context || [];
  const searches = [
    ...analysis.summary.recommended_sources_or_searches,
    ...(context.recommended_searches || []),
  ].slice(0, 8);
  const caveats = [...analysis.summary.caveats];
  if (context.notes?.length) caveats.push(...context.notes);

  return {
    ...analysis,
    version: 2,
    missing_context: missing,
    summary: {
      ...analysis.summary,
      recommended_sources_or_searches: [...new Set(searches)].slice(0, 8),
      caveats: [...new Set(caveats)],
      headline_body_note:
        context.headline_body_note || analysis.summary.headline_body_note,
    },
  };
}

/**
 * Finalize analysis: calibrated neutrality, pipeline meta, version bump.
 */
export function finalizeAnalysis(
  analysis: BiasAnalysis,
  opts: {
    structure: StructureExtract;
    depth: AnalysisDepth;
    passes: AnalysisPipelineMeta["passes_run"];
    passNotes?: string[];
    durationMs?: number;
  }
): BiasAnalysis {
  const instances = analysis.instances.map((i) => ({
    ...i,
    voice:
      i.voice ??
      (spanLooksQuoted(i.span_text, opts.structure) ? "quoted" : "unknown"),
  }));

  let neutrality = computeCalibratedNeutrality(
    instances,
    analysis.summary.neutrality_score
  );
  neutrality = applyContentTypeNeutralityNudge(
    neutrality,
    analysis.summary.content_type || opts.structure.contentTypeGuess
  );

  // If model left content_type unknown, use structure guess
  const content_type =
    analysis.summary.content_type === "unknown"
      ? opts.structure.contentTypeGuess
      : analysis.summary.content_type;

  const notes = [
    ...(analysis.notes || []),
    `Structure: ${structureSummaryLine(opts.structure)}`,
  ];
  if (opts.structure.notes.length) {
    notes.push(...opts.structure.notes.map((n) => `Structure note: ${n}`));
  }

  return {
    ...analysis,
    version: 2,
    source:
      analysis.source === "heuristic" || analysis.source === "demo"
        ? analysis.source
        : analysis.source === "cache"
          ? "cache"
          : opts.passes.includes("verify") || opts.passes.includes("context")
            ? "multi_pass"
            : analysis.source,
    instances,
    summary: {
      ...analysis.summary,
      content_type,
      neutrality_score: analysis.summary.neutrality_score,
      calibrated_neutrality: neutrality,
    },
    notes,
    pipeline: {
      depth: opts.depth,
      passes_run: opts.passes,
      prompt_version: PROMPT_VERSION,
      structure_notes: opts.structure.notes,
      pass_notes: opts.passNotes,
      duration_ms: opts.durationMs,
    },
  };
}

export function runStructurePass(extract: PageExtract): StructureExtract {
  return extractStructure(extract);
}

/**
 * Local-only lightweight "context" heuristics when Pass 3 LLM is skipped.
 */
export function localContextHints(
  extract: PageExtract,
  structure: StructureExtract,
  instances: BiasInstance[]
): ContextPassResult {
  const missing: MissingContextFinding[] = [];
  const title = extract.title || "";
  const body = extract.text || "";

  // Headline heat vs body
  const heat =
    /\b(shock|slam|destroy|chaos|war on|crisis|bombshell|outrage)\b/i;
  if (heat.test(title) && !heat.test(body.slice(0, 800))) {
    missing.push({
      kind: "headline_body_mismatch",
      summary:
        "Headline uses high-heat language that is weaker or absent in the opening body.",
      evidence: title.slice(0, 160),
      severity: 3,
      confidence: 0.55,
    });
  }

  if (structure.namedSources.length <= 1 && structure.wordCount > 250) {
    missing.push({
      kind: "source_homogeneity",
      summary:
        "Few named speakers detected — consider whether opposing or independent voices are missing.",
      severity: 2,
      confidence: 0.45,
    });
  }

  const hasOmission = instances.some(
    (i) => i.bias_type === "omission_framing" || i.bias_type === "source_selection"
  );
  if (hasOmission) {
    missing.push({
      kind: "missing_stakeholder",
      summary:
        "Flags already suggest omission or source selection — ask who is not quoted and what base rates are absent.",
      severity: 2,
      confidence: 0.5,
    });
  }

  return {
    missing_context: missing,
    headline_body_note: missing.find((m) => m.kind === "headline_body_mismatch")
      ?.summary,
    notes:
      missing.length === 0
        ? ["Local context pass: no strong structural gaps detected."]
        : undefined,
  };
}
