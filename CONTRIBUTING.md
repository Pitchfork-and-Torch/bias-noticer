# Contributing to Bias Noticer

Thanks for helping people read more carefully.

## Principles

1. **Directionally agnostic** — detection must not encode a political team preference.
2. **Techniques over verdicts** — name the rhetorical move; don’t call the reader dumb.
3. **Prefer precision** — a quiet, correct highlight beats ten noisy ones.
4. **Privacy first** — no new network calls without clear user control.
5. **Accessibility** — keyboard, contrast, reduced motion.

## Dev setup

```bash
npm install
npm run dev
```

Load `.output/chrome-mv3-dev` as an unpacked extension.

## Pull requests

- Keep PRs focused and well-described.
- Comment non-obvious DOM or prompt logic.
- Update taxonomy docs if you add a `BiasType`.
- Do not commit API keys, personal articles, or production secrets.

## Adding a bias category

1. Add to `BiasType` in `lib/types.ts`
2. Add metadata in `lib/taxonomy.ts` including:
   - `label`, `shortDefinition`, `hex`, `icon`
   - **two strength-varied `examples`** (mild + strong) for few-shots + glossary
3. Bump `PROMPT_VERSION` in `lib/prompt.ts` when taxonomy or instructions change
4. Methodology UI / Glossary pick up taxonomy automatically
5. Add at least one heuristic pattern only if it is high-precision
6. Include a short test-article snippet and expected JSON shape in the PR

### Expected JSON shape (per instance)

```json
{
  "span_text": "exact quote from article",
  "bias_type": "loaded_language",
  "severity": 3,
  "confidence": 0.72,
  "concise_explanation": "≤25 words",
  "detailed_explanation": "2–4 neutral sentences",
  "evidence_or_counter": "where to look for balance",
  "alternative_perspective": "careful alternate frame",
  "suggested_rephrase": "optional"
}
```

## Heuristics

Patterns in `lib/heuristics.ts` should be **high precision**. Document likely false positives in the PR.

## Security & privacy notes for contributors

- Never commit API keys or real article dumps with PII.
- Prefer `textContent` / escaped HTML over raw `innerHTML` for untrusted strings.
- Host permissions exist for page extract + highlights; do not broaden without UX for optional grants.
- Cache is local, TTL-bound, and keyed by URL + content hash.
