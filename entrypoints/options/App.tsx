import { useEffect, useMemo, useState } from "react";
import { Disclaimer } from "../../components/Disclaimer";
import { SunglassesIcon } from "../../components/SunglassesIcon";
import { DEFAULT_SYSTEM_PROMPT, PROMPT_VERSION } from "../../lib/prompt";
import { HIGHLIGHT_PRESETS } from "../../lib/presets";
import { sendToBackground } from "../../lib/messaging";
import { ALL_BIAS_TYPES, BIAS_TAXONOMY } from "../../lib/taxonomy";
import {
  clearAllLocalData,
  DEFAULT_MODEL,
  DEFAULT_SETTINGS,
  RECOMMENDED_MODELS,
} from "../../lib/storage";
import type {
  BiasType,
  ExtensionSettings,
  HighlightPreset,
  HighlightStyle,
  SensitivityMode,
  ThemeMode,
} from "../../lib/types";
import { applyTheme as applyThemeMode } from "../../lib/theme";
import { APP_VERSION } from "../../lib/version";

type Tab = "general" | "detection" | "appearance" | "privacy" | "advanced" | "methodology" | "onboarding";

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>("general");
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await sendToBackground<ExtensionSettings>({ type: "GET_SETTINGS" });
      if (res.ok) {
        setSettings(res.data);
        if (!res.data.onboardingComplete) setTab("onboarding");
      }
    })();
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  function applyTheme(theme: ThemeMode) {
    applyThemeMode(theme);
  }

  async function save(partial: Partial<ExtensionSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    const res = await sendToBackground<ExtensionSettings>({
      type: "SAVE_SETTINGS",
      settings: partial,
    });
    if (res.ok) {
      setSettings(res.data);
      setStatus("Saved");
      window.setTimeout(() => setStatus(null), 1500);
    } else {
      setStatus(res.error);
    }
  }

  async function testKey() {
    setTesting(true);
    const res = await sendToBackground<{ ok: true; model: string }>({
      type: "TEST_API_KEY",
      apiKey: settings.apiKey,
    });
    setTesting(false);
    setStatus(res.ok ? `Connected (${res.data.model})` : res.error);
  }

  async function finishOnboarding() {
    await save({ onboardingComplete: true });
    setTab("general");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "detection", label: "Detection" },
    { id: "appearance", label: "Appearance" },
    { id: "privacy", label: "Privacy" },
    { id: "advanced", label: "Advanced" },
    { id: "methodology", label: "Methodology" },
    { id: "onboarding", label: "Tour" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SunglassesIcon className="h-12 w-12" glow />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Bias Noticer
            </h1>
            <p className="text-sm text-slate-500">
              Settings · See through the propaganda. · v{APP_VERSION} · prompt{" "}
              {PROMPT_VERSION}
            </p>
          </div>
        </div>
        {status && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {status}
          </span>
        )}
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="space-y-6">
        {tab === "onboarding" && (
          <Onboarding onDone={() => void finishOnboarding()} />
        )}

        {tab === "general" && (
          <section className="bn-card space-y-4 p-5">
            <h2 className="bn-section-title">API key (BYOK)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your xAI key is stored only in this browser&apos;s local extension
              storage. It is sent only to{" "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                api.x.ai
              </code>{" "}
              when you analyze a page.{" "}
              <a
                className="font-medium text-brand-600 underline"
                href="https://console.x.ai/"
                target="_blank"
                rel="noreferrer"
              >
                Get a key at console.x.ai
              </a>
            </p>
            <div>
              <label className="bn-label" htmlFor="apiKey">
                xAI API key
              </label>
              <div className="flex gap-2">
                <input
                  id="apiKey"
                  className="bn-input font-mono"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  placeholder="xai-…"
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
                  }
                  onBlur={() => void save({ apiKey: settings.apiKey })}
                />
                <button
                  className="bn-btn-secondary"
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  className="bn-btn-primary"
                  type="button"
                  disabled={testing || !settings.apiKey}
                  onClick={() => void testKey()}
                >
                  {testing ? "Testing…" : "Test"}
                </button>
              </div>
            </div>
            <div>
              <label className="bn-label" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                className="bn-input"
                value={
                  RECOMMENDED_MODELS.some((m) => m.id === settings.model)
                    ? settings.model
                    : "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value === "__custom__") return;
                  void save({ model: e.target.value });
                }}
              >
                {RECOMMENDED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
                {!RECOMMENDED_MODELS.some((m) => m.id === settings.model) && (
                  <option value="__custom__">{settings.model} (custom)</option>
                )}
              </select>
              <input
                className="bn-input mt-2 font-mono text-xs"
                value={settings.model}
                onChange={(e) =>
                  setSettings({ ...settings, model: e.target.value })
                }
                onBlur={() => void save({ model: settings.model })}
                aria-label="Custom model id"
              />
              <p className="mt-1 text-xs text-slate-500">
                New installs default to <code>{DEFAULT_MODEL}</code> (best
                general xAI chat model for BYOK). Flagship{" "}
                <code>grok-4.5</code> costs more. Retired ids like{" "}
                <code>grok-2-latest</code> auto-migrate. xAI API usage is
                billed to your key — there is no unlimited free API model.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.smartAutoScan}
                onChange={(e) => void save({ smartAutoScan: e.target.checked })}
              />
              Smart Auto-Scan on known news domains
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.hybridQuickScan}
                onChange={(e) =>
                  void save({ hybridQuickScan: e.target.checked })
                }
              />
              <span>
                <strong>Hybrid quick scan</strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Paint instant local-heuristic signals while Grok runs, then
                  replace with full analysis.
                </span>
              </span>
            </label>
            <Disclaimer />
          </section>
        )}

        {tab === "detection" && (
          <section className="bn-card space-y-4 p-5">
            <h2 className="bn-section-title">Sensitivity & categories</h2>
            <div>
              <label className="bn-label">Sensitivity mode</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["conservative", "Conservative"],
                    ["balanced", "Balanced"],
                    ["thorough", "Thorough"],
                  ] as [SensitivityMode, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={
                      settings.sensitivity === id
                        ? "bn-btn-primary"
                        : "bn-btn-secondary"
                    }
                    onClick={() => void save({ sensitivity: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Maps to confidence/severity thresholds and max instance density.
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="bn-label mb-0">Categories</label>
                <div className="flex gap-2">
                  <button
                    className="text-xs text-brand-600"
                    onClick={() =>
                      void save({ enabledCategories: [...ALL_BIAS_TYPES] })
                    }
                  >
                    All
                  </button>
                  <button
                    className="text-xs text-slate-500"
                    onClick={() => void save({ enabledCategories: [] })}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
                {ALL_BIAS_TYPES.map((t) => {
                  const meta = BIAS_TAXONOMY[t];
                  const on = settings.enabledCategories.includes(t);
                  return (
                    <label
                      key={t}
                      className="flex cursor-pointer gap-2 rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const set = new Set(settings.enabledCategories);
                          if (on) set.delete(t);
                          else set.add(t);
                          void save({
                            enabledCategories: [...set] as BiasType[],
                          });
                        }}
                      />
                      <span>
                        <span className="font-medium">{meta.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {meta.shortDefinition}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="bn-label" htmlFor="minConf">
                Minimum confidence in panel (
                {((settings.minConfidence ?? 0) * 100).toFixed(0)}%)
              </label>
              <input
                id="minConf"
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={settings.minConfidence ?? 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minConfidence: Number(e.target.value),
                  })
                }
                onMouseUp={() =>
                  void save({ minConfidence: settings.minConfidence })
                }
                className="w-full"
              />
              <p className="mt-1 text-xs text-slate-500">
                Hide lower-confidence signals by default. Side panel can still
                raise the floor temporarily.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.clusterPanel !== false}
                onChange={(e) => void save({ clusterPanel: e.target.checked })}
              />
              Cluster nearby same-type signals in the side panel
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="bn-label">Domain whitelist (optional)</label>
                <textarea
                  className="bn-input min-h-[80px] font-mono text-xs"
                  placeholder="nytimes.com&#10;bbc.com"
                  value={settings.domainWhitelist.join("\n")}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      domainWhitelist: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  onBlur={() =>
                    void save({ domainWhitelist: settings.domainWhitelist })
                  }
                />
              </div>
              <div>
                <label className="bn-label">Domain blacklist</label>
                <textarea
                  className="bn-input min-h-[80px] font-mono text-xs"
                  placeholder="example.com"
                  value={settings.domainBlacklist.join("\n")}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      domainBlacklist: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  onBlur={() =>
                    void save({ domainBlacklist: settings.domainBlacklist })
                  }
                />
              </div>
            </div>
          </section>
        )}

        {tab === "appearance" && (
          <AppearancePanel settings={settings} onSave={save} onLocal={setSettings} />
        )}

        {tab === "privacy" && (
          <section className="bn-card space-y-4 p-5">
            <h2 className="bn-section-title">Privacy controls</h2>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.neverSendFullText}
                onChange={(e) =>
                  void save({ neverSendFullText: e.target.checked })
                }
              />
              <span>
                <strong>Never send full article text</strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Limited mode sends a short excerpt only (or uses local
                  heuristics if no key).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.enableCache}
                onChange={(e) => void save({ enableCache: e.target.checked })}
              />
              <span>
                <strong>Local analysis cache</strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Cache by URL + content hash in chrome.storage.local. Use Force
                  re-scan to bypass.
                </span>
              </span>
            </label>
            {settings.enableCache && (
              <div>
                <label className="bn-label" htmlFor="cacheTtl">
                  Cache TTL (hours): {settings.cacheTtlHours ?? 72}
                </label>
                <input
                  id="cacheTtl"
                  type="range"
                  min={1}
                  max={168}
                  step={1}
                  value={settings.cacheTtlHours ?? 72}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cacheTtlHours: Number(e.target.value),
                    })
                  }
                  onMouseUp={() =>
                    void save({ cacheTtlHours: settings.cacheTtlHours })
                  }
                  className="w-full"
                />
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.optInTelemetry}
                onChange={(e) => void save({ optInTelemetry: e.target.checked })}
              />
              <span>
                <strong>Opt-in anonymous feedback contribution</strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Disabled by default. v1 stores feedback locally only; future
                  versions may allow optional anonymous contribution to improve
                  detection — never includes article full text without separate
                  consent.
                </span>
              </span>
            </label>
            <button
              className="bn-btn-secondary text-red-600 dark:text-red-400"
              onClick={async () => {
                if (
                  !confirm(
                    "Clear all Bias Noticer local data (settings, cache, feedback)?"
                  )
                ) {
                  return;
                }
                await clearAllLocalData();
                setSettings(DEFAULT_SETTINGS);
                setStatus("Local data cleared");
              }}
            >
              Clear all local data
            </button>
          </section>
        )}

        {tab === "advanced" && (
          <section className="bn-card space-y-4 p-5">
            <h2 className="bn-section-title">Custom detection lens</h2>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              Editing the system prompt can increase false positives or break JSON
              output. Reset anytime.
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.useCustomPrompt}
                onChange={(e) => void save({ useCustomPrompt: e.target.checked })}
              />
              Use custom system prompt
            </label>
            <textarea
              className="bn-input min-h-[280px] font-mono text-xs"
              disabled={!settings.useCustomPrompt}
              value={
                settings.useCustomPrompt
                  ? settings.customSystemPrompt || DEFAULT_SYSTEM_PROMPT
                  : DEFAULT_SYSTEM_PROMPT
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  customSystemPrompt: e.target.value,
                })
              }
              onBlur={() =>
                settings.useCustomPrompt &&
                void save({ customSystemPrompt: settings.customSystemPrompt })
              }
            />
            <button
              className="bn-btn-secondary"
              onClick={() =>
                void save({
                  customSystemPrompt: DEFAULT_SYSTEM_PROMPT,
                  useCustomPrompt: false,
                })
              }
            >
              Reset to default prompt
            </button>
          </section>
        )}

        {tab === "methodology" && <MethodologyPanel />}
      </div>
    </div>
  );
}

function AppearancePanel({
  settings,
  onSave,
  onLocal,
}: {
  settings: ExtensionSettings;
  onSave: (p: Partial<ExtensionSettings>) => void;
  onLocal: (s: ExtensionSettings) => void;
}) {
  const previewStyle = useMemo(() => {
    const intensity = settings.highlightIntensity;
    return {
      underline: {
        textDecorationLine: "underline" as const,
        textDecorationStyle: "wavy" as const,
        textDecorationColor: `rgba(244, 63, 94, ${intensity})`,
        textUnderlineOffset: "3px",
      },
      tint: {
        background: `rgba(244, 63, 94, ${0.22 * intensity})`,
        borderRadius: 2,
      },
      border: {
        boxShadow: `inset 3px 0 0 0 rgba(244, 63, 94, ${0.9 * intensity})`,
        background: `rgba(244, 63, 94, ${0.1 * intensity})`,
        paddingLeft: 4,
      },
      icon: {
        background: `rgba(244, 63, 94, ${0.14 * intensity})`,
      },
      glow: {
        background: `rgba(0, 240, 255, ${0.12 * intensity})`,
        boxShadow: `0 0 0 1px rgba(0, 240, 255, ${0.35 * intensity}), 0 0 10px rgba(0, 240, 255, ${0.4 * intensity})`,
        borderRadius: 2,
      },
    }[settings.highlightStyle];
  }, [settings.highlightStyle, settings.highlightIntensity]);

  function applyPreset(id: HighlightPreset) {
    if (id === "custom") {
      void onSave({ highlightPreset: "custom" });
      return;
    }
    const p = HIGHLIGHT_PRESETS[id];
    void onSave({
      highlightPreset: id,
      highlightStyle: p.highlightStyle,
      highlightIntensity: p.highlightIntensity,
      ...(p.themeHint ? { theme: p.themeHint } : {}),
    });
  }

  return (
    <section className="bn-card space-y-4 p-5">
      <h2 className="bn-section-title">Appearance</h2>
      <div>
        <label className="bn-label">Curated presets</label>
        <div className="flex flex-wrap gap-2">
          {(
            Object.keys(HIGHLIGHT_PRESETS) as Array<
              keyof typeof HIGHLIGHT_PRESETS
            >
          ).map((id) => (
            <button
              key={id}
              className={
                settings.highlightPreset === id
                  ? "bn-btn-primary"
                  : "bn-btn-secondary"
              }
              onClick={() => applyPreset(id)}
              title={HIGHLIGHT_PRESETS[id].description}
            >
              {HIGHLIGHT_PRESETS[id].label}
            </button>
          ))}
          <button
            className={
              settings.highlightPreset === "custom"
                ? "bn-btn-primary"
                : "bn-btn-secondary"
            }
            onClick={() => applyPreset("custom")}
          >
            Custom
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Presets avoid decision paralysis; switch to Custom for full control.
        </p>
      </div>
      <div>
        <label className="bn-label">Theme</label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
              ["they_live", "They Live Retro"],
            ] as [ThemeMode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={
                settings.theme === id ? "bn-btn-primary" : "bn-btn-secondary"
              }
              onClick={() => void onSave({ theme: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="bn-label">Highlight style</label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["underline", "Wavy underline"],
              ["tint", "Soft tint"],
              ["border", "Left border"],
              ["icon", "Icon + tint"],
              ["glow", "Soft glow"],
            ] as [HighlightStyle, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={
                settings.highlightStyle === id
                  ? "bn-btn-primary"
                  : "bn-btn-secondary"
              }
              onClick={() =>
                void onSave({
                  highlightStyle: id,
                  highlightPreset: "custom",
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="bn-label" htmlFor="intensity">
          Intensity ({settings.highlightIntensity.toFixed(2)})
        </label>
        <input
          id="intensity"
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={settings.highlightIntensity}
          onChange={(e) =>
            onLocal({
              ...settings,
              highlightIntensity: Number(e.target.value),
              highlightPreset: "custom",
            })
          }
          onMouseUp={() =>
            void onSave({
              highlightIntensity: settings.highlightIntensity,
              highlightPreset: "custom",
            })
          }
          className="w-full"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enableShadesAnimation}
          onChange={(e) =>
            void onSave({ enableShadesAnimation: e.target.checked })
          }
        />
        Shades-activated reveal animation (scanlines / lens flare)
      </label>
      <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
        <div className="bn-label">Live preview</div>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          The committee{" "}
          <mark style={previewStyle}>
            {settings.highlightStyle === "icon" ? "⚡ " : ""}
            slammed the proposal as a radical power grab
          </mark>{" "}
          that would destroy local control — according to critics.
        </p>
      </div>
    </section>
  );
}

function MethodologyPanel() {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <section className="bn-card space-y-4 p-5 prose-sm">
      <h2 className="bn-section-title">How bias detection works</h2>
      <Disclaimer />
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        Bias Noticer surfaces{" "}
        <strong>rhetorical techniques and framing choices</strong>, not a
        left/right score. The model acts as <strong>BiasExpert</strong> (prompt
        v{PROMPT_VERSION}) — directionally agnostic, prefer under-flagging
        vivid-but-accurate prose.
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="bn-label">Data flow</div>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-700 dark:text-slate-200">
          <li>
            <strong>Extract</strong> — Readability + JSON-LD + paragraph
            fallbacks (local only).
          </li>
          <li>
            <strong>Quick heuristics</strong> (optional hybrid) — instant
            low-confidence pattern marks.
          </li>
          <li>
            <strong>Grok / BiasExpert</strong> — BYOK call to api.x.ai with
            strict JSON schema + few-shot taxonomy.
          </li>
          <li>
            <strong>Filter</strong> — sensitivity, categories, min confidence
            on-device.
          </li>
          <li>
            <strong>Highlight</strong> — non-destructive{" "}
            <code className="text-xs">HighlightManager</code> wraps (unique IDs).
          </li>
          <li>
            <strong>Side panel</strong> — explanations, evidence, rewrites,
            feedback.
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-slate-500">
          Your API key never leaves this browser except as an Authorization
          header to api.x.ai. Analysis cache stays in chrome.storage.local.
        </p>
      </div>

      <h3 className="font-semibold">
        Taxonomy ({ALL_BIAS_TYPES.length} types)
      </h3>
      <ul className="space-y-3 text-sm">
        {ALL_BIAS_TYPES.map((t) => (
          <li key={t}>
            <strong style={{ color: BIAS_TAXONOMY[t].hex }}>
              {BIAS_TAXONOMY[t].label}
            </strong>
            : {BIAS_TAXONOMY[t].shortDefinition}
            <ul className="mt-1 text-[11px] text-slate-500">
              <li>· {BIAS_TAXONOMY[t].examples[0]}</li>
              <li>· {BIAS_TAXONOMY[t].examples[1]}</li>
            </ul>
          </li>
        ))}
      </ul>

      <div>
        <button
          className="bn-btn-secondary text-xs"
          onClick={() => setShowPrompt((v) => !v)}
        >
          {showPrompt ? "Hide" : "View"} full system prompt (v{PROMPT_VERSION})
        </button>
        {showPrompt && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-100">
            {DEFAULT_SYSTEM_PROMPT}
          </pre>
        )}
      </div>

      <h3 className="font-semibold">What we never do</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Auto-block, censor, or rewrite the page without your action.</li>
        <li>Sell user data or train on your articles by default.</li>
        <li>Claim infallibility or replace human judgment.</li>
      </ul>
    </section>
  );
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Put on the shades",
      body: "Open a news or long-form article, click the Bias Noticer icon, and hit “Put on shades” — or press Ctrl/⌘+Shift+B. Watch the subtle scanline reveal as signals paint onto the page.",
    },
    {
      title: "Pin for daily use",
      body: "Click the puzzle piece in Chrome → pin Bias Noticer. One click keeps critical-reading tools one gesture away — the #1 habit for retention.",
    },
    {
      title: "Read the signals",
      body: "Highlights mark rhetorical techniques, not “wrongthink.” Hover for a quick explanation; open the side panel for Summary, Evidence, Glossary, and Feedback tabs.",
    },
    {
      title: "Bring your own key",
      body: "Full BiasExpert analysis uses the xAI Grok API with your key (stored only locally). Without a key, local heuristics still give a lightweight scan. Hybrid mode paints quick signals while Grok runs.",
    },
    {
      title: "You stay in control",
      body: "Tune sensitivity, categories, privacy, highlight presets (Minimal / Balanced / They Live), and confidence floors anytime. Feedback stays local unless you opt in later.",
    },
  ];
  const s = steps[step]!;
  return (
    <section className="bn-card p-6">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
        Onboarding · {step + 1}/{steps.length}
      </div>
      <div className="mb-3 flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>
      <SunglassesIcon className="mb-3 h-14 w-14" glow />
      <h2 className="font-display text-xl font-bold">{s.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {s.body}
      </p>
      {step === 1 && (
        <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-950/40 dark:text-brand-100">
          <strong>Pin nudge:</strong> Extensions → puzzle icon → pin 📌 Bias
          Noticer. You will thank yourself on the next long article.
        </div>
      )}
      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <button
            className="bn-btn-secondary"
            onClick={() => setStep((x) => x - 1)}
          >
            Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            className="bn-btn-primary"
            onClick={() => setStep((x) => x + 1)}
          >
            Next
          </button>
        ) : (
          <button className="bn-btn-primary" onClick={onDone}>
            Start noticing
          </button>
        )}
      </div>
    </section>
  );
}
