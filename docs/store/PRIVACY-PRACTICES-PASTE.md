# Chrome Web Store — Privacy practices (copy/paste)

Open your item → **Privacy practices** tab. Paste each block into the matching field, then **Save draft**.

Also complete: **Account Settings** → publisher contact email (see bottom).

---

## Single purpose description (required)

```
Help users critically evaluate rhetorical framing and bias techniques in web articles through optional AI-assisted highlights and explanations.
```

---

## Permission justifications (required)

### storage

```
Used to store extension settings, the user’s optional xAI API key, and optional analysis cache exclusively in chrome.storage.local on the user’s device. No data is synced by the extension to third-party analytics. Users can clear all local data from Settings.
```

### activeTab

```
Used only after the user activates the extension (toolbar action, keyboard shortcut, or context menu) so Bias Noticer can access the currently active tab to extract readable article text and show analysis for that page. It is not used for background browsing of unrelated tabs.
```

### scripting

```
Used to inject the local content script and non-destructive highlight UI into the active page after user action, and to re-apply highlights or open the local reader extract. All injected scripts are packaged with the extension; no remotely hosted code is executed.
```

### sidePanel

```
Used to display the Bias Noticer side panel (signal list, summary, evidence, research paste, glossary) alongside the article without blocking the page content. The panel only opens when the user requests it via shortcut, popup, or context menu.
```

### contextMenus

```
Used to provide right-click actions: analyze page, analyze selected text, demo highlights, and open the side panel. These menus run only when the user explicitly chooses an item.
```

### Host permission use (http://*/* and https://*/*)

```
Required so the content script can read the DOM of ordinary web articles the user opens and apply non-destructive visual highlights and tooltips on those pages. Access is for user-initiated critical-reading analysis of the current page content only. The extension does not scrape sites in the background and does not bypass paywalls.
```

### Host permission use (https://api.x.ai/*) — if asked separately

```
Used only when the user supplies their own xAI API key and runs analysis. Article text or pasted research text is sent to api.x.ai for model inference under the user’s key. If no key is set, analysis uses on-device heuristics and this host is not called for analysis.
```

### Remote code use (required)

**Select: No — this extension does not use remote code.**

If a justification box still appears, paste:

```
Bias Noticer does not use remote code. All JavaScript is included in the extension package (service worker, popup, options, side panel, and content scripts). There is no eval of remote scripts, no dynamic import of remote URLs, and no execution of code fetched from the network. Optional network calls go only to https://api.x.ai/* for user-initiated BYOK model responses as data, not as executable extension code.
```

---

## Certify data usage (required checkbox)

Check **all** boxes that apply. For Bias Noticer, typical answers:

| Question | Answer |
|----------|--------|
| Does your item collect or use user data? | **Yes** (API key stored locally; optional article text sent to xAI when user analyzes with a key) |
| Personally identifiable information | **Yes** if they count an API key / optional pasted text — or follow the form’s definitions carefully |
| Health / financial / auth / location / web history / user activity | Generally **No** unless the form forces a match for “user activity” — if “website content” or “user activity” covers page text analyzed on user action, select that and disclose |
| Privacy policy URL | `https://github.com/Pitchfork-and-Torch/bias-noticer/blob/main/docs/PRIVACY_POLICY.md` |

### Certification text / disclosure (if free-form)

```
Bias Noticer stores settings and an optional user-provided xAI API key in chrome.storage.local on the device. When the user runs analysis with a key, article text or text the user pastes is sent to https://api.x.ai/ for processing under that key. Local outlet/journalist scoreboards store compact scan summaries only (no full article bodies). No ads, no sale of personal data, no third-party analytics SDKs. Full policy: https://github.com/Pitchfork-and-Torch/bias-noticer/blob/main/docs/PRIVACY_POLICY.md
```

**Check the box:** “I certify that the data usage… complies with the Developer Program Policies.”

---

## Privacy policy URL (if on same tab)

```
https://github.com/Pitchfork-and-Torch/bias-noticer/blob/main/docs/PRIVACY_POLICY.md
```

---

## Contact email (Settings page — separate from Privacy practices)

The errors:

- *You must provide a contact email…*
- *You must verify the publisher's contact email…*

are **not** fixed on Privacy practices.

### Steps

1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click your **account / Settings** (publisher settings), not only the item.
3. Set **Contact email** to a **verified** address you control (publisher login email is fine).
4. Click **Verify** / send verification email.
5. Open the email → click the verification link.
6. Return to the item → **Save draft** → try **Submit for review** again.

Until Google shows the email as **verified**, publish stays blocked even if every privacy field is perfect.

Recommended for this product:

| Field | Value |
|--------|--------|
| Contact email | Your verified Chrome Web Store publisher email |
| Support URL | `https://github.com/Pitchfork-and-Torch/bias-noticer/issues` |
| Homepage | `https://github.com/Pitchfork-and-Torch/bias-noticer` |

---

## After you paste

1. Privacy practices → fill all fields above → **Save draft**  
2. Settings → contact email → **verify**  
3. Item → Submit for review  

If publish still fails, the remaining error is almost always **unverified contact email**.
