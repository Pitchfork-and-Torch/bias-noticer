# Privacy Policy — Bias Noticer (suggested store text)

**Last updated:** 2026-07-11

Bias Noticer (“the Extension”) is a browser extension that helps users analyze rhetorical techniques in web content.

## Data we process

### Stored on your device

- Extension settings (theme, sensitivity, categories, domain lists)
- Optional xAI API key (in `chrome.storage.local` only)
- Optional local analysis cache (URL + content hash → analysis JSON)
- Optional local feedback (“helpful / not really”)
- Local scan history and scoreboards for **outlets** (hostname averages) and **journalists** (byline averages), including compact audit summaries — **not** full article bodies

### Sent over the network

When you run a full analysis **and** have provided an xAI API key, the Extension sends **article text extracted from the current page** (or a shorter excerpt in Limited Mode) to **xAI’s API** (`https://api.x.ai`) using **your** key. That processing is governed by xAI’s terms and privacy policy.

The Extension developers **do not** operate a proxy that receives your article content by default.

### Not collected by default

- No account with the Extension required  
- No sale of personal data  
- No advertising trackers  
- Opt-in telemetry is **off** by default and, in v1, feedback remains local  

## Permissions

- **storage** — settings and local cache  
- **activeTab / scripting** — read the page you choose to analyze  
- **sidePanel** — show analysis UI  
- **contextMenus** — optional analyze actions  
- **Host permission for api.x.ai** — model requests only  

## Your controls

- Remove or change your API key anytime  
- Enable “Never send full article text”  
- Disable cache  
- “Clear all local data” in Settings  
- Uninstall the Extension to remove its local storage  

## Children

The Extension is not directed at children under 13.

## Contact

For questions about this policy or the extension, open a [GitHub Issue](https://github.com/Pitchfork-and-Torch/bias-noticer/issues).

## Changes

We may update this policy; the “Last updated” date will change accordingly.
