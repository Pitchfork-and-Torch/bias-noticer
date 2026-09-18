/**
 * Fail if public version labels drift.
 * Run: node scripts/validate-version.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

assert(/^\d+\.\d+\.\d+$/.test(version), `semver package.json (${version})`);

const files = [
  ["lib/version.ts", `APP_VERSION = "${version}"`],
  ["README.md", `version-${version}-`],
  ["CHANGELOG.md", `## ${version}`],
  ["docs/site/llms.txt", `extension: ${version}`],
  ["docs/site/index.html", `"softwareVersion": "${version}"`],
  ["docs/site/chrome/index.html", `v${version}`],
  ["docs/PRIVACY_POLICY.md", version.split(".").slice(0, 2).join(".")],
];

for (const [rel, needle] of files) {
  const src = readFileSync(join(root, rel), "utf8");
  assert(src.includes(needle), `${rel} mentions ${needle}`);
}

const wxt = readFileSync(join(root, "wxt.config.ts"), "utf8");
assert(
  wxt.includes("https://api.x.ai/*") &&
    wxt.includes("http://*/*") &&
    wxt.includes("https://*/*"),
  "manifest hosts: api.x.ai + http(s) pages"
);
assert(!/facebook|google-analytics|amplitude|sentry\.io/i.test(wxt), "no extra analytics hosts in manifest");

const gradeCard = readFileSync(join(root, "lib/grade-card.ts"), "utf8");
assert(gradeCard.includes("Never uploads article text"), "grade-card documents no upload");
assert(!gradeCard.includes("fetch("), "grade-card has no fetch");
assert(!gradeCard.includes("api.x.ai"), "grade-card does not call xAI");

if (failed) {
  console.error(`\n${failed} version/honesty check(s) failed`);
  process.exit(1);
}
console.log(`\nVersion ${version} is consistent.`);
