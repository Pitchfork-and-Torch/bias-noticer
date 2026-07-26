/**
 * Gold-example suite for technique detection regression.
 * Mild + strong positives per technique family + clean-prose negatives.
 * Used by scripts/validate-gold.mjs (logic mirrored) and unit-style imports.
 */

import type { BiasType, PageExtract } from "./types";
import { runHeuristicAnalysis } from "./heuristics";

export type GoldKind = "mild" | "strong" | "clean";

export interface GoldExample {
  id: string;
  kind: GoldKind;
  /** Expected primary technique, or null for clean negatives */
  expect: BiasType | null;
  text: string;
  /** Optional note for humans */
  note?: string;
}

/** Representative gold bank — directionally mixed, techniques only */
export const GOLD_EXAMPLES: GoldExample[] = [
  {
    id: "loaded_mild",
    kind: "mild",
    expect: "loaded_language",
    text: "Critics slammed the proposal after the committee vote late Tuesday.",
  },
  {
    id: "loaded_strong",
    kind: "strong",
    expect: "loaded_language",
    text: "The radical elites and their woke mob annihilated common sense in an explosive bombshell hearing.",
  },
  {
    id: "false_dichotomy_strong",
    kind: "strong",
    expect: "false_dichotomy",
    text: "Either we pass this emergency bill tonight or our democracy ends tomorrow — there is no middle ground.",
  },
  {
    id: "stats_mild",
    kind: "mild",
    expect: "statistical_cherry_picking",
    text: "Crime skyrocketed to a record high last week, officials said, without longer-term context.",
  },
  {
    id: "whatabout_mild",
    kind: "mild",
    expect: "whataboutism",
    text: "Asked about the deficit, the spokesperson replied: But what about their scandals last year?",
  },
  {
    id: "passive_mild",
    kind: "mild",
    expect: "passive_voice_agency",
    text: "Mistakes were made and civilians were killed in an encounter, the briefing noted.",
  },
  {
    id: "emotion_mild",
    kind: "mild",
    expect: "appeal_to_emotion",
    text: "Think of the children — only a monster would oppose this bill.",
  },
  {
    id: "straw_strong",
    kind: "strong",
    expect: "straw_man",
    text: "They want open borders and chaos — that is their entire platform, the ad claimed.",
  },
  {
    id: "authority_mild",
    kind: "mild",
    expect: "appeal_to_authority",
    text: "Because the CEO said so, the product is proven safe.",
  },
  {
    id: "euphemism_mild",
    kind: "mild",
    expect: "euphemism_dysphemism",
    text: "The company is rightsizing its workforce amid efficiency gains.",
  },
  {
    id: "hasty_mild",
    kind: "mild",
    expect: "hasty_generalization",
    text: "This one viral clip proves the entire profession is corrupt.",
  },
  {
    id: "slope_strong",
    kind: "strong",
    expect: "slippery_slope",
    text: "Allow this modest registry and total tyranny is inevitable.",
  },
  {
    id: "bandwagon_mild",
    kind: "mild",
    expect: "bandwagon",
    text: "Everyone knows this is the only sensible position.",
  },
  {
    id: "poison_mild",
    kind: "mild",
    expect: "poisoning_the_well",
    text: "Before you listen: they are known liars in the pocket of Big X.",
  },
  {
    id: "sensational_mild",
    kind: "mild",
    expect: "sensationalism",
    text: "Chaos erupts as the nation plunges into catastrophe after the announcement.",
  },
  {
    id: "unsub_mild",
    kind: "mild",
    expect: "unsubstantiated_claim",
    text: "It is undeniable that the policy has failed completely.",
  },
  {
    id: "adhom_mild",
    kind: "mild",
    expect: "ad_hominem",
    text: "Only a fool or a paid shill would believe that argument, the host said.",
  },
  // Clean negatives — careful prose must not be punished
  {
    id: "clean_stats",
    kind: "clean",
    expect: null,
    text: "The bureau released seasonally adjusted employment figures for March, with confidence intervals in the notes.",
    note: "Plain statistical reporting with adjustment and uncertainty.",
  },
  {
    id: "clean_attribution",
    kind: "clean",
    expect: null,
    text: "According to the court docket filed Monday, the plaintiff alleges breach of contract. The defendant denies the claim.",
    note: "Attributed legal claims; not technique spam.",
  },
  {
    id: "clean_vivid",
    kind: "clean",
    expect: null,
    text: "Rain fell steadily on the slate roof as the ferry pulled into the harbor at dusk.",
    note: "Vivid accurate prose is not bias.",
  },
];

function fakeExtract(text: string): PageExtract {
  return {
    url: "https://example.test/gold",
    title: "Gold example",
    text,
    contentHash: `gold_${text.length}`,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    isLikelyNews: true,
    possiblyPaywalled: false,
  };
}

export interface GoldRunResult {
  id: string;
  kind: GoldKind;
  expect: BiasType | null;
  hit: boolean;
  detectedTypes: BiasType[];
  note?: string;
}

/**
 * Run gold examples against local heuristics.
 * Positives: expect type among detected (or related high-precision hit).
 * Cleans: zero instances preferred; allow at most 0 for pass.
 */
export function runGoldHeuristicSuite(): {
  results: GoldRunResult[];
  passed: number;
  failed: number;
  total: number;
} {
  const results: GoldRunResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const g of GOLD_EXAMPLES) {
    const analysis = runHeuristicAnalysis(fakeExtract(g.text));
    const types = analysis.instances.map((i) => i.bias_type);
    let hit = false;
    if (g.kind === "clean") {
      hit = analysis.instances.length === 0;
    } else if (g.expect) {
      hit = types.includes(g.expect);
    }
    if (hit) passed += 1;
    else failed += 1;
    results.push({
      id: g.id,
      kind: g.kind,
      expect: g.expect,
      hit,
      detectedTypes: types,
      note: g.note,
    });
  }

  return {
    results,
    passed,
    failed,
    total: GOLD_EXAMPLES.length,
  };
}
