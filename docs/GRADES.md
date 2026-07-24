# Letter grades — outlets & journalists

Bias Noticer maps **neutrality scores (0–100)** to letter grades **A+ through F**. Higher neutrality means less framing / bias-signal load detected in your scans — not “truth” and not a political party meter.

## Scale

| Grade | Range | Label |
|-------|-------|-------|
| A+ | 97–100 | Exceptionally even |
| A | 93–96 | Very even |
| A− | 90–92 | Mostly even |
| B+ | 87–89 | Light framing |
| B | 83–86 | Some framing |
| B− | 80–82 | Noticeable framing |
| C+ | 77–79 | Mixed |
| C | 73–76 | Mixed / lean |
| C− | 70–72 | Clear lean |
| D+ | 67–69 | Heavy framing |
| D | 63–66 | Strong bias signals |
| D− | 60–62 | Very heavy signals |
| F | 0–59 | Extreme bias signals |

Implementation: `lib/grades.ts` → `neutralityToGrade()`, `displayNeutrality()`, `computeCalibratedNeutrality()`.

## Calibrated neutrality (v2)

UI grades prefer **calibrated** scores when multi-pass / heuristics finalize an analysis:

- Weighted by **severity × confidence**
- **Quoted voice** counts less than authorial framing (quotes are not automatically the author’s technique)
- **Downgraded** verification status reduces load
- **Content-type nudge**: satire/opinion slightly less punitive; press releases slightly more

Raw model `neutrality_score` is retained for transparency; `calibrated_neutrality` is what letter badges use via `displayNeutrality()`.

## Outlets

- Keyed by hostname (e.g. `reuters.com`)
- Storage prefix: `bn_site_*`
- Side panel → **Outlets** tab → **Outlets** toggle
- Click a row for local audit history (compact reports only)

## Journalists

- Keyed by normalized byline name
- Multi-author lines (`By A and B`) credit each person
- Storage prefix: `bn_jour_*`
- Side panel → **Outlets** tab → **Journalists** toggle
- Click a name for that person’s audit trail

## Hygiene

- Demo mode does not pollute scoreboards
- Thin / empty paywall shells are excluded from rankings
- All data stays in `chrome.storage.local`
- Settings → clear all data wipes sites, journalists, and scan history together

## Infographic

- PNG: [`assets/infographic-letter-grades.png`](assets/infographic-letter-grades.png)
- Editable HTML: [`assets/infographic-letter-grades.html`](assets/infographic-letter-grades.html)
