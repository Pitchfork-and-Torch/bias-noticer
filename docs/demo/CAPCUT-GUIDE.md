# CapCut / Descript production guide

## Project setup

| Setting | Vertical (primary) | Horizontal |
|---------|-------------------|------------|
| Resolution | 1080×1920 | 1920×1080 |
| FPS | 30 | 30 |
| Length | 75s | 75–90s |
| Color | Rec.709 | Rec.709 |

## Timeline map (vertical)

| Time | Clip source | Overlay |
|------|-------------|---------|
| 0:00–0:02 | `assets/00-ethics-slate.jpg` | none (hold) |
| 0:02–0:08 | `storyboard/SB01-open-hero.jpg` or screen rec | VO |
| 0:08–0:18 | Screen rec: navigate article OR `03-nyt-article-raw.jpg` | Ken Burns slow |
| 0:18–0:28 | `04-paywall-banner.jpg` → cut to `05-reader-extract.jpg` | “Local · educational” |
| 0:28–0:40 | Screen rec: Put on shades OR `06-highlights-and-sidepanel.jpg` | toast sim |
| 0:40–0:55 | Zoom on side panel region | callout: spectrum |
| 0:55–1:05 | `09-settings-model.jpg` flash | “BYOK · grok-4.3” |
| 1:05–1:15 | `storyboard/SB05-end-card.jpg` | CTA GitHub |

## Captions

- Style: bold white, black outline, bottom-safe 15%
- Auto-captions in CapCut → fix names: “Bias Noticer”, “Grok”, “BYOK”
- Burn-in for silent feed

## Music

- Low ambient, no lyrics, −18 to −22 LUFS under VO
- Avoid news-sounding stingers that imply scandal

## Export

| Destination | Preset |
|-------------|--------|
| X | 1080×1920, H.264, ≤512MB |
| YouTube | 1080p or 4K 16:9 |
| GIF loop (15s) | shades-on only, 15fps |

## Voiceover file

Record from `NYT-2026-07-11-DEMO-SCRIPT.md` full script.  
Pace 150 wpm. Descript Studio Sound recommended.

## Checklist before publish

- [ ] Ethics slate ≥2s  
- [ ] No real API keys  
- [ ] No “debunked / destroyed” language  
- [ ] Captions accurate  
- [ ] End card + repo link  
