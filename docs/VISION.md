# They Live Vision — v2.0 Exceptional sunglasses

Signal Radar 2.0 + Technique Academy 2.0 + multi-pass detection + research briefs — local-first media literacy.

## Non-negotiable principles

1. **Techniques over tribes** — no left/right verdicts  
2. **Privacy-first** — `chrome.storage.local` only for content analysis, grades, Academy, calibration  
3. **No paywall bypass** — DOM text or user-pasted lawful access only  
4. **Prefer under-flagging** — false positives erode trust faster than misses  
5. **User control** — sensitivity, categories, multi-pass depth, final judgment  
6. **Transparent methodology** — public prompt + versioning (Options → Methodology)  
7. **They Live spirit** — media literacy, not censorship  

## Multi-pass engine

| Pass | Name | Network? | Role |
|------|------|----------|------|
| 0 | Structure | No | Quotes, named sources, lead/close, genre guess |
| 1 | Primary | BYOK Grok or local heuristics | Technique instances + summary |
| 2 | Verify | BYOK (standard/thorough) | Confirm / downgrade / reject; voice |
| 3 | Context | BYOK thorough, else local | Missing stakeholders, headline-body, source mix |

Code: `lib/structure.ts`, `lib/multi-pass.ts`, `lib/api.ts`, `lib/prompt.ts` (v2.0.0)

## Signal Radar 2.0

- Severity layers, scrub reveal, glass-style tooltips with why/rephrase/voice  
- Code: `lib/signal-radar.ts`, `components/SignalRadar.tsx`

## Technique Academy 2.0

- Adaptive drills, spaced-repetition mastery, streaks, live spot mode  
- Progress: `bn_academy_progress` in `chrome.storage.local`  
- Code: `lib/academy.ts`, `components/TechniqueAcademy.tsx`

## Research output

- One-click Markdown/JSON/print brief with evidence table + methodology  
- Comparison: `lib/compare.ts`  
- Media diet: `lib/media-diet.ts` (local history only)

## Grading

- Letter grades A+–F from neutrality 0–100  
- UI prefers **calibrated** neutrality when present  
- See `docs/GRADES.md` and `lib/grades.ts`

## Validation

```bash
npm run validate        # vision + gold smoke
npm run compile
npm run build
npm run build:firefox
```
