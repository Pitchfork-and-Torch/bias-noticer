/**
 * Bias Noticer — Core types & JSON schema
 *
 * The extension expects STRICT structured output from the model.
 * Keep this file as the single source of truth for:
 *  - Bias taxonomy enums
 *  - Per-instance analysis shape
 *  - Article-level summary
 *  - Messaging contracts between popup / sidepanel / content / background
 */

/** Documented rhetorical / framing techniques. Directionally agnostic. */
export type BiasType =
  | "loaded_language"
  | "omission_framing"
  | "false_equivalence"
  | "unsubstantiated_claim"
  | "sensationalism"
  | "source_selection"
  | "statistical_cherry_picking"
  | "whataboutism"
  | "appeal_to_emotion"
  | "ad_hominem"
  | "straw_man"
  | "false_dichotomy"
  | "appeal_to_authority"
  | "passive_voice_agency"
  | "euphemism_dysphemism"
  | "hasty_generalization"
  | "slippery_slope"
  | "bandwagon"
  | "poisoning_the_well"
  | "selective_quotation";

/** How the model classifies the piece as a whole */
export type ContentType =
  | "hard_news"
  | "analysis"
  | "opinion"
  | "satire"
  | "academic"
  | "legal"
  | "press_release"
  | "unknown";

/** Sensitivity modes map to confidence/severity thresholds in background.ts */
export type SensitivityMode = "conservative" | "balanced" | "thorough";

/**
 * Analysis depth for multi-pass pipeline.
 * - quick: Pass 0 heuristics + Pass 1 primary (hybrid-friendly)
 * - standard: + Pass 2 verification (default when multi-pass enabled)
 * - thorough: + Pass 3 missing-context / source-diversity / headline-body
 */
export type AnalysisDepth = "quick" | "standard" | "thorough";

export type HighlightStyle = "underline" | "tint" | "border" | "icon" | "glow";

/** Curated appearance presets (style + intensity + optional theme accent). */
export type HighlightPreset = "minimal" | "balanced" | "they_live" | "custom";

export type ThemeMode = "system" | "light" | "dark" | "they_live";

/**
 * One detected bias instance. Text spans should match article text as closely
 * as possible so the content script can locate them via DOM walk.
 */
export interface BiasInstance {
  /** Stable id assigned by the extension (not the model) */
  id: string;
  /** Exact or near-exact quote from the article */
  span_text: string;
  /** Optional surrounding context the model used */
  context?: string;
  bias_type: BiasType;
  /** 1 = minor, 5 = severe / highly manipulative */
  severity: 1 | 2 | 3 | 4 | 5;
  /** 0–1 model confidence */
  confidence: number;
  /** Short plain-English reason (tooltip) */
  concise_explanation: string;
  /** Longer neutral explanation (side panel) */
  detailed_explanation: string;
  /** Grounded counterpoints, data, or alternative framings */
  evidence_or_counter: string;
  /** How a more neutral sentence might read */
  alternative_perspective: string;
  /** Optional suggested neutral rephrase of the span */
  suggested_rephrase?: string;
  /** Character offsets if the model provides them (best-effort) */
  char_start?: number;
  char_end?: number;
  /** Why this was flagged (verification / grounding note) */
  why_flagged?: string;
  /** Quoted material vs authorial voice */
  voice?: "author" | "quoted" | "mixed" | "unknown";
  /** Verification status after Pass 2 */
  verification?: "confirmed" | "downgraded" | "rejected" | "unverified";
  /** Which pass first produced this instance */
  origin_pass?: "heuristic" | "primary" | "verify" | "context" | "merge";
}

/** Pass 3 optional structural findings (missing voices / headline mismatch) */
export interface MissingContextFinding {
  kind:
    | "missing_stakeholder"
    | "source_homogeneity"
    | "headline_body_mismatch"
    | "buried_lede_counter"
    | "other";
  summary: string;
  evidence?: string;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;
}

export interface AnalysisPipelineMeta {
  depth: AnalysisDepth;
  passes_run: Array<"structure" | "heuristic" | "primary" | "verify" | "context">;
  prompt_version: string;
  structure_notes?: string[];
  /** Intermediate auditable notes (never contains full article) */
  pass_notes?: string[];
  duration_ms?: number;
}

export interface ArticleSummary {
  /** 0 = heavily biased, 100 = highly neutral / careful */
  neutrality_score: number;
  content_type: ContentType;
  /** Up to 3 recurring patterns */
  top_patterns: string[];
  /** Search terms or outlet types for balance */
  recommended_sources_or_searches: string[];
  /** One-paragraph overall take (neutral tone) */
  overview: string;
  /** Caveats: satire? opinion labeled? paywall excerpt? */
  caveats: string[];
  /**
   * Severity- and confidence-weighted neutrality when calibrated client-side.
   * When present, UI letter grades prefer this over raw neutrality_score.
   */
  calibrated_neutrality?: number;
  /** Model or client headline vs body congruence note */
  headline_body_note?: string;
}

/** How the analyst lawfully obtained the text (research audit trail) */
export type ResearchAccessMethod =
  | "subscription"
  | "library"
  | "gift_link"
  | "free_teaser"
  | "reader_dom"
  | "public_archive"
  | "paste_other";

/** Provenance for paste / offline research analyses */
export interface ResearchProvenance {
  accessMethod: ResearchAccessMethod;
  /** Canonical article URL when known */
  sourceUrl: string;
  /** Optional note (e.g. library name, archive capture date) */
  accessNote?: string;
  /** Word count of pasted/analyzed body */
  wordCount: number;
  /** When the brief was prepared */
  preparedAt: string;
  /** Operator attestation */
  attestation: string;
}

/**
 * Full analysis payload returned to UI layers.
 * `source` distinguishes Grok vs local heuristic fallback.
 */
export interface BiasAnalysis {
  /** Schema version — 2 adds multi-pass meta + missing_context */
  version: 1 | 2;
  url: string;
  title: string;
  analyzed_at: string;
  content_hash: string;
  source: "grok" | "heuristic" | "cache" | "demo" | "multi_pass";
  model?: string;
  summary: ArticleSummary;
  instances: BiasInstance[];
  /** Truncation / limited-mode notes for transparency */
  notes?: string[];
  /** Highlight application stats from content script (optional) */
  highlightStats?: {
    applied: number;
    missed: number;
    fuzzy: number;
    multiNode: number;
  };
  /** Set for paste / research-desk analyses */
  research?: ResearchProvenance;
  /** Multi-pass pipeline metadata (auditable, local) */
  pipeline?: AnalysisPipelineMeta;
  /** Pass 3 structural findings when thorough mode ran */
  missing_context?: MissingContextFinding[];
}

/** Settings persisted in chrome.storage.local / sync */
export interface ExtensionSettings {
  apiKey: string;
  sensitivity: SensitivityMode;
  enabledCategories: BiasType[];
  highlightStyle: HighlightStyle;
  highlightIntensity: number; // 0.2–1
  /** Visual preset; when not custom, style/intensity follow the preset */
  highlightPreset: HighlightPreset;
  theme: ThemeMode;
  smartAutoScan: boolean;
  domainWhitelist: string[];
  domainBlacklist: string[];
  /** Never send full article — only short excerpts / heuristics */
  neverSendFullText: boolean;
  /** Cache analysis results keyed by URL + content hash */
  enableCache: boolean;
  /** Cache time-to-live in hours (content-hash keys; force re-scan ignores) */
  cacheTtlHours: number;
  /** Opt-in anonymous feedback (disabled by default; local-only unless true) */
  optInTelemetry: boolean;
  /** Custom system prompt override (advanced) */
  customSystemPrompt: string;
  useCustomPrompt: boolean;
  /** First-run onboarding complete */
  onboardingComplete: boolean;
  /** Reveal animation on first activate per page */
  enableShadesAnimation: boolean;
  /**
   * Hybrid mode: paint instant local-heuristic signals while Grok runs,
   * then replace with full model analysis when ready.
   */
  hybridQuickScan: boolean;
  /** Group same-type nearby signals into collapsible clusters in the side panel */
  clusterPanel: boolean;
  /** Hide / de-emphasize signals below this confidence (0–1) in the panel */
  minConfidence: number;
  model: string;
  /**
   * Multi-pass analysis (Pass 2 verify; Pass 3 when thorough).
   * Extra API cost; improves precision. Default true for quality.
   */
  multiPass: boolean;
  /** Depth when multiPass is on (thorough = Pass 3 missing-context) */
  analysisDepth: AnalysisDepth;
  /**
   * Apply local calibration from user feedback (false positive/negative marks)
   * to gently adjust severity thresholds. Never leaves the device.
   */
  useLocalCalibration: boolean;
}

/** Local feedback on a flag — drives calibration, never uploaded */
export type FeedbackKind =
  | "helpful"
  | "wrong"
  | "too_strong"
  | "too_weak"
  | "missed";

export interface FeedbackEntry {
  id: string;
  instanceId: string;
  url: string;
  biasType: BiasType;
  helpful: boolean;
  /** Richer feedback kinds (v2); helpful maps from legacy boolean */
  kind?: FeedbackKind;
  note?: string;
  /** Severity at time of feedback (for calibration) */
  severity?: number;
  confidence?: number;
  createdAt: string;
}

/** Message types between extension contexts */
export type MessageType =
  | { type: "ANALYZE_PAGE"; force?: boolean; tabId?: number }
  | { type: "ANALYZE_SELECTION"; text: string; tabId?: number }
  /** Legal research path: analyze pasted text the user already has access to */
  | {
      type: "ANALYZE_PASTED_TEXT";
      text: string;
      sourceUrl?: string;
      title?: string;
      tabId?: number;
      /** When true, try to paint matching spans on the active page */
      tryHighlight?: boolean;
      accessMethod?: ResearchAccessMethod;
      accessNote?: string;
    }
  | { type: "RUN_DEMO"; tabId?: number }
  | { type: "GET_ANALYSIS"; tabId?: number }
  | { type: "CLEAR_HIGHLIGHTS"; tabId?: number }
  | { type: "SCROLL_TO_INSTANCE"; instanceId: string; tabId?: number }
  | { type: "NAV_HIGHLIGHT"; delta: number; tabId?: number }
  | { type: "REWRITE_SPAN"; instanceId: string; tabId?: number }
  | { type: "SUBMIT_FEEDBACK"; entry: Omit<FeedbackEntry, "id" | "createdAt"> }
  | { type: "TEST_API_KEY"; apiKey?: string }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Partial<ExtensionSettings> }
  | { type: "GET_PAGE_META"; preferReader?: boolean }
  | { type: "PING" }
  | { type: "CONTENT_EXTRACTED"; payload: PageExtract }
  | { type: "ANALYSIS_UPDATED"; analysis: BiasAnalysis | null }
  | { type: "ANALYSIS_PROGRESS"; progress: AnalysisProgress; tabId?: number }
  | { type: "HIGHLIGHT_CLICKED"; instanceId: string }
  | { type: "HIGHLIGHT_STATS"; stats: BiasAnalysis["highlightStats"] }
  | { type: "OPEN_SIDE_PANEL"; tabId?: number }
  /** Side panel: page extract status without full analysis */
  | { type: "GET_PAGE_STATUS"; tabId?: number }
  | { type: "SHADES_TOAST"; message: string }
  | { type: "SHOW_PAYWALL"; wordCount: number }
  | { type: "OPEN_READER_MODE" }
  | { type: "CLOSE_READER_MODE" }
  | { type: "ANALYZE_WITH_READER"; force?: boolean }
  | { type: "GET_SITE_RATING" }
  | { type: "GET_OUTLET_BOARD"; minSamples?: number }
  | { type: "GET_OUTLET_HISTORY"; host: string }
  | { type: "GET_JOURNALIST_HISTORY"; key: string }
  | { type: "CLEAR_OUTLET_STATS" }
  | { type: "GET_PROMPT_META" }
  | { type: "GET_CALIBRATION" }
  | { type: "GET_MEDIA_DIET" }
  | { type: "COMPARE_ANALYSES"; a: BiasAnalysis; b: BiasAnalysis }
  | { type: "ERROR"; error: string };

export interface PageExtract {
  url: string;
  title: string;
  text: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  contentHash: string;
  wordCount: number;
  isLikelyNews: boolean;
  /** True when body text looks thin (paywall / login) */
  possiblyPaywalled: boolean;
  /** Extraction path used */
  extractSource?: string;
}

export interface AnalysisProgress {
  stage:
    | "idle"
    | "extracting"
    | "structure"
    | "analyzing"
    | "verifying"
    | "context"
    | "highlighting"
    | "done"
    | "error";
  message?: string;
  percent?: number;
  /** Optional pass label for multi-pass UI */
  pass?: string;
}

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
