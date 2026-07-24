/**
 * Technique Academy — interactive media-literacy lessons (local-only).
 *
 * Builds on taxonomy definitions. Progress lives in chrome.storage.local.
 * No network, no scoring of political identity — techniques only.
 */

import type { BiasType } from "./types";
import { ALL_BIAS_TYPES, BIAS_TAXONOMY, getCategoryMeta } from "./taxonomy";

export type AcademyMode = "lessons" | "drill" | "live" | "glossary";

export interface AcademyLesson {
  id: string;
  type: BiasType;
  title: string;
  definition: string;
  whyItMatters: string;
  howToSpot: string[];
  mildExample: string;
  strongExample: string;
  counterMove: string;
  hex: string;
  icon: string;
}

export interface DrillQuestion {
  id: string;
  /** Passage the learner evaluates */
  passage: string;
  /** Correct technique (or null when clean) */
  answer: BiasType | "none";
  /** Distractors + correct; shuffled at render time */
  options: Array<BiasType | "none">;
  explanation: string;
  difficulty: "easy" | "medium";
}

/** Per-technique mastery 0–100 + spaced-repetition scheduling */
export interface TechniqueMastery {
  type: BiasType;
  /** 0–100 mastery score */
  score: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  correct: number;
  attempts: number;
  /** ISO date when next review is due */
  nextReviewAt?: string;
  lastSeenAt?: string;
  /** Badge earned when level >= 3 */
  badge?: "novice" | "adept" | "master";
}

export interface AcademyProgress {
  /** Lesson ids marked complete */
  completedLessons: string[];
  /** Drill question ids answered correctly at least once */
  correctDrills: string[];
  /** Total drill attempts (local stats only) */
  drillAttempts: number;
  drillCorrect: number;
  lastLessonId?: string;
  updatedAt: string;
  /** Consecutive days with at least one drill (local) */
  streakDays?: number;
  lastDrillDay?: string;
  /** Mastery by technique */
  mastery?: Partial<Record<BiasType, TechniqueMastery>>;
  /** Live spot-the-technique correct marks */
  liveCorrect?: number;
  liveAttempts?: number;
}

const PROGRESS_KEY = "bn_academy_progress";

const WHY: Partial<Record<BiasType, string>> = {
  loaded_language:
    "Word choice can smuggle judgment into “just the facts” reporting without the reader noticing the tilt.",
  omission_framing:
    "What is left out or ordered first often steers conclusions more than any single adjective.",
  false_equivalence:
    "Equal airtime can look fair while equating unequal evidence, harm, or responsibility.",
  unsubstantiated_claim:
    "Certainty language can outrun the sourcing on the page — readers fill the gap with trust.",
  sensationalism:
    "Heat sells attention. It also inflates stakes and can crowd out base rates and timelines.",
  source_selection:
    "Who gets a mic shapes the story. Silence can be as persuasive as a quote.",
  statistical_cherry_picking:
    "A true number with the wrong window or denominator is still a misleading story.",
  whataboutism:
    "Comparisons can be valid — or a dodge. The test is whether the original claim is answered.",
  appeal_to_emotion:
    "Human impact belongs in journalism; it becomes technique when feeling replaces substantiation.",
  ad_hominem:
    "Attacking the speaker short-circuits evaluation of the claim’s evidence.",
  straw_man:
    "Misstating an opponent makes rebuttal easy and understanding hard.",
  false_dichotomy:
    "Binary frames erase trade-offs and third paths that careful policy work usually has.",
  appeal_to_authority:
    "Status is not a substitute for transparent methods, data, or accountability.",
  passive_voice_agency:
    "Who acted matters in accountability stories. Voice can hide or spotlight agents.",
  euphemism_dysphemism:
    "Soft or harsh labels for the same event re-label morality without new facts.",
  hasty_generalization:
    "Anecdotes travel faster than samples. Broad claims need representative evidence.",
  slippery_slope:
    "Cascades need a causal chain. Inevitability claims often skip the middle steps.",
  bandwagon:
    "Popularity is social information — not proof of truth or justice.",
  poisoning_the_well:
    "Pre-discrediting a source invites discounting evidence before it is heard.",
  selective_quotation:
    "A quote cut from conditions or context can reverse the speaker’s meaning.",
};

const HOW_TO_SPOT: Partial<Record<BiasType, string[]>> = {
  loaded_language: [
    "Swap the charged word for a plain synonym — does the claim still hold?",
    "Ask whether a court filing or wire service would use the same verb.",
  ],
  omission_framing: [
    "List stakeholders who never appear.",
    "Check whether counter-evidence is delayed until the last graf.",
  ],
  false_equivalence: [
    "Compare evidence quality, not just “both sides spoke.”",
    "Ask if harms or powers are similar in scale.",
  ],
  unsubstantiated_claim: [
    "Find the named source or dataset for each strong assertion.",
    "Watch for “clearly,” “undeniably,” and anonymous consensus.",
  ],
  sensationalism: [
    "Match drama words to measurable scale.",
    "Prefer timelines and official stats over crisis metaphors.",
  ],
  source_selection: [
    "Count perspectives quoted vs. available.",
    "Note when only allies of one institution speak.",
  ],
  statistical_cherry_picking: [
    "Demand timeframe, base rate, and absolute levels.",
    "Check whether “record” means short window noise.",
  ],
  whataboutism: [
    "Separate: was claim A answered before comparison B?",
    "Shared metrics make fair comparisons; vibes do not.",
  ],
  appeal_to_emotion: [
    "Keep the human detail; still require causes and rates.",
    "Watch for instructions on how you must feel.",
  ],
  ad_hominem: [
    "Strip the insult — does the argument still get addressed?",
  ],
  straw_man: [
    "Find the strongest version of the opposing view (steelman).",
  ],
  false_dichotomy: [
    "Invent a third option; if easy, the binary was fake.",
  ],
  appeal_to_authority: [
    "Ask for methods, not titles.",
  ],
  passive_voice_agency: [
    "Rewrite with named actors when known.",
  ],
  euphemism_dysphemism: [
    "Translate both labels into the same plain description.",
  ],
  hasty_generalization: [
    "Ask: sample size? selection? base rate?",
  ],
  slippery_slope: [
    "List each required step; demand evidence for the chain.",
  ],
  bandwagon: [
    "Separate “many believe” from “evidence shows.”",
  ],
  poisoning_the_well: [
    "Evaluate funding claims, then still test the data.",
  ],
  selective_quotation: [
    "Seek full remarks or transcript when stakes are high.",
  ],
};

const COUNTER: Partial<Record<BiasType, string>> = {
  loaded_language: "Name the action with a plainer verb; keep factual modifiers only.",
  omission_framing: "Explicitly list missing stakeholders and delayed facts.",
  false_equivalence: "State asymmetries of evidence or power up front.",
  unsubstantiated_claim: "Attribute, qualify, or cut the claim.",
  sensationalism: "Scale language to data; drop catastrophe metaphors without metrics.",
  source_selection: "Add the best contrary expert or primary document.",
  statistical_cherry_picking: "Show the longer series and denominators.",
  whataboutism: "Answer the original claim first; compare only with shared measures.",
  appeal_to_emotion: "Keep impact; pair with causes and rates.",
  ad_hominem: "Engage the argument’s evidence chain.",
  straw_man: "Quote the opponent’s strongest formulation.",
  false_dichotomy: "Name intermediate options and trade-offs.",
  appeal_to_authority: "Cite methods and data, not status alone.",
  passive_voice_agency: "Who did what to whom — when known.",
  euphemism_dysphemism: "Use consistent plain language for the event.",
  hasty_generalization: "Limit the claim to the sample you have.",
  slippery_slope: "Argue each causal step or drop inevitability.",
  bandwagon: "Replace popularity with independent evidence.",
  poisoning_the_well: "Disclose interests without pre-empting all evidence.",
  selective_quotation: "Include conditions and surrounding sentences.",
};

export function buildLessons(): AcademyLesson[] {
  return ALL_BIAS_TYPES.map((type) => {
    const m = BIAS_TAXONOMY[type];
    return {
      id: `lesson_${type}`,
      type,
      title: m.label,
      definition: m.shortDefinition,
      whyItMatters:
        WHY[type] ||
        "Noticing the technique keeps the focus on craft, not on which tribe “wins.”",
      howToSpot: HOW_TO_SPOT[type] || [
        "Name the move in plain language.",
        "Ask what a more careful framing would include.",
      ],
      mildExample: m.examples[0],
      strongExample: m.examples[1],
      counterMove:
        COUNTER[type] || "Ground the passage in sources, scale, and alternatives.",
      hex: m.hex,
      icon: m.icon,
    };
  });
}

/** Hand-authored drills — directionally mixed examples, techniques only. */
export function buildDrillBank(): DrillQuestion[] {
  const q: Array<Omit<DrillQuestion, "options"> & { options?: DrillQuestion["options"] }> = [
    {
      id: "d1",
      passage:
        "Critics slammed the radical power grab as pure tyranny after the committee vote.",
      answer: "loaded_language",
      explanation:
        "“Slammed,” “radical,” “power grab,” and “tyranny” stack judgment beyond a neutral description of a vote.",
      difficulty: "easy",
    },
    {
      id: "d2",
      passage:
        "Either we pass this emergency bill tonight or our democracy ends tomorrow.",
      answer: "false_dichotomy",
      explanation:
        "A binary of “pass tonight or democracy ends” erases delay, amendment, and other legal paths.",
      difficulty: "easy",
    },
    {
      id: "d3",
      passage:
        "Crime skyrocketed to a record high last week, officials said — without longer-term context.",
      answer: "statistical_cherry_picking",
      explanation:
        "A single-week “record” without base rates or multi-year series is classic cherry-picking risk.",
      difficulty: "easy",
    },
    {
      id: "d4",
      passage:
        "Asked about the deficit, the spokesperson replied: But what about their scandals last year?",
      answer: "whataboutism",
      explanation:
        "The response deflects to another issue instead of addressing the deficit claim.",
      difficulty: "easy",
    },
    {
      id: "d5",
      passage:
        "Mistakes were made and civilians were killed in an encounter, the briefing noted.",
      answer: "passive_voice_agency",
      explanation:
        "Passive constructions obscure who made mistakes and who killed whom.",
      difficulty: "medium",
    },
    {
      id: "d6",
      passage:
        "Think of the children — only a monster would oppose this bill.",
      answer: "appeal_to_emotion",
      explanation:
        "The line instructs moral panic and insults opponents rather than weighing the bill’s trade-offs.",
      difficulty: "easy",
    },
    {
      id: "d7",
      passage:
        "They want open borders and chaos — that is their entire platform, the ad claimed.",
      answer: "straw_man",
      explanation:
        "Collapsing a complex position into “open borders and chaos” misrepresents for easy attack.",
      difficulty: "medium",
    },
    {
      id: "d8",
      passage:
        "Because the CEO said so, the product is proven safe.",
      answer: "appeal_to_authority",
      explanation:
        "Status substitutes for methods, trials, or independent data.",
      difficulty: "easy",
    },
    {
      id: "d9",
      passage:
        "The company is rightsizing its workforce amid efficiency gains.",
      answer: "euphemism_dysphemism",
      explanation:
        "“Rightsizing” softens layoffs; the underlying event is job cuts.",
      difficulty: "medium",
    },
    {
      id: "d10",
      passage:
        "This one viral clip proves the entire profession is corrupt.",
      answer: "hasty_generalization",
      explanation:
        "A single clip cannot establish a profession-wide claim.",
      difficulty: "easy",
    },
    {
      id: "d11",
      passage:
        "Allow this modest registry and total tyranny is inevitable.",
      answer: "slippery_slope",
      explanation:
        "The cascade to “total tyranny” asserts inevitability without intermediate evidence.",
      difficulty: "medium",
    },
    {
      id: "d12",
      passage:
        "Everyone knows this is the only sensible position.",
      answer: "bandwagon",
      explanation:
        "Consensus pressure replaces independent justification.",
      difficulty: "easy",
    },
    {
      id: "d13",
      passage:
        "Before you listen: they are liars in the pocket of Big X.",
      answer: "poisoning_the_well",
      explanation:
        "Pre-emptive character attack invites discounting later evidence wholesale.",
      difficulty: "medium",
    },
    {
      id: "d14",
      passage:
        "The quote “I support it” was cut from “I support it only if conditions A–C are met.”",
      answer: "selective_quotation",
      explanation:
        "Dropping conditions reverses the speaker’s actual stance.",
      difficulty: "medium",
    },
    {
      id: "d15",
      passage:
        "Only allies of the agency were interviewed about its misconduct probe.",
      answer: "source_selection",
      explanation:
        "Choosing only friendly voices tilts the investigation narrative.",
      difficulty: "medium",
    },
    {
      id: "d16",
      passage:
        "It is undeniable that the policy has failed completely.",
      answer: "unsubstantiated_claim",
      explanation:
        "Absolute certainty without evidence in the text is a classic unsubstantiated move.",
      difficulty: "easy",
    },
    {
      id: "d17",
      passage:
        "Chaos erupts as the nation plunges into catastrophe after the announcement.",
      answer: "sensationalism",
      explanation:
        "Catastrophe language maximizes heat; check whether scale matches evidence.",
      difficulty: "easy",
    },
    {
      id: "d18",
      passage:
        "Equating a clerical error with systemic fraud as equally serious, the column argued.",
      answer: "false_equivalence",
      explanation:
        "Unequal harms/evidence are treated as the same weight.",
      difficulty: "medium",
    },
    {
      id: "d19",
      passage:
        "The report, funded by industry, was dismissed before its methods were examined.",
      answer: "poisoning_the_well",
      explanation:
        "Funding can be relevant disclosure — pre-dismissal without methods is well-poisoning.",
      difficulty: "medium",
    },
    {
      id: "d20",
      passage:
        "The bureau released seasonally adjusted employment figures for March, with confidence intervals in the notes.",
      answer: "none",
      explanation:
        "Plain statistical reporting with adjustment and uncertainty is not itself a bias technique.",
      difficulty: "medium",
    },
    {
      id: "d21",
      passage:
        "Coverage led with protest disruption; the policy substance appeared in the final paragraphs.",
      answer: "omission_framing",
      explanation:
        "Ordering and emphasis shape the frame even when facts are present later.",
      difficulty: "medium",
    },
    {
      id: "d22",
      passage:
        "Only a fool or a paid shill would believe that argument, the host said.",
      answer: "ad_hominem",
      explanation:
        "Insults replace engagement with the argument’s content.",
      difficulty: "easy",
    },
  ];

  // Stable distractors (deterministic) — UI may reshuffle for variety
  const DISTRACTOR_SETS: Array<Array<BiasType | "none">> = [
    ["loaded_language", "sensationalism", "none"],
    ["false_dichotomy", "straw_man", "whataboutism"],
    ["statistical_cherry_picking", "unsubstantiated_claim", "bandwagon"],
    ["passive_voice_agency", "omission_framing", "source_selection"],
    ["appeal_to_emotion", "ad_hominem", "poisoning_the_well"],
    ["euphemism_dysphemism", "selective_quotation", "appeal_to_authority"],
    ["hasty_generalization", "slippery_slope", "false_equivalence"],
  ];

  return q.map((item, i) => {
    const correct = item.answer;
    const raw = DISTRACTOR_SETS[i % DISTRACTOR_SETS.length]!;
    const distractors = raw.filter((x) => x !== correct).slice(0, 3);
    // Ensure 4 unique options
    const options: Array<BiasType | "none"> = [correct];
    for (const d of distractors) {
      if (!options.includes(d)) options.push(d);
    }
    while (options.length < 4) {
      const filler: BiasType | "none" =
        options.includes("none") ? "loaded_language" : "none";
      if (!options.includes(filler)) options.push(filler);
      else break;
    }
    return {
      id: item.id,
      passage: item.passage,
      answer: item.answer,
      options,
      explanation: item.explanation,
      difficulty: item.difficulty,
    };
  });
}

/** Fisher–Yates shuffle copy (call in UI for variety). */
export function shuffleOptions<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function emptyProgress(): AcademyProgress {
  return {
    completedLessons: [],
    correctDrills: [],
    drillAttempts: 0,
    drillCorrect: 0,
    streakDays: 0,
    mastery: {},
    liveCorrect: 0,
    liveAttempts: 0,
    updatedAt: new Date().toISOString(),
  };
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function masteryLevel(score: number): TechniqueMastery["level"] {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

function badgeFor(level: number): TechniqueMastery["badge"] | undefined {
  if (level >= 5) return "master";
  if (level >= 3) return "adept";
  if (level >= 1) return "novice";
  return undefined;
}

/** Spaced intervals (days) by level after a correct answer */
const SRS_DAYS = [0, 1, 2, 4, 7, 14];

export function updateMastery(
  progress: AcademyProgress,
  type: BiasType | "none",
  correct: boolean
): AcademyProgress {
  if (type === "none") return progress;
  const mastery = { ...(progress.mastery || {}) };
  const prev: TechniqueMastery = mastery[type] || {
    type,
    score: 0,
    level: 0,
    correct: 0,
    attempts: 0,
  };
  const attempts = prev.attempts + 1;
  const correctN = prev.correct + (correct ? 1 : 0);
  // Elo-ish: +12 correct, -7 wrong, clamped
  let score = prev.score + (correct ? 12 : -7);
  score = Math.max(0, Math.min(100, score));
  const level = masteryLevel(score);
  const nextDays = correct ? SRS_DAYS[level] ?? 7 : 1;
  const next = new Date();
  next.setDate(next.getDate() + nextDays);
  mastery[type] = {
    type,
    score,
    level,
    correct: correctN,
    attempts,
    nextReviewAt: next.toISOString(),
    lastSeenAt: new Date().toISOString(),
    badge: badgeFor(level),
  };
  return { ...progress, mastery };
}

export function touchStreak(progress: AcademyProgress): AcademyProgress {
  const today = dayKey();
  if (progress.lastDrillDay === today) return progress;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const streak =
    progress.lastDrillDay === yesterday
      ? (progress.streakDays || 0) + 1
      : 1;
  return {
    ...progress,
    streakDays: streak,
    lastDrillDay: today,
  };
}

/**
 * Adaptive drill pick: prefer weak techniques + due SRS + optional live types.
 */
export function pickAdaptiveDrill(
  bank: DrillQuestion[],
  progress: AcademyProgress,
  preferTypes?: BiasType[]
): DrillQuestion | null {
  if (!bank.length) return null;
  const mastery = progress.mastery || {};
  const now = Date.now();

  const scored = bank.map((q) => {
    let weight = 1;
    if (q.answer === "none") {
      weight = 0.8;
    } else {
      const m = mastery[q.answer];
      if (!m) weight = 2.5;
      else {
        weight = 1 + (100 - m.score) / 40;
        if (m.nextReviewAt && new Date(m.nextReviewAt).getTime() <= now) {
          weight += 1.5;
        }
      }
      if (preferTypes?.includes(q.answer)) weight += 2;
    }
    // Slightly prefer unanswered
    if (!progress.correctDrills.includes(q.id)) weight += 0.5;
    return { q, weight };
  });

  const total = scored.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const item of scored) {
    r -= item.weight;
    if (r <= 0) return item.q;
  }
  return scored[scored.length - 1]?.q ?? bank[0]!;
}

/** Build extra drills from recent live scan instances (user's own reading). */
export function drillsFromLiveInstances(
  instances: Array<{
    id: string;
    span_text: string;
    bias_type: BiasType;
    concise_explanation: string;
  }>
): DrillQuestion[] {
  return instances.slice(0, 12).map((inst, i) => {
    const distractors = ALL_BIAS_TYPES.filter((t) => t !== inst.bias_type).slice(
      0,
      3
    );
    return {
      id: `live_${inst.id}_${i}`,
      passage: inst.span_text.slice(0, 280),
      answer: inst.bias_type,
      options: [inst.bias_type, ...distractors].slice(0, 4),
      explanation: inst.concise_explanation,
      difficulty: "medium" as const,
    };
  });
}

export async function loadAcademyProgress(): Promise<AcademyProgress> {
  try {
    const res = await chrome.storage.local.get(PROGRESS_KEY);
    const p = res[PROGRESS_KEY] as AcademyProgress | undefined;
    if (!p || typeof p !== "object") return emptyProgress();
    return {
      ...emptyProgress(),
      ...p,
      completedLessons: Array.isArray(p.completedLessons)
        ? p.completedLessons
        : [],
      correctDrills: Array.isArray(p.correctDrills) ? p.correctDrills : [],
    };
  } catch {
    return emptyProgress();
  }
}

export async function saveAcademyProgress(
  partial: Partial<AcademyProgress>
): Promise<AcademyProgress> {
  const current = await loadAcademyProgress();
  const next: AcademyProgress = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [PROGRESS_KEY]: next });
  return next;
}

export async function markLessonComplete(lessonId: string): Promise<AcademyProgress> {
  const current = await loadAcademyProgress();
  const set = new Set(current.completedLessons);
  set.add(lessonId);
  return saveAcademyProgress({
    completedLessons: [...set],
    lastLessonId: lessonId,
  });
}

export async function recordDrillAnswer(
  questionId: string,
  correct: boolean,
  answerType?: BiasType | "none"
): Promise<AcademyProgress> {
  const current = await loadAcademyProgress();
  const correctDrills = new Set(current.correctDrills);
  if (correct) correctDrills.add(questionId);
  let next: AcademyProgress = {
    ...current,
    drillAttempts: current.drillAttempts + 1,
    drillCorrect: current.drillCorrect + (correct ? 1 : 0),
    correctDrills: [...correctDrills],
  };
  next = touchStreak(next);
  if (answerType) {
    next = updateMastery(next, answerType, correct);
  }
  return saveAcademyProgress(next);
}

export async function recordLiveSpot(
  type: BiasType,
  correct: boolean
): Promise<AcademyProgress> {
  const current = await loadAcademyProgress();
  let next: AcademyProgress = {
    ...current,
    liveAttempts: (current.liveAttempts || 0) + 1,
    liveCorrect: (current.liveCorrect || 0) + (correct ? 1 : 0),
  };
  next = touchStreak(next);
  next = updateMastery(next, type, correct);
  return saveAcademyProgress(next);
}

export function optionLabel(opt: BiasType | "none"): string {
  if (opt === "none") return "No clear technique (careful prose)";
  return getCategoryMeta(opt).label;
}

export function academyStats(progress: AcademyProgress, lessonCount: number) {
  const lessonsDone = progress.completedLessons.length;
  const drillRate =
    progress.drillAttempts > 0
      ? Math.round((progress.drillCorrect / progress.drillAttempts) * 100)
      : null;
  const masteryValues = Object.values(progress.mastery || {}).filter(Boolean);
  const mastered = masteryValues.filter((m) => (m?.level || 0) >= 3).length;
  const avgMastery = masteryValues.length
    ? Math.round(
        masteryValues.reduce((s, m) => s + (m?.score || 0), 0) /
          masteryValues.length
      )
    : 0;
  return {
    lessonsDone,
    lessonCount,
    lessonPct: lessonCount
      ? Math.round((lessonsDone / lessonCount) * 100)
      : 0,
    drillAttempts: progress.drillAttempts,
    drillCorrect: progress.drillCorrect,
    drillRate,
    streakDays: progress.streakDays || 0,
    masteredTechniques: mastered,
    avgMastery,
    badges: masteryValues.filter((m) => m?.badge).length,
  };
}
