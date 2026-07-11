/**
 * Offline mock analysis for development / demos without an API key.
 * Import in tests or inject via a dev flag if needed.
 */

import type { BiasAnalysis } from "./types";

export const MOCK_ANALYSIS: BiasAnalysis = {
  version: 1,
  url: "https://example.com/demo-article",
  title: "Demo: City Council Debates Housing Plan",
  analyzed_at: new Date().toISOString(),
  content_hash: "demo",
  source: "demo",
  summary: {
    neutrality_score: 62,
    content_type: "hard_news",
    top_patterns: [
      "loaded language (2)",
      "source selection (1)",
      "statistical cherry picking (1)",
    ],
    recommended_sources_or_searches: [
      "city council meeting minutes PDF",
      "housing starts local dataset",
      "coverage from local outlet with different ownership",
    ],
    overview:
      "Demo mode paints sample signals so you can try highlights, tooltips, and the side panel without an API key. Run a real scan on an article for live detection.",
    caveats: ["Demo / offline sample — not based on this page’s full analysis."],
  },
  instances: [
    {
      id: "demo_1",
      span_text: "the",
      bias_type: "loaded_language",
      severity: 2,
      confidence: 0.4,
      concise_explanation:
        "Demo marker: first common word so highlights always appear.",
      detailed_explanation:
        "This is a demonstration highlight so you can verify tooltip, side panel, and navigation work. Replace with a real scan.",
      evidence_or_counter: "Run Put on shades on a news article for real signals.",
      alternative_perspective: "Real analysis names specific rhetorical techniques.",
      suggested_rephrase: "(demo)",
    },
    {
      id: "demo_2",
      span_text: "and",
      bias_type: "omission_framing",
      severity: 2,
      confidence: 0.4,
      concise_explanation: "Second demo marker for multi-highlight navigation.",
      detailed_explanation:
        "Use Alt+[ and Alt+] to jump between demo signals, then open the side panel.",
      evidence_or_counter: "No evidence — demo only.",
      alternative_perspective: "Switch to a real article analysis.",
    },
    {
      id: "demo_3",
      span_text: "to",
      bias_type: "sensationalism",
      severity: 3,
      confidence: 0.45,
      concise_explanation: "Third demo signal for severity color check.",
      detailed_explanation:
        "Severity 3 demo instance. Live detection uses the full taxonomy and Grok or heuristics.",
      evidence_or_counter: "Primary sources beat secondary spin.",
      alternative_perspective: "Prefer measurable claims with dates and sources.",
    },
  ],
  notes: [
    "Demo payload for UX testing. Click Put on shades for real page analysis.",
  ],
};

/** Build a page-aware demo by attaching common English tokens from extract text */
export function buildPageDemoAnalysis(input: {
  url: string;
  title: string;
  text: string;
  contentHash: string;
}): BiasAnalysis {
  const words = input.text
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'-]/g, ""))
    .filter((w) => w.length >= 5);
  const unique: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (unique.some((u) => u.toLowerCase() === lower)) continue;
    unique.push(w);
    if (unique.length >= 6) break;
  }
  const samples =
    unique.length >= 2
      ? unique
      : ["the", "and", "that", "with", "from", "this"];

  const types = [
    "loaded_language",
    "omission_framing",
    "sensationalism",
    "unsubstantiated_claim",
    "source_selection",
    "appeal_to_emotion",
  ] as const;

  return {
    version: 1,
    url: input.url,
    title: input.title || "Demo analysis",
    analyzed_at: new Date().toISOString(),
    content_hash: input.contentHash || "demo",
    source: "demo",
    summary: {
      neutrality_score: 70,
      content_type: "unknown",
      top_patterns: ["demo highlights on real page words"],
      recommended_sources_or_searches: [
        "primary documents",
        "official statistics",
      ],
      overview:
        "Demo mode highlighted real words from this page so you can exercise tooltips, navigation, and the side panel. This is not a bias judgment.",
      caveats: ["Demo mode — not a real bias analysis"],
    },
    instances: samples.slice(0, 5).map((span, i) => ({
      id: `demo_page_${i}`,
      span_text: span,
      bias_type: types[i % types.length]!,
      severity: ([2, 3, 4, 3, 2] as const)[i % 5]!,
      confidence: 0.42,
      concise_explanation: `Demo highlight on “${span}” — exercise the UI only.`,
      detailed_explanation:
        "This instance exists so highlights bind to text on the current page. Run a real scan for technique-level analysis.",
      evidence_or_counter: "Use Put on shades (not Demo) for detection.",
      alternative_perspective: "Real mode surfaces framing with explanations.",
    })),
    notes: ["Page-aware demo for live UX testing."],
  };
}
