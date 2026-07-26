# Screenshot & asset specs (GitHub README)

Produce **10** polished captures. Prefer real extension UI; fall back to the HTML mock at `docs/demo/mockups/`.

## Style system

- Browser: Chrome/Brave light chrome, address bar `nytimes.com/...`
- Extension UI: slate + sky accent `#0EA5E9`, Inter UI, Georgia optional in reader
- Annotation: thin cyan callouts, 12–14px labels, no meme arrows
- Export: PNG 1600px wide (or 2× for retina)

## Shot list

| # | File name | Content | Caption for README |
|---|-----------|---------|-------------------|
| 01 | `01-install-extensions.png` | chrome://extensions, Bias Noticer enabled | Load unpacked — developer mode |
| 02 | `02-popup-idle.png` | Popup empty state + tagline | Put on shades |
| 03 | `03-nyt-article-raw.png` | Article viewport, no highlights | Live page before analysis |
| 04 | `04-paywall-banner.png` | Limited text banner + Reader CTA | Metered page handling |
| 05 | `05-reader-extract.png` | Full reader overlay | Local extract — educational use |
| 06 | `06-highlights-tooltips.png` | Article marks + tooltip | Technique, not team score |
| 07 | `07-sidepanel-summary.png` | Gauge + breakdown bars | Neutrality spectrum |
| 08 | `08-sidepanel-detail.png` | Quote + counterpoints | Evidence-oriented detail |
| 09 | `09-settings-model.png` | API key + grok-4.3 | BYOK privacy |
| 10 | `10-they-live-theme.png` | Dark scanline theme | Optional cinematic mode |

## Image generation prompts (if capturing live UI is blocked)

Use with any image model; request **UI mock, not photoreal people**:

```
Premium Chrome browser window mockup, clean Arc/Linear aesthetic, 
news article page about media subpoenas, left side Bias Noticer side panel 
with circular neutrality gauge at 58, stacked category percentage bars 
(loaded language, omission, source selection), glassmorphic tooltip on 
highlighted wavy-underlined phrase, soft sky-blue accent #0EA5E9, 
slate typography, high-end product screenshot, no cartoon characters, 
no political logos distorted, 16:9
```

```
Mobile vertical 9:16 product ad frame: browser + Bias Noticer sunglasses icon, 
caption "See through the propaganda", dark mode They Live subtle scanlines, 
minimal neon cyan, cinematic but professional
```

## Checklist before README publish

- [ ] No real API keys in shots  
- [ ] No private account email  
- [ ] Disclaimer visible in at least one panel shot  
- [ ] Captions avoid “debunked” / partisan victory language  
