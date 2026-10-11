/**
 * Production scoring / calibration / merge tests.
 * Imports lib/*.ts via Node type stripping (no duplicate math).
 *
 * Run: npm run validate:score
 */

import {
  applyContentTypeNeutralityNudge,
  computeCalibratedNeutrality,
  displayNeutrality,
  finiteNeutrality,
  gradeLegend,
  neutralityToGrade,
} from "../lib/grades.ts";
import {
  applyCalibrationToInstances,
  applyFeedbackNudge,
  CALIBRATION_BASE_FLOOR,
  CALIBRATION_MIN_SAMPLES,
  emptyCalibration,
  nudgeFromFeedbackKind,
  typeConfidenceFloor,
} from "../lib/calibration.ts";
import {
  finalizeAnalysis,
  mergeVerification,
  resolveDepth,
} from "../lib/multi-pass.ts";
import { extractStructure } from "../lib/structure.ts";
import { parseAuthorNames, journalistKey, hostFromUrl } from "../lib/site-cache.ts";
import { runGoldHeuristicSuite } from "../lib/gold-examples.ts";
import { countTypes } from "../lib/media-diet.ts";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

function inst(over = {}) {
  return {
    id: over.id || "i1",
    span_text: over.span_text || "the radical power grab",
    bias_type: over.bias_type || "loaded_language",
    severity: over.severity ?? 4,
    confidence: over.confidence ?? 0.8,
    concise_explanation: "loaded wording",
    detailed_explanation: "loaded wording detail",
    evidence_or_counter: "plain verb",
    alternative_perspective: "name the action",
    voice: over.voice || "author",
    verification: over.verification,
    origin_pass: over.origin_pass || "primary",
    ...over,
  };
}

function extract(text, title = "News") {
  return {
    url: "https://example.test/story",
    title,
    text,
    contentHash: "h1",
    wordCount: text.split(/\s+/).filter(Boolean).length,
    isLikelyNews: true,
    possiblyPaywalled: false,
  };
}

function analysisOf(instances, score = 70, contentType = "hard_news") {
  return {
    version: 1,
    url: "https://example.test/story",
    title: "News",
    analyzed_at: "2026-09-17T00:00:00.000Z",
    content_hash: "h1",
    source: "grok",
    summary: {
      neutrality_score: score,
      content_type: contentType,
      top_patterns: [],
      recommended_sources_or_searches: [],
      overview: "test",
      caveats: [],
    },
    instances,
  };
}

// --- finite 0 is a real score ---
assert(finiteNeutrality(0) === 0, "finiteNeutrality keeps 0");
assert(finiteNeutrality(Number.NaN) === 50, "finiteNeutrality NaN -> fallback 50");
assert(finiteNeutrality(undefined) === 50, "finiteNeutrality undefined -> fallback 50");
assert(finiteNeutrality(120) === 100, "finiteNeutrality clamps 120");
assert(finiteNeutrality(-4, 0) === 0, "finiteNeutrality clamps negatives");
assert(finiteNeutrality(0, 50) === 0, "Grok parse fallback keeps model 0");
assert((Number(0) || 50) === 50, "|| 50 is the footgun finiteNeutrality avoids");

const zeroFlag = computeCalibratedNeutrality(
  [inst({ severity: 5, confidence: 0.9, voice: "author" })],
  0
);
const fiftyFlag = computeCalibratedNeutrality(
  [inst({ severity: 5, confidence: 0.9, voice: "author" })],
  50
);
assert(zeroFlag < fiftyFlag, `model 0 must not collapse to 50 (${zeroFlag} vs ${fiftyFlag})`);
assert(zeroFlag < 55, `extreme model 0 + heavy flag stays low (${zeroFlag})`);

const emptyZero = computeCalibratedNeutrality([], 0);
const emptyFifty = computeCalibratedNeutrality([], 50);
assert(emptyZero < emptyFifty, `empty + model 0 (${emptyZero}) < empty + 50 (${emptyFifty})`);

// --- voice / verify weights ---
const authorScore = computeCalibratedNeutrality(
  [inst({ severity: 4, confidence: 0.9, voice: "author" })],
  70
);
const quotedScore = computeCalibratedNeutrality(
  [inst({ severity: 4, confidence: 0.9, voice: "quoted" })],
  70
);
const mixedScore = computeCalibratedNeutrality(
  [inst({ severity: 4, confidence: 0.9, voice: "mixed" })],
  70
);
assert(
  quotedScore > authorScore,
  `quoted voice is less punitive (${quotedScore} > ${authorScore})`
);
assert(
  mixedScore > authorScore && mixedScore < quotedScore,
  `mixed voice between author and quoted (${mixedScore})`
);

const rejectedOnly = computeCalibratedNeutrality(
  [inst({ severity: 5, confidence: 1, verification: "rejected" })],
  80
);
const noInst = computeCalibratedNeutrality([], 80);
assert(
  rejectedOnly >= 85,
  `rejected flags do not add load (${rejectedOnly})`
);
assert(
  Math.abs(rejectedOnly - (100 * 0.55 + 80 * 0.45)) <= 1 || rejectedOnly >= noInst,
  "rejected-only blends toward no-load"
);

const confirmed = computeCalibratedNeutrality(
  [inst({ severity: 4, confidence: 0.9, verification: "confirmed" })],
  70
);
const downgraded = computeCalibratedNeutrality(
  [inst({ severity: 4, confidence: 0.9, verification: "downgraded" })],
  70
);
assert(downgraded > confirmed, `downgraded load is lighter (${downgraded} > ${confirmed})`);

const heavy = computeCalibratedNeutrality(
  [
    inst({ severity: 5, confidence: 0.9 }),
    inst({ id: "i2", severity: 5, confidence: 0.9 }),
    inst({ id: "i3", severity: 4, confidence: 0.85 }),
  ],
  70
);
assert(heavy < 70, `heavy load lowers neutrality (${heavy})`);

const emptyHigh = computeCalibratedNeutrality([], 90);
assert(emptyHigh >= 80, `empty detections stay high (${emptyHigh})`);

// --- display prefers calibrated ---
assert(displayNeutrality({ neutrality_score: 80, calibrated_neutrality: 61 }) === 61, "display prefers calibrated");
assert(displayNeutrality({ neutrality_score: 80 }) === 80, "display falls back to raw");
assert(displayNeutrality({ neutrality_score: 0 }) === 0, "display keeps raw 0");
assert(
  displayNeutrality({ neutrality_score: 80, calibrated_neutrality: Number.NaN }) === 80,
  "display ignores NaN calibrated"
);

// --- letter bands match legend ---
const legend = gradeLegend();
assert(neutralityToGrade(97).grade === "A+", "97 is A+");
assert(neutralityToGrade(96).grade === "A", "96 is A");
assert(neutralityToGrade(90).grade === "A-", "90 is A-");
assert(neutralityToGrade(89).grade === "B+", "89 is B+");
assert(neutralityToGrade(60).grade === "D-", "60 is D-");
assert(neutralityToGrade(59).grade === "F", "59 is F");
assert(neutralityToGrade(0).grade === "F", "0 is F");
assert(legend[0].grade === "A+" && legend[legend.length - 1].grade === "F", "legend spans A+ to F");
assert(neutralityToGrade(85).tone === "good", "B band tone is good");

// --- content-type nudge (not a left/right meter) ---
assert(applyContentTypeNeutralityNudge(80, "satire") === 92, "satire +12");
assert(applyContentTypeNeutralityNudge(80, "opinion") === 86, "opinion +6");
assert(applyContentTypeNeutralityNudge(80, "press_release") === 76, "press release -4");
assert(applyContentTypeNeutralityNudge(80, "academic") === 83, "academic +3");
assert(applyContentTypeNeutralityNudge(80, "hard_news") === 80, "hard news unchanged");
assert(applyContentTypeNeutralityNudge(95, "satire") === 100, "satire nudge caps at 100");
assert(applyContentTypeNeutralityNudge(2, "press_release") === 0, "press nudge floors at 0");

// --- calibration floor can actually drop heuristic hits ---
assert(CALIBRATION_BASE_FLOOR >= 0.45, "base floor sits in heuristic confidence band");
assert(nudgeFromFeedbackKind("helpful").severityBias === 0, "helpful is a no-op nudge");
assert(nudgeFromFeedbackKind("wrong").confidenceFloorDelta > 0, "wrong raises the bar");
assert(nudgeFromFeedbackKind("too_weak").severityBias > 0, "too_weak increases severity");

let cal = emptyCalibration();
let typeCal = {
  type: "loaded_language",
  severityBias: 0,
  confidenceFloorDelta: 0,
  samples: 0,
};
typeCal = applyFeedbackNudge(typeCal, "wrong");
assert(typeCal.samples === 1, "first wrong increments samples");
const afterOne = applyCalibrationToInstances(
  [inst({ confidence: 0.5, severity: 3 })],
  { byType: { loaded_language: typeCal }, totalFeedback: 1, updatedAt: "" },
  true
);
assert(afterOne.length === 1, "single mark does not apply (min samples)");

typeCal = applyFeedbackNudge(typeCal, "wrong");
assert(typeCal.samples === CALIBRATION_MIN_SAMPLES, "two wrongs reach min samples");
cal = {
  byType: { loaded_language: typeCal },
  totalFeedback: 2,
  updatedAt: "",
};
const dropped = applyCalibrationToInstances(
  [inst({ confidence: 0.5, severity: 3, bias_type: "loaded_language" })],
  cal,
  true
);
assert(dropped.length === 0, "two wrongs drop a 0.50 heuristic hit");

const keptHigh = applyCalibrationToInstances(
  [inst({ confidence: 0.9, severity: 3, bias_type: "loaded_language" })],
  cal,
  true
);
assert(keptHigh.length === 1, "high-confidence Grok hit survives two wrongs");

const otherType = applyCalibrationToInstances(
  [inst({ confidence: 0.5, severity: 3, bias_type: "whataboutism" })],
  cal,
  true
);
assert(otherType.length === 1, "calibration is per-type, not global");

let weak = {
  type: "loaded_language",
  severityBias: 0,
  confidenceFloorDelta: 0,
  samples: 0,
};
weak = applyFeedbackNudge(weak, "too_weak");
weak = applyFeedbackNudge(weak, "too_weak");
const afterWeak = applyCalibrationToInstances(
  [inst({ confidence: 0.5, severity: 3 })],
  { byType: { loaded_language: weak }, totalFeedback: 2, updatedAt: "" },
  true
);
assert(afterWeak.length === 1, "too_weak does not drop existing hits");

let manyWrong = {
  type: "loaded_language",
  severityBias: 0,
  confidenceFloorDelta: 0,
  samples: 0,
};
for (let i = 0; i < 40; i++) manyWrong = applyFeedbackNudge(manyWrong, "wrong");
assert(manyWrong.severityBias === -1.5, "severity bias clamps at -1.5");
assert(manyWrong.confidenceFloorDelta === 0.15, "floor delta clamps at +0.15");
assert(typeConfidenceFloor(manyWrong) <= 0.72, "type floor clamps");

const disabled = applyCalibrationToInstances(
  [inst({ confidence: 0.5 })],
  cal,
  false
);
assert(disabled.length === 1, "calibration off returns instances unchanged");

// --- mergeVerification under-flags ---
const structure = extractStructure(
  extract(
    'The mayor said "this is a routine update on the water main." Officials slammed the delay.',
    "City update"
  )
);
const mergedReject = mergeVerification(
  [inst({ span_text: "Officials slammed the delay", bias_type: "loaded_language" })],
  {
    keep: [
      {
        span_text: "Officials slammed the delay",
        bias_type: "loaded_language",
        status: "rejected",
        reason: "plain verb in context",
      },
    ],
  },
  structure
);
assert(mergedReject.length === 0, "rejected verify drops the instance");

const mergedDown = mergeVerification(
  [inst({ span_text: "Officials slammed the delay", severity: 4, confidence: 0.8 })],
  {
    keep: [
      {
        span_text: "Officials slammed the delay",
        bias_type: "loaded_language",
        status: "downgraded",
        reason: "heat is mild",
      },
    ],
  },
  structure
);
assert(mergedDown.length === 1, "downgraded verify keeps the instance");
assert(mergedDown[0].severity === 3, "downgrade subtracts one severity");
assert(mergedDown[0].verification === "downgraded", "downgrade status sticks");

const unmatched = mergeVerification(
  [inst({ span_text: "a unique unmatched span here", bias_type: "omission_framing" })],
  {
    keep: [
      {
        span_text: "some other span",
        bias_type: "loaded_language",
        status: "confirmed",
      },
    ],
  },
  structure
);
assert(unmatched[0].verification === "unverified", "unmatched stays unverified (under-flag, not drop)");

// --- finalize keeps raw, writes calibrated ---
const fin = finalizeAnalysis(analysisOf([inst({ severity: 5, confidence: 0.9 })], 40, "hard_news"), {
  structure,
  depth: "standard",
  passes: ["structure", "primary", "verify"],
});
assert(fin.summary.neutrality_score === 40, "finalize preserves raw model score");
assert(
  typeof fin.summary.calibrated_neutrality === "number",
  "finalize writes calibrated_neutrality"
);
assert(
  displayNeutrality(fin.summary) === fin.summary.calibrated_neutrality,
  "display matches calibrated after finalize"
);

const satireFin = finalizeAnalysis(
  analysisOf([inst({ severity: 3, confidence: 0.6 })], 70, "satire"),
  { structure, depth: "quick", passes: ["structure", "heuristic"] }
);
const newsFin = finalizeAnalysis(
  analysisOf([inst({ severity: 3, confidence: 0.6 })], 70, "hard_news"),
  { structure, depth: "quick", passes: ["structure", "heuristic"] }
);
assert(
  satireFin.summary.calibrated_neutrality > newsFin.summary.calibrated_neutrality,
  "satire is graded less punitively than hard news"
);

assert(resolveDepth(false, "thorough", "thorough") === "quick", "multi-pass off forces quick");
assert(resolveDepth(true, undefined, "thorough") === "thorough", "thorough sensitivity maps to thorough");
assert(resolveDepth(true, undefined, "conservative") === "standard", "conservative maps to standard depth");
assert(resolveDepth(true, "quick", "thorough") === "quick", "explicit depth wins");

// --- journalist identity (scoreboard keys) ---
const authors = parseAuthorNames("By Jane Doe and John Smith | The Times");
assert(authors.length === 2, `byline splits two authors (${authors.join(" / ")})`);
assert(authors.includes("Jane Doe") && authors.includes("John Smith"), "keeps display names");
assert(parseAuthorNames("By Staff").length === 0, "staff byline is not a journalist");
assert(journalistKey("Jane Doe") === journalistKey("jane  doe"), "journalist key is stable");
assert(hostFromUrl("https://www.Example.COM/a") === "example.com", "host strips www");
assert(hostFromUrl("not a url") === null, "bad url is null");

const dietDouble = countTypes([
  {
    id: "s1",
    url: "https://example.test/a",
    host: "example.test",
    title: "A",
    neutrality: 70,
    signalCount: 2,
    source: "heuristic",
    topTypes: ["loaded_language", "whataboutism"],
    scannedAt: "2026-09-18T00:00:00.000Z",
    signals: [
      { type: "loaded_language", severity: 3 },
      { type: "whataboutism", severity: 2 },
    ],
  },
]);
assert(dietDouble.get("loaded_language") === 1, "media-diet does not double-count signals+topTypes");
assert(dietDouble.get("whataboutism") === 1, "media-diet counts each type once per scan");
const dietLegacy = countTypes([
  {
    id: "s2",
    url: "https://example.test/b",
    host: "example.test",
    title: "B",
    neutrality: 70,
    signalCount: 1,
    source: "heuristic",
    topTypes: ["loaded_language"],
    scannedAt: "2026-09-18T00:00:00.000Z",
  },
]);
assert(dietLegacy.get("loaded_language") === 1, "media-diet falls back to topTypes");

// --- gold heuristic suite (production rules, not a copied regex) ---
const gold = runGoldHeuristicSuite();
for (const r of gold.results) {
  assert(
    r.hit,
    `gold ${r.id} (${r.kind} expect=${r.expect}) detected=${r.detectedTypes.join(",") || "none"}`
  );
}
assert(gold.total === 20, `gold bank is 20 examples (${gold.total})`);
assert(gold.failed === 0, `gold suite all pass (${gold.passed}/${gold.total})`);

if (failed) {
  console.error(`\n${failed} score/calibration assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll production score / calibration checks passed.");
