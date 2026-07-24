# Security

## Reporting

Please open a [GitHub Security Advisory](https://github.com/Pitchfork-and-Torch/bias-noticer/security/advisories/new) or a private report via Issues if disclosure tooling is unavailable.

Do not post API keys or personal data in public issues.

## Scope

Bias Noticer is a browser extension that may call `https://api.x.ai/*` only when the user supplies their own key. Keys are stored in `chrome.storage.local` by design.

## Out of scope

Third-party paywall circumvention, credential theft, or abuse of publisher sites is not supported and not accepted as a feature request.
