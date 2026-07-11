/**
 * Bias Noticer — Local rule-based fallback (no API key)
 *
 * Lightweight, high-precision-ish patterns only. This is intentionally
 * conservative: full quality requires Grok. Results are labeled source: "heuristic".
 */

import type { BiasAnalysis, BiasInstance, BiasType, PageExtract } from "./types";
import { hashString } from "./storage";

interface Rule {
  type: BiasType;
  pattern: RegExp;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  explanation: string;
  detailed: string;
  counter: string;
  alt: string;
}

const RULES: Rule[] = [
  {
    type: "loaded_language",
    pattern:
      /\b(slammed|destroyed|annihilated|shamed|explosive|bombshell|shocking|outrageous|radical|extreme|elites?|sheeple|woke mob|deep state)\b/gi,
    severity: 3,
    confidence: 0.55,
    explanation: "Emotionally loaded wording may steer interpretation.",
    detailed:
      "Words like this often carry judgment beyond a neutral description of events. Consider what a plainer verb or adjective would change.",
    counter:
      "Compare coverage from outlets with different audiences; check primary documents for the actual action described.",
    alt: "A more neutral description would name the action without pejorative intensifiers.",
  },
  {
    type: "sensationalism",
    pattern:
      /\b(you won't believe|goes viral|meltdown|chaos erupts|all hell breaks|war on|catastrophe|crisis engulfs)\b/gi,
    severity: 3,
    confidence: 0.6,
    explanation: "Sensational phrasing prioritizes heat over precision.",
    detailed:
      "Attention-maximizing language can inflate stakes. Ask whether scale and evidence match the drama.",
    counter:
      "Look for official statistics, timelines, and calm wire-service writeups of the same event.",
    alt: "State what happened with measurable scale and sourced claims.",
  },
  {
    type: "unsubstantiated_claim",
    pattern:
      /\b(sources say|it is widely known|everyone knows|clearly|undeniably|without question|proves that)\b/gi,
    severity: 2,
    confidence: 0.5,
    explanation: "Strong claim language may outrun cited evidence.",
    detailed:
      "Phrases that assert certainty or anonymous consensus deserve a source check.",
    counter:
      "Seek named sources, datasets, or on-the-record statements that support the claim.",
    alt: "Attribute the claim and qualify certainty appropriately.",
  },
  {
    type: "whataboutism",
    pattern:
      /\b(what about|but what about|and yet they|hypocri(sy|tical)|both sides always)\b/gi,
    severity: 2,
    confidence: 0.45,
    explanation: "Possible deflection via comparison to another issue.",
    detailed:
      "Comparing issues can be valid, but may also dodge the claim under discussion.",
    counter: "Evaluate each claim on its own evidence before comparing.",
    alt: "Address the original claim first; add comparisons only with shared metrics.",
  },
  {
    type: "false_dichotomy",
    pattern:
      /\b(either we .+ or we|there are only two options|you're either .+ or|no middle ground)\b/gi,
    severity: 3,
    confidence: 0.55,
    explanation: "Binary framing may hide additional options.",
    detailed:
      "False dichotomies compress complex policy or moral space into two poles.",
    counter: "List intermediate or alternative options from primary policy docs.",
    alt: "Acknowledge a spectrum of options and trade-offs.",
  },
  {
    type: "appeal_to_emotion",
    pattern:
      /\b(think of the children|tear-jerking|heartbreaking scene|terrified families|enraged public)\b/gi,
    severity: 2,
    confidence: 0.5,
    explanation: "Emotional appeal may dominate over evidence.",
    detailed:
      "Emotion can be legitimate reportage; it becomes a technique when it substitutes for substantiation.",
    counter: "Pair human impact with base rates and documented causes.",
    alt: "Report impact with concrete detail without instructing the reader how to feel.",
  },
  {
    type: "passive_voice_agency",
    pattern:
      /\b(mistakes were made|was killed in an encounter|were detained|shots were fired)\b/gi,
    severity: 2,
    confidence: 0.45,
    explanation: "Agency may be obscured by passive construction.",
    detailed:
      "Passive voice can hide who acted. Sometimes appropriate; often worth noting in accountability stories.",
    counter: "Find who did what from primary reports or bodycam / docket language.",
    alt: "Name the actor when known: who did what to whom.",
  },
  {
    type: "statistical_cherry_picking",
    pattern:
      /\b(record high|skyrocketed|plummeted|unprecedented|soared \d+%|dropped \d+%)\b/gi,
    severity: 2,
    confidence: 0.45,
    explanation: "Dramatic stats may lack base rate or timeframe context.",
    detailed:
      "Percent changes and superlatives need denominators, windows, and comparisons.",
    counter:
      "Check original datasets (BLS, ONS, Eurostat, academic tables) for full series.",
    alt: "State absolute levels, timeframe, and comparison baseline.",
  },
];

function makeId(seed: string): string {
  return `h_${hashString(seed).slice(0, 12)}`;
}

export function runHeuristicAnalysis(extract: PageExtract): BiasAnalysis {
  const instances: BiasInstance[] = [];
  const text = extract.text;
  const seen = new Set<string>();

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      const span = match[0];
      const key = `${rule.type}:${span.toLowerCase()}:${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Limit per rule to avoid noise
      const perType = instances.filter((i) => i.bias_type === rule.type).length;
      if (perType >= 3) break;

      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + span.length + 80);
      const context = text.slice(start, end);

      instances.push({
        id: makeId(key),
        span_text: span,
        context,
        bias_type: rule.type,
        severity: rule.severity,
        confidence: rule.confidence,
        concise_explanation: rule.explanation,
        detailed_explanation: rule.detailed,
        evidence_or_counter: rule.counter,
        alternative_perspective: rule.alt,
        char_start: match.index,
        char_end: match.index + span.length,
      });
    }
  }

  // Soft score: more instances → lower neutrality (heuristic only)
  const raw = Math.max(0, 88 - instances.length * 4);
  const neutrality = Math.min(95, Math.max(25, raw));

  return {
    version: 1,
    url: extract.url,
    title: extract.title,
    analyzed_at: new Date().toISOString(),
    content_hash: extract.contentHash,
    source: "heuristic",
    summary: {
      neutrality_score: neutrality,
      content_type: extract.isLikelyNews ? "hard_news" : "unknown",
      top_patterns: summarizePatterns(instances),
      recommended_sources_or_searches: [
        "primary source documents",
        "official statistics agency data",
        "coverage from outlets with different audiences",
      ],
      overview:
        "Local heuristic scan only. Pattern matches are approximate and may miss nuanced framing. Add an xAI API key in Settings for full Bias Noticer analysis.",
      caveats: [
        "Heuristic mode — higher false positive/negative risk",
        "No model-based context understanding",
        extract.possiblyPaywalled
          ? "Page text looks thin; paywall or login wall may limit analysis"
          : "",
      ].filter(Boolean),
    },
    instances: instances.slice(0, 20),
    notes: [
      "Analysis produced by on-device heuristics because no API key was available or limited mode forced local path.",
    ],
  };
}

function summarizePatterns(instances: BiasInstance[]): string[] {
  const counts = new Map<string, number>();
  for (const i of instances) {
    counts.set(i.bias_type, (counts.get(i.bias_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${t.replace(/_/g, " ")} (${n})`);
}
