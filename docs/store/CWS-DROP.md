# Chrome Web Store drop (not automated)

We **cannot** push the Chrome Web Store from this repository. A human uploads the zip after review.

## 2.1.1 package

1. `npm ci`
2. `npm run validate`
3. `npm run compile`
4. `npm run build`
5. `npm run zip`

WXT writes `.output/bias-noticer-2.1.1-chrome.zip` (about 180 KB). Confirm `manifest.json` inside the zip shows `"version": "2.1.1"` and the same host permissions as 2.0 (`api.x.ai` + http(s) pages only).

## Dashboard paste

- Listing copy: [`STORE-LISTING-FINAL.md`](./STORE-LISTING-FINAL.md)
- Privacy practices: [`PRIVACY-PRACTICES-PASTE.md`](./PRIVACY-PRACTICES-PASTE.md)
- Privacy URL (live): https://jonbailey.xyz/bias-noticer/privacy/
- Homepage: https://jonbailey.xyz/bias-noticer/
- Support: https://jonbailey.xyz/bias-noticer/support/

## Do not claim

- Auto-publish from GitHub Actions
- Instant CWS availability after merge
- New host permissions (there are none in 2.1.1)

## After store review

Tag the GitHub release `v2.1.1` and attach the same zip. Copy `docs/site/*` to jonbailey.xyz when the listing is live so AEO pages match the store version. This repo does not deploy the musician hub.
