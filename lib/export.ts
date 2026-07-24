/**
 * Export analysis as Markdown or JSON for sharing / archives.
 */

import type { BiasAnalysis, ResearchAccessMethod } from "./types";
import { getCategoryMeta, SEVERITY_LABELS } from "./taxonomy";
import { displayNeutrality, neutralityToGrade } from "./grades";
import { PROMPT_VERSION } from "./prompt";

export const ACCESS_METHOD_LABELS: Record<ResearchAccessMethod, string> = {
  subscription: "Subscription / paid login",
  library: "Library or institutional access",
  gift_link: "Publisher gift / shared link",
  free_teaser: "Free teaser / metered allotment",
  reader_dom: "Reader extract (text already in page DOM)",
  public_archive: "Public web archive snapshot (user-opened)",
  paste_other: "Other lawful access (operator-attested)",
};

export function analysisToJson(analysis: BiasAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

export function analysisToMarkdown(analysis: BiasAnalysis): string {
  const { summary, instances, title, url, analyzed_at, source } = analysis;
  const score = displayNeutrality(summary);
  const grade = neutralityToGrade(score);
  const lines: string[] = [
    `# Bias Noticer Research Brief`,
    ``,
    `**Title:** ${title}`,
    `**URL:** ${url}`,
    `**Analyzed:** ${analyzed_at}`,
    `**Source:** ${source}${analysis.model ? ` (${analysis.model})` : ""}`,
    `**Prompt:** v${analysis.pipeline?.prompt_version || PROMPT_VERSION}`,
    analysis.pipeline
      ? `**Pipeline:** ${analysis.pipeline.depth} · passes: ${analysis.pipeline.passes_run.join(" → ")}`
      : "",
    ``,
    `> AI-assisted media-literacy analysis. **Not a truth arbiter, fact-checker, or political score.** Techniques over tribes. Augments judgment — does not replace it.`,
    ``,
  ].filter((l) => l !== undefined);

  if (analysis.research) {
    lines.push(...researchProvenanceMarkdown(analysis), ``);
  }

  lines.push(
    `## Executive summary`,
    ``,
    `- **Neutrality:** ${score}/100 · **Grade:** ${grade.grade} (${grade.label})`,
    summary.calibrated_neutrality != null &&
      summary.calibrated_neutrality !== summary.neutrality_score
      ? `- **Model raw neutrality:** ${summary.neutrality_score}/100 (calibrated from severity × confidence × voice)`
      : "",
    `- **Content type:** ${summary.content_type}`,
    `- **Signals:** ${instances.length}`,
    summary.headline_body_note
      ? `- **Headline / body:** ${summary.headline_body_note}`
      : "",
    ``,
    summary.overview,
    ``
  );

  // Remove empty strings from optional lines
  const cleaned = lines.filter((l) => l !== "");
  lines.length = 0;
  lines.push(...cleaned);

  if (summary.top_patterns.length) {
    lines.push(`### Top patterns`, ``);
    for (const p of summary.top_patterns) lines.push(`- ${p}`);
    lines.push(``);
  }

  if (summary.caveats.length) {
    lines.push(`### Caveats`, ``);
    for (const c of summary.caveats) lines.push(`- ${c}`);
    lines.push(``);
  }

  if (summary.recommended_sources_or_searches.length) {
    lines.push(`### Balance — searches / sources`, ``);
    for (const s of summary.recommended_sources_or_searches) lines.push(`- ${s}`);
    lines.push(``);
  }

  if (analysis.missing_context?.length) {
    lines.push(`### Structural / missing-context notes`, ``);
    for (const m of analysis.missing_context) {
      lines.push(
        `- **${m.kind}** (sev ${m.severity}, conf ${(m.confidence * 100).toFixed(0)}%): ${m.summary}`
      );
      if (m.evidence) lines.push(`  - Evidence: ${m.evidence}`);
    }
    lines.push(``);
  }

  lines.push(`## Evidence table`, ``);
  lines.push(
    `| # | Technique | Sev | Conf | Voice | Span |`,
    `|---:|---|---:|---:|---|---|`
  );
  instances.forEach((inst, i) => {
    const meta = getCategoryMeta(inst.bias_type);
    const span = inst.span_text.replace(/\|/g, "\\|").slice(0, 80);
    lines.push(
      `| ${i + 1} | ${meta.label} | ${inst.severity} | ${(inst.confidence * 100).toFixed(0)}% | ${inst.voice || "—"} | ${span} |`
    );
  });
  lines.push(``);

  lines.push(`## Detected signals (detail)`, ``);

  if (!instances.length) {
    lines.push(`_No instances above the current sensitivity threshold._`, ``);
  }

  instances.forEach((inst, i) => {
    const meta = getCategoryMeta(inst.bias_type);
    lines.push(
      `### ${i + 1}. ${meta.label}`,
      ``,
      `> ${inst.span_text}`,
      ``,
      `- **Severity:** ${inst.severity}/5 (${SEVERITY_LABELS[inst.severity] ?? ""})`,
      `- **Confidence:** ${(inst.confidence * 100).toFixed(0)}%`,
      inst.voice ? `- **Voice:** ${inst.voice}` : "",
      inst.verification ? `- **Verification:** ${inst.verification}` : "",
      inst.why_flagged ? `- **Why flagged:** ${inst.why_flagged}` : "",
      ``,
      inst.detailed_explanation || inst.concise_explanation,
      ``,
      `**Evidence / counterpoints:** ${inst.evidence_or_counter || "—"}`,
      ``,
      `**Alternative framing:** ${inst.alternative_perspective || "—"}`,
      ``
    );
    if (inst.suggested_rephrase) {
      lines.push(`**Suggested rephrase:** ${inst.suggested_rephrase}`, ``);
    }
  });

  lines.push(
    `## Methodology`,
    ``,
    `- Directionally agnostic: techniques over tribes.`,
    `- Privacy-first: analysis history stays local unless you BYOK Grok for this run.`,
    `- Prefer under-flagging; confidence and severity are honest estimates.`,
    `- Prompt version ${analysis.pipeline?.prompt_version || PROMPT_VERSION}.`,
    `- This is **not** a fact-check or political rating.`,
    ``,
    `---`,
    `Generated by [Bias Noticer](https://github.com/Pitchfork-and-Torch/bias-noticer) — See through the propaganda.`
  );

  return lines.filter((l) => l !== "").join("\n");
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function researchProvenanceMarkdown(analysis: BiasAnalysis): string[] {
  const r = analysis.research;
  if (!r) return [];
  const method =
    ACCESS_METHOD_LABELS[r.accessMethod] || r.accessMethod;
  return [
    `## Research provenance`,
    ``,
    `- **Source URL:** ${r.sourceUrl || analysis.url}`,
    `- **Access method:** ${method}`,
    r.accessNote ? `- **Access note:** ${r.accessNote}` : "",
    `- **Body word count:** ${r.wordCount}`,
    `- **Brief prepared:** ${r.preparedAt}`,
    `- **Attestation:** ${r.attestation}`,
    ``,
    `> This brief is for personal media-literacy research. It is not a substitute for a publisher subscription and does not document any paywall circumvention by Bias Noticer.`,
  ].filter(Boolean);
}

/**
 * Full research brief: provenance + analysis + optional paste excerpt.
 * Always suitable for audit trails when analyzing paywalled or offline copy.
 */
export function researchBriefToMarkdown(
  analysis: BiasAnalysis,
  opts?: { includeExcerpt?: boolean; excerpt?: string; maxExcerptChars?: number }
): string {
  const base = analysisToMarkdown(analysis);
  const max = opts?.maxExcerptChars ?? 4000;
  const lines: string[] = [base];

  if (!analysis.research) {
    lines.push(
      ``,
      `## Research provenance`,
      ``,
      `- **Source URL:** ${analysis.url}`,
      `- **Access method:** Not recorded (page scan / demo / cache)`,
      `- **Analyzed:** ${analysis.analyzed_at}`,
      ``
    );
  }

  if (opts?.includeExcerpt && opts.excerpt?.trim()) {
    const body = opts.excerpt.trim();
    const clipped =
      body.length > max
        ? `${body.slice(0, max)}\n\n[…excerpt truncated for brief size…]`
        : body;
    lines.push(
      ``,
      `## Source text excerpt (operator-supplied)`,
      ``,
      `\`\`\`text`,
      clipped,
      `\`\`\``,
      ``,
      `_Excerpt stored only in this export file — not uploaded by Bias Noticer except to the operator’s BYOK model during analysis._`,
      ``
    );
  }

  lines.push(
    `---`,
    `Bias Noticer research brief · techniques over verdicts · local-first`
  );
  return lines.join("\n");
}

export function researchBriefToJson(
  analysis: BiasAnalysis,
  opts?: { excerpt?: string }
): string {
  return JSON.stringify(
    {
      kind: "bias-noticer-research-brief",
      version: 1,
      generatedAt: new Date().toISOString(),
      research:
        analysis.research ??
        ({
          accessMethod: "paste_other" as ResearchAccessMethod,
          sourceUrl: analysis.url,
          wordCount: 0,
          preparedAt: analysis.analyzed_at,
          attestation:
            "Access method not recorded at analysis time (non-paste scan).",
        } satisfies NonNullable<BiasAnalysis["research"]>),
      analysis,
      excerpt: opts?.excerpt?.trim()
        ? opts.excerpt.trim().slice(0, 20_000)
        : undefined,
    },
    null,
    2
  );
}

export function researchBriefFilename(analysis: BiasAnalysis): string {
  const host = (() => {
    try {
      return new URL(analysis.research?.sourceUrl || analysis.url).hostname
        .replace(/^www\./, "")
        .replace(/[^\w.-]+/g, "-");
    } catch {
      return "research";
    }
  })();
  const day = (analysis.analyzed_at || new Date().toISOString()).slice(0, 10);
  return `bn-research-brief-${host}-${day}.md`;
}

/**
 * Print-friendly HTML report. User can Save as PDF from the browser print dialog.
 * Avoids shipping a heavy PDF library in the extension bundle.
 */
export function analysisToPrintHtml(analysis: BiasAnalysis): string {
  const md = analysisToMarkdown(analysis);
  // Minimal markdown → HTML for print (headings, lists, blockquotes, bold)
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const htmlBody = escaped
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("> ")) return `<blockquote>${line.slice(2)}</blockquote>`;
      if (line.startsWith("- ")) return `<li>${inline(line.slice(2))}</li>`;
      if (line.startsWith("---")) return `<hr/>`;
      if (!line.trim()) return `<br/>`;
      return `<p>${inline(line)}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Bias Noticer Report — ${escapeAttr(analysis.title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; line-height: 1.55; }
    h1,h2,h3 { font-family: system-ui, sans-serif; }
    blockquote { border-left: 3px solid #0ea5e9; margin: 0.5rem 0; padding: 0.25rem 0.75rem; color: #334155; font-style: italic; }
    li { margin-left: 1.25rem; }
    hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5rem 0; }
    .disclaimer { background: #fff7ed; border: 1px solid #fed7aa; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.9rem; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="disclaimer"><strong>Disclaimer:</strong> AI-assisted analysis. Not infallible. Designed to augment critical thinking, not replace it.</p>
  <p class="no-print"><button onclick="window.print()">Print / Save as PDF</button></p>
  ${htmlBody}
</body>
</html>`;
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function openPrintReport(analysis: BiasAnalysis): void {
  const html = analysisToPrintHtml(analysis);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke later so the print tab can load
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
