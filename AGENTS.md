# Bias Noticer — agent notes

## What this is

Chrome MV3 extension (WXT + React + TypeScript + Tailwind) that highlights rhetorical bias techniques in articles via xAI Grok (BYOK) or local heuristics.

## Commands

```bash
npm install
npm run dev      # load .output/chrome-mv3-dev in chrome://extensions
npm run build
npm run zip
```

## Hard rules

- Never commit API keys or `data/*token*`.
- Do not add broad `<all_urls>` host permissions without optional grant UX.
- Detection must stay directionally agnostic (no left/right “verdicts”).
- Content script DOM work must remain non-destructive (mark wraps only).
- Prefer under-flagging over noisy false positives.

## Key paths

| Path | Role |
|------|------|
| `lib/prompt.ts` | System prompt v2 + verify/context prompts |
| `lib/types.ts` | JSON schema / settings / messages |
| `lib/grades.ts` | Letter grades + calibrated neutrality |
| `lib/multi-pass.ts` | Pass merge / finalize / local context |
| `lib/structure.ts` | Pass 0 structure extraction |
| `lib/calibration.ts` | Local feedback → threshold nudges |
| `lib/compare.ts` | Side-by-side framing comparison |
| `lib/media-diet.ts` | Personal media-diet from local history |
| `lib/gold-examples.ts` | Gold technique examples |
| `lib/site-cache.ts` | Outlet + journalist scoreboards + scan history |
| `lib/signal-radar.ts` | Document positions + density bins for Signal Radar |
| `lib/academy.ts` | Academy 2.0 lessons, adaptive drills, mastery |
| `lib/highlight.ts` | DOM highlighting |
| `lib/api.ts` | xAI client + multi-pass orchestration |
| `components/SignalRadar.tsx` | Heat-map UI 2.0 |
| `components/TechniqueAcademy.tsx` | Lessons / adaptive drills / live quiz |
| `components/NeutralitySparkline.tsx` | Outlet & journalist scan timelines |
| `entrypoints/background.ts` | Orchestration |
| `entrypoints/content.ts` | Page integration |
| `entrypoints/sidepanel/` | Detailed UX + Outlets/Journalists/Academy |
| `entrypoints/popup/` | Compact dashboard |
| `entrypoints/options/` | Settings + methodology + multi-pass |
| `docs/VISION.md` | Product vision & architecture |
| `docs/assets/infographic-letter-grades.*` | Grade-scale poster (PNG + HTML) |

## Public GitHub hygiene

Product `main` stays a **single** squashed commit under author `Pitchfork-and-Torch`. No personal emails, local paths, or secrets in the tree.
