# Changelog

Bias Noticer — They Live–inspired critical-reading extension. Highlights rhetorical techniques with BYOK Grok; privacy-first; no paywall bypass. Local letter grades, Signal Radar, Technique Academy, and outlet/journalist scoreboards from your own scans.

## 2.0.0 — Exceptional sunglasses (next-gen)

### Detection excellence
- **Multi-pass analysis engine** (default on when API key present):
  - Pass 0: local structure extraction (quotes, named sources, genre guess)
  - Pass 1: primary technique detection (Grok / heuristics)
  - Pass 2: verification — span grounding, author vs quoted voice, under-flag merge
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
- Live “spot the technique” quiz on current page signals

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

## 1.6.0 — They Live Vision

- Signal Radar, Technique Academy, outlet/journalist sparklines
- Expanded offline heuristics; Vision docs + validate script
