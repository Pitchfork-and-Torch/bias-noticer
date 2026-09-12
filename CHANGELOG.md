# Changelog

Bias Noticer - They Live - inspired critical-reading extension. Highlights rhetorical techniques with BYOK Grok; privacy-first; no paywall bypass. Local letter grades, Signal Radar, Technique Academy, and outlet/journalist scoreboards from your own scans.

## 2.1.0 - Shareable grades, honest docs

Visible upgrades on top of 2.0. Detection engine and host permissions are unchanged.

### Grades card (local)
- Export a **1200×630 PNG or JPEG** of the current scan grade (or an outlet / journalist scoreboard row)
- Built with Canvas 2D in the popup / side panel - **no upload**, no new network calls
- Card shows title, hostname, letter grade, neutrality, technique *names* - never article body or span quotes
- Copy a tweet caption that stays directionally agnostic

### Product pages & AEO
- Source-of-truth pages in `docs/site/`: product, privacy, support, install hop, `llms.txt`, share-card HTML
- Install hop keeps Open Graph / X large-image previews (CWS URLs still have no custom OG tags)
- Chrome Web Store listing draft URLs now match the live item (homepage / support / privacy on jonbailey.xyz)

### Honesty
- Privacy policy dated **2026-09-01** - documents http(s) page hosts + `api.x.ai`, scoreboards, local grade cards
- Settings → Privacy lists the permissions we actually ship (no extra hosts)
- CWS drop is a **human zip upload** (`docs/store/CWS-DROP.md`) - we cannot auto-publish the store

### Version
- `package.json`, `lib/version.ts`, README badge, changelog, and site files all say **2.1.0**
- `npm run validate:version` fails the build if those labels drift

## 2.0.0 - Exceptional sunglasses (next-gen)

### Detection excellence
- **Multi-pass analysis engine** (default on when API key present):
 - Pass 0: local structure extraction (quotes, named sources, genre guess)
 - Pass 1: primary technique detection (Grok / heuristics)
 - Pass 2: verification - span grounding, author vs quoted voice, under-flag merge
 - Pass 3: missing context / source diversity / headline-body (LLM on Thorough depth; local hints on Standard)
- **Prompt v2.0.0** with voice fields, verify + context system prompts, public methodology
- **Local calibration** from Wrong / Too strong / Too weak / Helpful feedback (device-only)
- **Calibrated neutrality**: severity × confidence × voice weights, content-type aware

### Signal Radar 2.0
- Severity layer filters, timeline scrub reveal, richer tooltips (why flagged, rephrase, voice)
- Verification badges on jump list

### Technique Academy 2.0
- Adaptive drills (weak techniques + SRS + live scan examples)
- Mastery levels, badges, streaks
- Live "spot the technique" quiz on current page signals

### Research & longitudinal
- Premium research brief Markdown (evidence table, methodology, pipeline meta)
- Side-by-side comparison helpers (`lib/compare.ts`)
- Personal media-diet summary from local scan history only

### Quality & product
- Gold-example suite + `npm run validate:gold` / `npm run validate`
- Settings: multi-pass toggle, analysis depth, local calibration
- Firefox build path unchanged (`npm run build:firefox`)
- Principles unchanged: techniques over tribes, privacy-first, no paywall bypass, under-flag, user control

## 1.6.1

- Settings key save hardening (no empty overwrite on blur)
- Test key saves first; scan lock watchdog + force re-scan

## 1.6.0 - They Live Vision

- Signal Radar, Technique Academy, outlet/journalist sparklines
- Expanded offline heuristics; Vision docs + validate script
