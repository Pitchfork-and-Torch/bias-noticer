# Deploy product pages (jonbailey.xyz)

This folder is the **source of truth** for Bias Noticer web pages. The musician hub hosts them at `https://jonbailey.xyz/bias-noticer/`. This repo cannot push that host.

## Copy map

| Repo path | Live path |
|-----------|-----------|
| `docs/site/index.html` | `/bias-noticer/` |
| `docs/site/llms.txt` | `/bias-noticer/llms.txt` |
| `docs/site/chrome/index.html` | `/bias-noticer/chrome/` |
| `docs/site/privacy/index.html` | `/bias-noticer/privacy/` |
| `docs/site/support/index.html` | `/bias-noticer/support/` |
| `docs/site/share-card.html` | screenshot → `/bias-noticer/share-card.jpg` |

After replacing `share-card.jpg`, bump the `?v=` query on OG/Twitter image URLs (currently `v=4`).

## Screenshot the share card

1. Open `docs/site/share-card.html` at device-pixel-ratio 1.
2. Capture the `.card` element exactly **1200×630**.
3. Export JPEG (quality ~0.85) as `share-card.jpg`.
4. Do not add article text or live scan data to the marketing card.

## AEO notes

- `llms.txt` is the citation file for agents.
- Product + install-hop pages include `og:image` and `twitter:card=summary_large_image`.
- chromewebstore.google.com does **not** expose custom OG tags — share `…/bias-noticer/chrome/` on X, not the raw CWS URL.

## What this is not

- Not an auto-publish to the Chrome Web Store.
- Not a CDN for user article text.
