# Development guide

## Stack

- **WXT** — MV3 extension framework  
- **React 18** — popup, side panel, options  
- **TypeScript** — strict  
- **Tailwind CSS** — UI  
- **@mozilla/readability** — article extraction  
- **xAI Chat Completions** — BYOK analysis  

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Chrome dev build + reload |
| `npm run build` | Production Chrome build |
| `npm run zip` | Store-ready zip |
| `npm run compile` | `tsc --noEmit` |
| `npm run dev:firefox` | Firefox target |

## Message protocol

See `lib/types.ts` → `MessageType`. All async handlers return `{ ok: true, data } | { ok: false, error }`.

## Letter grades & scoreboards

| Module | Role |
|--------|------|
| `lib/grades.ts` | Neutrality 0–100 → A+…F |
| `lib/site-cache.ts` | `bn_site_*`, `bn_jour_*`, `bn_scan_history`; byline parse |
| Side panel **Outlets** tab | Dual scoreboard + clickable audit history |

See [GRADES.md](./GRADES.md) and the infographic under `docs/assets/infographic-letter-grades.*`.

## Testing highlights without Grok

1. Leave API key empty  
2. Open any long article  
3. Put on shades → heuristics + toast  
4. Or temporarily call `runHeuristicAnalysis` / inject `MOCK_ANALYSIS` from `lib/mock-analysis.ts`

## Content script safety

- Only wrap text nodes under article-like roots  
- Skip `script/style/textarea/contenteditable` and `.bn-ui`  
- `surroundContents` failures are skipped (no throw to page)  
- MutationObserver re-applies if SPA wipes marks  

## Prompt iteration

1. Edit `DEFAULT_SYSTEM_PROMPT` in `lib/prompt.ts`  
2. Or use Settings → Advanced custom lens  
3. Compare false positives on the same article with Conservative vs Thorough  

## Packaging checklist

- [ ] Bump version in `package.json` + `wxt.config.ts` manifest  
- [ ] Privacy policy URL live  
- [ ] Icons 128/48/16  
- [ ] Screenshots  
- [ ] No secrets in zip  
