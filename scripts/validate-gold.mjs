/**
 * Gold-example smoke tests for heuristic detection.
 * Run: node scripts/validate-gold.mjs
 *
 * Mirrors lib/gold-examples.ts expectations against lib/heuristics patterns
 * without requiring a full TypeScript build.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// Minimal rule set check: heuristics file contains key patterns
const heuristics = readFileSync(join(root, "lib/heuristics.ts"), "utf8");
const goldSrc = readFileSync(join(root, "lib/gold-examples.ts"), "utf8");
const multiPass = readFileSync(join(root, "lib/multi-pass.ts"), "utf8");
const prompt = readFileSync(join(root, "lib/prompt.ts"), "utf8");
const grades = readFileSync(join(root, "lib/grades.ts"), "utf8");
const academy = readFileSync(join(root, "lib/academy.ts"), "utf8");

assert(goldSrc.includes("GOLD_EXAMPLES"), "gold-examples exports bank");
assert(goldSrc.includes("clean_stats"), "clean negative present");
assert(goldSrc.includes("loaded_strong"), "strong loaded language present");
assert(heuristics.includes("loaded_language"), "heuristics has loaded_language");
assert(heuristics.includes("appeal_to_authority"), "heuristics has appeal_to_authority");
assert(heuristics.includes("hasty_generalization"), "heuristics has hasty_generalization");
assert(heuristics.includes("origin_pass"), "heuristics tags origin_pass");
assert(multiPass.includes("mergeVerification"), "multi-pass mergeVerification");
assert(multiPass.includes("finalizeAnalysis"), "multi-pass finalizeAnalysis");
assert(prompt.includes('PROMPT_VERSION = "2.0.0"'), "prompt v2.0.0");
assert(prompt.includes("VERIFY_SYSTEM_PROMPT"), "verify prompt present");
assert(prompt.includes("CONTEXT_SYSTEM_PROMPT"), "context prompt present");
assert(grades.includes("computeCalibratedNeutrality"), "calibrated neutrality");
assert(grades.includes("displayNeutrality"), "displayNeutrality helper");
assert(grades.includes("finiteNeutrality"), "finiteNeutrality (0 is a real score)");
assert(
  !grades.includes("Number(modelScore) || 50"),
  "model 0 must not collapse to 50"
);
const apiSrc = readFileSync(join(root, "lib/api.ts"), "utf8");
assert(apiSrc.includes("finiteNeutrality"), "Grok parse uses finiteNeutrality");
assert(
  !apiSrc.includes("Number(summaryRaw.neutrality_score) || 50"),
  "Grok parse must not collapse model 0 to 50"
);
const gradeCard = readFileSync(join(root, "lib/grade-card.ts"), "utf8");
assert(gradeCard.includes("analysisToGradeCardModel"), "grade-card model builder");
assert(gradeCard.includes("gradeCardModelIsShareSafe"), "grade-card share-safe guard");
assert(!gradeCard.includes("fetch("), "grade-card stays offline");
assert(academy.includes("pickAdaptiveDrill"), "academy adaptive drills");
assert(academy.includes("updateMastery"), "academy mastery tracking");
assert(academy.includes("drillsFromLiveInstances"), "live scan drills");

// Structure + calibration modules exist
const structure = readFileSync(join(root, "lib/structure.ts"), "utf8");
const calibration = readFileSync(join(root, "lib/calibration.ts"), "utf8");
const compare = readFileSync(join(root, "lib/compare.ts"), "utf8");
assert(structure.includes("extractStructure"), "structure pass");
assert(calibration.includes("applyFeedbackToCalibration"), "calibration feedback");
const background = readFileSync(join(root, "entrypoints/background.ts"), "utf8");
assert(
  background.includes("neutrality: displayNeutrality(analysis.summary)"),
  "scoreboards persist calibrated display score"
);
assert(
  !background.includes("neutrality: analysis.summary.neutrality_score"),
  "scoreboards no longer persist raw model score"
);
assert(
  background.includes("async function enrichHeuristic"),
  "heuristic path applies calibration then finalize"
);
assert(calibration.includes("nudgeFromFeedbackKind"), "pure calibration nudge");
assert(calibration.includes("CALIBRATION_BASE_FLOOR"), "calibration base floor");
assert(compare.includes("compareAnalyses"), "comparison mode");
const mediaDiet = readFileSync(join(root, "lib/media-diet.ts"), "utf8");
assert(mediaDiet.includes("export function countTypes"), "media-diet countTypes exported");
assert(
  /signals && s\.signals\.length > 0/.test(mediaDiet) ||
    /s\.signals\?\.length/.test(mediaDiet),
  "media-diet prefers signals over topTypes (no double-count)"
);
assert(
  !/for \(const t of s\.topTypes[\s\S]*?for \(const sig of s\.signals/.test(mediaDiet),
  "media-diet does not walk topTypes and signals in one pass"
);

// Inline heuristic gold checks (subset of RULES patterns)
const RULES = [
  {
    type: "loaded_language",
    pattern:
      /\b(slammed|destroyed|annihilated|shamed|explosive|bombshell|shocking|outrageous|radical|extreme|elites?|sheeple|woke mob|deep state)\b/i,
  },
  {
    type: "false_dichotomy",
    pattern:
      /\b(either we .+ or we|there are only two options|you're either .+ or|no middle ground)\b/i,
  },
  {
    type: "statistical_cherry_picking",
    pattern:
      /\b(record high|skyrocketed|plummeted|unprecedented|soared \d+%|dropped \d+%)\b/i,
  },
  {
    type: "whataboutism",
    pattern:
      /\b(what about|but what about|and yet they|hypocri(sy|tical)|both sides always)\b/i,
  },
];

const positives = [
  {
    id: "loaded",
    type: "loaded_language",
    text: "Critics slammed the radical power grab as pure tyranny.",
  },
  {
    id: "dichotomy",
    type: "false_dichotomy",
    text: "Either we pass this emergency bill tonight or our democracy ends - there is no middle ground.",
  },
  {
    id: "stats",
    type: "statistical_cherry_picking",
    text: "Crime skyrocketed to a record high last week.",
  },
  {
    id: "whatabout",
    type: "whataboutism",
    text: "But what about their scandals last year?",
  },
];

for (const p of positives) {
  const rule = RULES.find((r) => r.type === p.type);
  assert(rule && rule.pattern.test(p.text), `positive hit: ${p.id}`);
}

const cleans = [
  "The bureau released seasonally adjusted employment figures for March, with confidence intervals in the notes.",
  "Rain fell steadily on the slate roof as the ferry pulled into the harbor at dusk.",
  "According to the court docket filed Monday, the plaintiff alleges breach of contract.",
];

for (const text of cleans) {
  const any = RULES.some((r) => r.pattern.test(text));
  assert(!any, `clean prose not overflagged by core rules: "${text.slice(0, 40)}..."`);
}

if (failed) {
  console.error(`\n${failed} gold assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll gold / next-gen smoke checks passed.");
