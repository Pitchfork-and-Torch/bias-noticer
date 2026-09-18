# Chrome Web Store - listing copy (final)

## Official URLs

| Field | URL |
|--------|-----|
| **Homepage / official** | https://jonbailey.xyz/bias-noticer/ |
| **Install hop (share / OG)** | https://jonbailey.xyz/bias-noticer/chrome/ |
| **Support** | https://jonbailey.xyz/bias-noticer/support/ |
| **Privacy policy** | https://jonbailey.xyz/bias-noticer/privacy/ |
| **Privacy (repo copy)** | https://github.com/Pitchfork-and-Torch/bias-noticer/blob/main/docs/PRIVACY_POLICY.md |
| **Source / releases** | https://github.com/Pitchfork-and-Torch/bias-noticer/releases |
| **Chrome Web Store** | https://chromewebstore.google.com/detail/bias-noticer/fomgclbljaghhlnnemplpobaipegkkfc |
| **Listing version** | 2.1.1 (upload zip; CWS is not auto-published) |

## Single purpose statement

Help users critically evaluate rhetorical framing and bias techniques in web articles through optional AI-assisted highlights and explanations.

## Short description (132 chars max)

See through the propaganda. Highlight rhetorical bias techniques in news - explanations, counterpoints, never censorship.

## Category

Productivity

## Language

English (United States)

## Detailed description

```
Bias Noticer is a privacy-first critical-reading layer for Chrome, Brave, and Edge.

Inspired by the "put on the sunglasses" moment from They Live - as a metaphor for media literacy, not as official merchandise - it highlights specific rhetorical techniques in news, opinion, and long-form writing. No left/right meter. No censorship. No selling your data.

WHAT IT DOES
• Extracts readable article text from the page you already opened
• Analyzes with your own xAI Grok API key (BYOK), or offline heuristics if you have no key
• Paints non-destructive highlights with glassmorphic tooltips
• Side panel: signals, summary, evidence, research paste, outlets, Academy, glossary
• Letter grades (A+ - F) plus local outlet / journalist scoreboards from your scans
• Grades-card PNG or JPEG rendered on your device - attach to a tweet; no article-text upload
• Research paste for lawfully obtained full text + exportable audit brief
• Themes: Light, Dark, System, and They Live retro
• Shortcuts: Ctrl+Shift+B shades · Ctrl+Shift+Y panel · Alt+[ ] navigate

WHAT IT IS NOT
• Not a partisan "bias score"
• Not a fact-checker that issues final verdicts
• Not a paywall bypass or content blocker

PRIVACY
• API key stays in chrome.storage.local on your device
• Optional limited mode that avoids sending full article text
• Local cache you can clear anytime
• No ads, no trackers, no data marketplace

ETHICS
AI-assisted analysis is not infallible. Use it to sharpen judgment - not replace it. Support journalism you value. Bias Noticer only analyzes text already available in your browser or that you paste after lawful access.

Install, pin the icon, open a long-form article, and put on the shades.

Homepage: https://jonbailey.xyz/bias-noticer/
Support: https://jonbailey.xyz/bias-noticer/support/
Privacy: https://jonbailey.xyz/bias-noticer/privacy/
Email: bias@jonbailey.xyz
Source: https://github.com/Pitchfork-and-Torch/bias-noticer
```

## Permission justifications (dashboard)

| Permission | Justification |
|------------|----------------|
| storage | Save settings, local API key, and optional analysis cache on device only. |
| activeTab | Analyze the page the user is viewing after they activate the extension. |
| scripting | Inject non-destructive highlight UI and extract readable text on user action. |
| sidePanel | Show detailed analysis without covering the article. |
| contextMenus | Right-click analyze page / selection / open panel. |
| Host: http(s)://*/* | Read article DOM and apply highlights on pages the user navigates to. |
| Host: https://api.x.ai/* | Send analysis requests only when the user supplies their own xAI key. |

## Data usage disclosure

When the user provides an xAI API key and runs analysis, selected article text is sent to api.x.ai for processing. Keys and settings are stored locally. No selling of personal data. See privacy policy URL above.
