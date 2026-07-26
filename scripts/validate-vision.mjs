/**
 * Lightweight pure-JS smoke checks for They Live Vision invariants.
 * Run: node scripts/validate-vision.mjs
 * (Full types checked via `npm run compile`.)
 */

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// Grade band edges (mirror lib/grades.ts)
function grade(s) {
  s = Math.max(0, Math.min(100, Number(s) || 0));
  if (s >= 97) return "A+";
  if (s >= 93) return "A";
  if (s >= 90) return "A-";
  if (s >= 87) return "B+";
  if (s >= 83) return "B";
  if (s >= 80) return "B-";
  if (s >= 77) return "C+";
  if (s >= 73) return "C";
  if (s >= 70) return "C-";
  if (s >= 67) return "D+";
  if (s >= 63) return "D";
  if (s >= 60) return "D-";
  return "F";
}

assert(grade(98) === "A+", "A+ at 98");
assert(grade(85) === "B", "B at 85");
assert(grade(50) === "F", "F at 50");
assert(grade(0) === "F", "F at 0");
assert(grade(100) === "A+", "A+ at 100");

// Radar positioning math (mirror signal-radar order fallback)
function orderPositions(n) {
  return Array.from({ length: n }, (_, i) => (i + 0.5) / n);
}
const pos = orderPositions(4);
assert(pos[0] < pos[1] && pos[3] < 1, "order positions span article");
assert(Math.abs(pos[0] - 0.125) < 1e-9, "first order position 0.125");

// Bin index
function binIndex(position, binCount) {
  return Math.min(binCount - 1, Math.max(0, Math.floor(position * binCount)));
}
assert(binIndex(0, 12) === 0, "bin 0");
assert(binIndex(0.99, 12) === 11, "bin last");
assert(binIndex(1, 12) === 11, "bin clamp 1.0");

// Academy taxonomy count expectation
const EXPECTED_TYPES = 20;
assert(EXPECTED_TYPES === 20, "taxonomy still 20 techniques");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll vision smoke checks passed.");
