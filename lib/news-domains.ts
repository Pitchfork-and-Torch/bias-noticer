/**
 * Known news / long-form domains for Smart Auto-Scan.
 * Not an allowlist of "trust" — only a heuristic for when auto-scan may help.
 */

export const NEWS_DOMAIN_HINTS = [
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "ft.com",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "cnn.com",
  "foxnews.com",
  "nbcnews.com",
  "cbsnews.com",
  "abcnews.go.com",
  "npr.org",
  "politico.com",
  "thehill.com",
  "axios.com",
  "vox.com",
  "theatlantic.com",
  "newyorker.com",
  "economist.com",
  "bloomberg.com",
  "aljazeera.com",
  "dw.com",
  "france24.com",
  "independent.co.uk",
  "telegraph.co.uk",
  "dailymail.co.uk",
  "nypost.com",
  "latimes.com",
  "usatoday.com",
  "time.com",
  "newsweek.com",
  "slate.com",
  "salon.com",
  "motherjones.com",
  "nationalreview.com",
  "reason.com",
  "theintercept.com",
  "propublica.org",
  "wired.com",
  "techcrunch.com",
  "arstechnica.com",
  "medium.com",
  "substack.com",
  "news.google.com",
  "msn.com",
  "yahoo.com",
  "huffpost.com",
  "breitbart.com",
  "dailywire.com",
  "jacobin.com",
];

export function hostnameMatches(host: string, pattern: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  const p = pattern.replace(/^www\./, "").toLowerCase();
  return h === p || h.endsWith("." + p);
}

export function isLikelyNewsDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return NEWS_DOMAIN_HINTS.some((d) => hostnameMatches(host, d));
  } catch {
    return false;
  }
}

export function domainAllowed(
  url: string,
  whitelist: string[],
  blacklist: string[]
): boolean {
  try {
    const host = new URL(url).hostname;
    if (blacklist.some((d) => hostnameMatches(host, d))) return false;
    if (whitelist.length === 0) return true;
    return whitelist.some((d) => hostnameMatches(host, d));
  } catch {
    return false;
  }
}
