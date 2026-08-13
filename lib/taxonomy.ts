/**
 * Bias Noticer — Taxonomy metadata
 *
 * Human-readable labels, short definitions, few-shot examples, and colors.
 * Used in tooltips, side panel, options, prompt few-shots, and methodology docs.
 * Politically direction-agnostic by design.
 */

import type { BiasType } from "./types";

export interface BiasCategoryMeta {
  type: BiasType;
  label: string;
  shortDefinition: string;
  /** Tailwind-friendly accent token */
  color: string;
  /** Hex for CSS variables injected into pages */
  hex: string;
  icon: string;
  /** Strength-varied few-shot examples for prompts + glossary (mild, strong) */
  examples: [string, string];
}

export const BIAS_TAXONOMY: Record<BiasType, BiasCategoryMeta> = {
  loaded_language: {
    type: "loaded_language",
    label: "Loaded language",
    shortDefinition:
      "Emotionally charged or judgmental wording that steers interpretation beyond the facts.",
    color: "rose",
    hex: "#f43f5e",
    icon: "⚡",
    examples: [
      'Mild: Officials “clarified” the remarks after backlash.',
      "Strong: Critics slammed the radical power grab as pure tyranny.",
    ],
  },
  omission_framing: {
    type: "omission_framing",
    label: "Omission / framing",
    shortDefinition:
      "What is left out, ordered first, or cast as the default frame shapes the story as much as what is said.",
    color: "violet",
    hex: "#8b5cf6",
    icon: "⬚",
    examples: [
      "Mild: Coverage led with protest disruption; policy substance appeared much later.",
      "Strong: A major conflicting study went unmentioned in a definitive-sounding piece.",
    ],
  },
  false_equivalence: {
    type: "false_equivalence",
    label: "False equivalence",
    shortDefinition:
      "Treating unequal claims, evidence bases, or harms as if they were the same.",
    color: "amber",
    hex: "#f59e0b",
    icon: "≈",
    examples: [
      "Mild: Both parties traded barbs over the hearing.",
      "Strong: Equating a clerical error with systemic fraud as equally serious.",
    ],
  },
  unsubstantiated_claim: {
    type: "unsubstantiated_claim",
    label: "Unsubstantiated claim",
    shortDefinition:
      "A factual assertion presented without adequate sourcing or evidence in the text.",
    color: "orange",
    hex: "#f97316",
    icon: "?",
    examples: [
      "Mild: Sources say the deal is imminent.",
      "Strong: It is undeniable that the policy has failed completely.",
    ],
  },
  sensationalism: {
    type: "sensationalism",
    label: "Sensationalism",
    shortDefinition:
      "Exaggeration, alarm, or hype that prioritizes attention over precision.",
    color: "red",
    hex: "#ef4444",
    icon: "!",
    examples: [
      "Mild: Tensions rose after the announcement.",
      "Strong: Chaos erupts as the nation plunges into catastrophe.",
    ],
  },
  source_selection: {
    type: "source_selection",
    label: "Source / quote selection",
    shortDefinition:
      "Choosing which voices, experts, or quotes appear—and which don’t—tilts the narrative.",
    color: "sky",
    hex: "#0ea5e9",
    icon: "◎",
    examples: [
      "Mild: Three industry analysts praised the plan; no consumer groups quoted.",
      "Strong: Only allies of the agency were interviewed about its misconduct probe.",
    ],
  },
  statistical_cherry_picking: {
    type: "statistical_cherry_picking",
    label: "Statistical cherry-picking",
    shortDefinition:
      "Highlighting a favorable slice of data while ignoring base rates, trends, or uncertainty.",
    color: "cyan",
    hex: "#06b6d4",
    icon: "%",
    examples: [
      "Mild: Cases rose 12% this month (no longer-term trend).",
      "Strong: Crime skyrocketed to a record high — citing a single atypical week.",
    ],
  },
  whataboutism: {
    type: "whataboutism",
    label: "Whataboutism",
    shortDefinition:
      "Deflecting critique by pointing to a different issue instead of addressing the claim.",
    color: "fuchsia",
    hex: "#d946ef",
    icon: "↪",
    examples: [
      "Mild: Opponents asked how the policy compares abroad.",
      "Strong: Instead of answering the deficit claim: But what about their scandals?",
    ],
  },
  appeal_to_emotion: {
    type: "appeal_to_emotion",
    label: "Appeal to emotion",
    shortDefinition:
      "Using fear, pity, anger, or pride as the main persuasive force rather than evidence.",
    color: "pink",
    hex: "#ec4899",
    icon: "♥",
    examples: [
      "Mild: Families described waiting hours for help.",
      "Strong: Think of the children — only a monster would oppose this bill.",
    ],
  },
  ad_hominem: {
    type: "ad_hominem",
    label: "Ad hominem",
    shortDefinition:
      "Attacking the person (or group identity) instead of engaging their argument or evidence.",
    color: "red",
    hex: "#dc2626",
    icon: "⊗",
    examples: [
      "Mild: The senator, a longtime lobby favorite, opposed the bill.",
      "Strong: Only a fool or a paid shill would believe that argument.",
    ],
  },
  straw_man: {
    type: "straw_man",
    label: "Straw man",
    shortDefinition:
      "Misrepresenting an opposing view to make it easier to knock down.",
    color: "lime",
    hex: "#84cc16",
    icon: "Scarecrow",
    examples: [
      "Mild: Critics want zero enforcement, they claim.",
      "Strong: They want open borders and chaos — that is their entire platform.",
    ],
  },
  false_dichotomy: {
    type: "false_dichotomy",
    label: "False dichotomy",
    shortDefinition:
      "Presenting only two options when more exist, forcing a binary choice.",
    color: "yellow",
    hex: "#eab308",
    icon: "2",
    examples: [
      "Mild: Leaders framed the choice as act now or fall behind.",
      "Strong: Either we pass this law or our democracy ends tomorrow.",
    ],
  },
  appeal_to_authority: {
    type: "appeal_to_authority",
    label: "Appeal to authority",
    shortDefinition:
      "Treating a source as decisive because of status, not because of evidence quality.",
    color: "indigo",
    hex: "#6366f1",
    icon: "★",
    examples: [
      "Mild: Experts agree the trend is concerning.",
      "Strong: Because the CEO said so, the product is proven safe.",
    ],
  },
  passive_voice_agency: {
    type: "passive_voice_agency",
    label: "Agency via voice",
    shortDefinition:
      "Passive constructions or vague actors that hide who did what (or spotlight them selectively).",
    color: "slate",
    hex: "#64748b",
    icon: "∅",
    examples: [
      "Mild: Protesters were detained overnight.",
      "Strong: Mistakes were made and civilians were killed in an encounter.",
    ],
  },
  euphemism_dysphemism: {
    type: "euphemism_dysphemism",
    label: "Euphemism / dysphemism",
    shortDefinition:
      "Softening or harshening labels for the same underlying reality.",
    color: "teal",
    hex: "#14b8a6",
    icon: "↔",
    examples: [
      "Mild: The company is rightsizing its workforce.",
      "Strong: Collateral damage vs slaughter — same event, opposite moral framing.",
    ],
  },
  hasty_generalization: {
    type: "hasty_generalization",
    label: "Hasty generalization",
    shortDefinition:
      "Broad conclusions from thin, anecdotal, or unrepresentative evidence.",
    color: "amber",
    hex: "#d97706",
    icon: "↗",
    examples: [
      "Mild: One viral clip shaped the national narrative.",
      "Strong: This proves the entire profession is corrupt.",
    ],
  },
  slippery_slope: {
    type: "slippery_slope",
    label: "Slippery slope",
    shortDefinition:
      "Claiming one step will inevitably cascade into extreme outcomes without chain evidence.",
    color: "orange",
    hex: "#ea580c",
    icon: "↓",
    examples: [
      "Mild: Critics warn modest fees could expand later.",
      "Strong: Allow this registry and total tyranny is inevitable.",
    ],
  },
  bandwagon: {
    type: "bandwagon",
    label: "Bandwagon",
    shortDefinition:
      "Implying something is true or good primarily because many people believe or do it.",
    color: "green",
    hex: "#22c55e",
    icon: "∞",
    examples: [
      "Mild: Growing numbers of cities are adopting the rule.",
      "Strong: Everyone knows this is the only sensible position.",
    ],
  },
  poisoning_the_well: {
    type: "poisoning_the_well",
    label: "Poisoning the well",
    shortDefinition:
      "Pre-emptively discrediting a source so later evidence from them is discounted.",
    color: "stone",
    hex: "#78716c",
    icon: "⚠",
    examples: [
      "Mild: The group, funded by industry, released a report.",
      "Strong: Before you listen: they are liars in the pocket of Big X.",
    ],
  },
  selective_quotation: {
    type: "selective_quotation",
    label: "Selective quotation",
    shortDefinition:
      "Excerpting quotes in a way that changes meaning vs. full context.",
    color: "blue",
    hex: "#3b82f6",
    icon: "“”",
    examples: [
      'Mild: “Not ideal,” she said of a complex plan.',
      'Strong: “I support it” cut from “I support it only if conditions A–C are met.”',
    ],
  },
};

export const ALL_BIAS_TYPES = Object.keys(BIAS_TAXONOMY) as BiasType[];

export function getCategoryMeta(type: BiasType): BiasCategoryMeta {
  return (
    BIAS_TAXONOMY[type] ?? {
      type,
      label: type,
      shortDefinition: "Rhetorical or framing technique.",
      color: "gray",
      hex: "#6b7280",
      icon: "•",
      examples: ["Example unavailable.", "Example unavailable."],
    }
  );
}

/** Severity labels for UI */
export const SEVERITY_LABELS: Record<number, string> = {
  1: "Subtle",
  2: "Mild",
  3: "Moderate",
  4: "Strong",
  5: "Severe",
};

/** Build compact few-shot block for the system prompt */
export function buildTaxonomyFewShots(): string {
  return ALL_BIAS_TYPES.map((t) => {
    const m = BIAS_TAXONOMY[t];
    return `- ${t} (${m.label}): ${m.shortDefinition}
    mild: ${m.examples[0]}
    strong: ${m.examples[1]}`;
  }).join("\n");
}
