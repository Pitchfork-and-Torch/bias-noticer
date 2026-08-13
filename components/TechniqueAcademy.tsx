/**
 * Technique Academy — interactive media literacy (lessons, drills, live page).
 * Local-only progress. Directionally agnostic.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BiasInstance, BiasType } from "../lib/types";
import {
  academyStats,
  buildDrillBank,
  buildLessons,
  drillsFromLiveInstances,
  loadAcademyProgress,
  markLessonComplete,
  optionLabel,
  pickAdaptiveDrill,
  recordDrillAnswer,
  recordLiveSpot,
  shuffleOptions,
  type AcademyMode,
  type AcademyProgress,
  type DrillQuestion,
} from "../lib/academy";
import { CategoryBadge } from "./CategoryBadge";
import { getCategoryMeta } from "../lib/taxonomy";

interface TechniqueAcademyProps {
  /** Live signals from current analysis (optional) */
  instances?: BiasInstance[];
  onJumpToSignal?: (instanceId: string) => void;
  className?: string;
}

export function TechniqueAcademy({
  instances = [],
  onJumpToSignal,
  className = "",
}: TechniqueAcademyProps) {
  const lessons = useMemo(() => buildLessons(), []);
  const curatedBank = useMemo(() => buildDrillBank(), []);
  const [mode, setMode] = useState<AcademyMode>("lessons");
  const [progress, setProgress] = useState<AcademyProgress | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [activeDrill, setActiveDrill] = useState<DrillQuestion | null>(null);
  const [drillOptions, setDrillOptions] = useState<
    Array<BiasType | "none">
  >([]);
  const [picked, setPicked] = useState<BiasType | "none" | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [liveFilter, setLiveFilter] = useState<BiasType | "all">("all");
  const [liveGuess, setLiveGuess] = useState<BiasType | null>(null);
  const [liveTarget, setLiveTarget] = useState<BiasInstance | null>(null);

  const drillBank = useMemo(() => {
    const fromLive = drillsFromLiveInstances(instances);
    return [...fromLive, ...curatedBank];
  }, [instances, curatedBank]);

  useEffect(() => {
    void loadAcademyProgress().then(setProgress);
  }, []);

  const stats = useMemo(
    () =>
      progress
        ? academyStats(progress, lessons.length)
        : academyStats(
            {
              completedLessons: [],
              correctDrills: [],
              drillAttempts: 0,
              drillCorrect: 0,
              updatedAt: "",
            },
            lessons.length
          ),
    [progress, lessons.length]
  );

  const preferTypes = useMemo(() => {
    const counts = new Map<BiasType, number>();
    for (const i of instances) {
      counts.set(i.bias_type, (counts.get(i.bias_type) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);
  }, [instances]);

  const lesson = lessons[lessonIndex] ?? lessons[0]!;
  const drill = activeDrill;

  const loadAdaptiveDrill = useCallback(() => {
    const q = pickAdaptiveDrill(
      drillBank,
      progress || {
        completedLessons: [],
        correctDrills: [],
        drillAttempts: 0,
        drillCorrect: 0,
        updatedAt: "",
      },
      preferTypes
    );
    if (!q) return;
    setActiveDrill(q);
    setDrillOptions(shuffleOptions(q.options));
    setPicked(null);
    setRevealed(false);
  }, [drillBank, progress, preferTypes]);

  useEffect(() => {
    if (mode === "drill" && !activeDrill && drillBank.length) {
      loadAdaptiveDrill();
    }
  }, [mode, activeDrill, drillBank.length, loadAdaptiveDrill]);

  // Jump to first incomplete lesson when progress loads
  useEffect(() => {
    if (!progress) return;
    if (progress.lastLessonId) {
      const i = lessons.findIndex((l) => l.id === progress.lastLessonId);
      if (i >= 0) setLessonIndex(i);
    }
  }, [progress, lessons]);

  const liveByType = useMemo(() => {
    const m = new Map<BiasType, BiasInstance[]>();
    for (const inst of instances) {
      const list = m.get(inst.bias_type) ?? [];
      list.push(inst);
      m.set(inst.bias_type, list);
    }
    return m;
  }, [instances]);

  const liveList = useMemo(() => {
    if (liveFilter === "all") return instances;
    return instances.filter((i) => i.bias_type === liveFilter);
  }, [instances, liveFilter]);

  async function completeLesson() {
    const next = await markLessonComplete(lesson.id);
    setProgress(next);
  }

  async function answerDrill(opt: BiasType | "none") {
    if (!drill || revealed) return;
    setPicked(opt);
    setRevealed(true);
    const ok = opt === drill.answer;
    const next = await recordDrillAnswer(drill.id, ok, drill.answer);
    setProgress(next);
  }

  function nextDrill() {
    loadAdaptiveDrill();
  }

  async function answerLiveSpot(opt: BiasType) {
    if (!liveTarget) return;
    setLiveGuess(opt);
    const ok = opt === liveTarget.bias_type;
    const next = await recordLiveSpot(liveTarget.bias_type, ok);
    setProgress(next);
  }

  const modes: { id: AcademyMode; label: string }[] = [
    { id: "lessons", label: "Lessons" },
    { id: "drill", label: "Drill" },
    { id: "live", label: "Live page" },
    { id: "glossary", label: "Glossary" },
  ];

  return (
    <section className={`space-y-3 animate-fade-in ${className}`} role="tabpanel">
      <div className="bn-card space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Technique Academy</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Learn the sunglasses. Techniques only — no left/right score.
              Progress stays on this device.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            Train
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <span>
            Lessons{" "}
            <strong>
              {stats.lessonsDone}/{stats.lessonCount}
            </strong>{" "}
            ({stats.lessonPct}%)
          </span>
          <span>
            Drills{" "}
            <strong>
              {stats.drillCorrect}/{stats.drillAttempts || 0}
            </strong>
            {stats.drillRate != null ? ` · ${stats.drillRate}%` : ""}
          </span>
          <span>
            Streak <strong>{stats.streakDays || 0}</strong>d
          </span>
          <span>
            Mastery avg <strong>{stats.avgMastery || 0}</strong>
            {stats.masteredTechniques
              ? ` · ${stats.masteredTechniques} adept+`
              : ""}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={stats.lessonPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Lesson completion"
        >
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${stats.lessonPct}%` }}
          />
        </div>

        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
                mode === m.id
                  ? "bg-white shadow dark:bg-slate-700"
                  : "text-slate-500"
              }`}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
            >
              {m.label}
              {m.id === "live" && instances.length
                ? ` (${instances.length})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      {mode === "lessons" && (
        <div className="bn-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="bn-btn-ghost px-2 py-1 text-xs"
              disabled={lessonIndex <= 0}
              onClick={() => setLessonIndex((i) => Math.max(0, i - 1))}
            >
              ← Prev
            </button>
            <span className="text-[11px] tabular-nums text-slate-500">
              {lessonIndex + 1} / {lessons.length}
            </span>
            <button
              type="button"
              className="bn-btn-ghost px-2 py-1 text-xs"
              disabled={lessonIndex >= lessons.length - 1}
              onClick={() =>
                setLessonIndex((i) => Math.min(lessons.length - 1, i + 1))
              }
            >
              Next →
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
              style={{
                backgroundColor: `${lesson.hex}22`,
                color: lesson.hex,
              }}
              aria-hidden
            >
              {lesson.icon}
            </span>
            <div>
              <h3 className="text-base font-bold">{lesson.title}</h3>
              {progress?.completedLessons.includes(lesson.id) && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ✓ Completed
                </span>
              )}
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {lesson.definition}
          </p>

          <div>
            <div className="bn-label">Why it matters</div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {lesson.whyItMatters}
            </p>
          </div>

          <div>
            <div className="bn-label">How to spot</div>
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              {lesson.howToSpot.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">
                Mild
              </div>
              <p className="mt-1 text-xs leading-relaxed">{lesson.mildExample}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">
                Strong
              </div>
              <p className="mt-1 text-xs leading-relaxed">
                {lesson.strongExample}
              </p>
            </div>
          </div>

          <div>
            <div className="bn-label">Counter-move</div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {lesson.counterMove}
            </p>
          </div>

          {/* Live examples for this technique */}
          {(liveByType.get(lesson.type)?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-cyan-200/80 bg-cyan-50/50 p-2.5 dark:border-cyan-500/30 dark:bg-cyan-950/30">
              <div className="text-[10px] font-semibold uppercase text-cyan-800 dark:text-cyan-300">
                On this page
              </div>
              <ul className="mt-1 space-y-1">
                {liveByType.get(lesson.type)!.slice(0, 3).map((inst) => (
                  <li key={inst.id}>
                    <button
                      type="button"
                      className="w-full truncate text-left text-xs text-cyan-900 underline dark:text-cyan-100"
                      onClick={() => onJumpToSignal?.(inst.id)}
                    >
                      “{inst.span_text.slice(0, 90)}
                      {inst.span_text.length > 90 ? "…" : ""}”
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="bn-btn-primary text-xs"
              onClick={() => void completeLesson()}
            >
              {progress?.completedLessons.includes(lesson.id)
                ? "Mark complete again"
                : "Mark lesson complete"}
            </button>
            <button
              type="button"
              className="bn-btn-secondary text-xs"
              onClick={() => {
                setMode("drill");
                loadAdaptiveDrill();
              }}
            >
              Practice drills
            </button>
          </div>

          {/* Lesson picker */}
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-500">
              Jump to technique
            </summary>
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      i === lessonIndex ? "bg-slate-100 dark:bg-slate-800" : ""
                    }`}
                    onClick={() => setLessonIndex(i)}
                  >
                    <span style={{ color: l.hex }}>{l.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {progress?.completedLessons.includes(l.id) && (
                      <span className="text-emerald-500">✓</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {mode === "drill" && drill && (
        <div className="bn-card space-y-3 p-4">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Adaptive drill · {drill.difficulty}
              {drill.id.startsWith("live_") ? " · from your scan" : " · gold bank"}
            </span>
            <button
              type="button"
              className="font-semibold text-brand-600 underline dark:text-brand-400"
              onClick={nextDrill}
            >
              Next
            </button>
          </div>

          <blockquote className="rounded-xl border-l-4 border-cyan-400 bg-slate-50 p-3 text-sm italic leading-relaxed dark:bg-slate-800/50">
            {drill.passage}
          </blockquote>

          <div
            className="grid gap-2"
            role="group"
            aria-label="Choose the rhetorical technique"
          >
            {drillOptions.map((opt) => {
              const isCorrect = opt === drill.answer;
              const isPicked = picked === opt;
              let cls =
                "rounded-xl border px-3 py-2 text-left text-xs font-medium transition ";
              if (!revealed) {
                cls +=
                  "border-slate-200 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950/30";
              } else if (isCorrect) {
                cls +=
                  "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
              } else if (isPicked) {
                cls +=
                  "border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100";
              } else {
                cls +=
                  "border-slate-100 opacity-60 dark:border-slate-800";
              }
              return (
                <button
                  key={String(opt)}
                  type="button"
                  className={cls}
                  disabled={revealed}
                  onClick={() => void answerDrill(opt)}
                >
                  {optionLabel(opt)}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div
              className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-800/50"
              role="status"
            >
              <p className="font-semibold">
                {picked === drill.answer ? "Correct." : "Not quite."} Answer:{" "}
                {optionLabel(drill.answer)}
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {drill.explanation}
              </p>
              <button
                type="button"
                className="bn-btn-primary mt-3 text-xs"
                onClick={nextDrill}
              >
                Next drill
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "live" && (
        <div className="space-y-2">
          <div className="bn-card space-y-2 p-3">
            <p className="text-xs text-slate-500">
              {instances.length
                ? "Techniques on the current scan — study in context or play spot-the-technique."
                : "No active scan. Put on shades first, then return here to learn from live examples."}
            </p>
            {instances.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="bn-btn-primary px-2 py-1 text-[11px]"
                    onClick={() => {
                      const pool =
                        liveFilter === "all"
                          ? instances
                          : instances.filter((i) => i.bias_type === liveFilter);
                      const pick =
                        pool[Math.floor(Math.random() * pool.length)];
                      setLiveTarget(pick || null);
                      setLiveGuess(null);
                    }}
                  >
                    Spot the technique
                  </button>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Filter
                    <select
                      className="bn-input text-xs"
                      value={liveFilter}
                      onChange={(e) =>
                        setLiveFilter(e.target.value as BiasType | "all")
                      }
                    >
                      <option value="all">All types</option>
                      {[...liveByType.keys()].map((t) => (
                        <option key={t} value={t}>
                          {getCategoryMeta(t).label} (
                          {liveByType.get(t)!.length})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {liveTarget && (
                  <LiveSpotQuiz
                    target={liveTarget}
                    distractors={preferTypes}
                    guess={liveGuess}
                    onGuess={(t) => void answerLiveSpot(t)}
                  />
                )}
              </>
            )}
          </div>

          {liveList.map((inst) => {
            const meta = getCategoryMeta(inst.bias_type);
            return (
              <article key={inst.id} className="bn-card space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge type={inst.bias_type} />
                  <span className="text-[10px] text-slate-400">
                    sev {inst.severity}/5 ·{" "}
                    {(inst.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <blockquote className="border-l-2 border-brand-400 pl-2 text-xs italic">
                  “{inst.span_text}”
                </blockquote>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-800 dark:text-slate-100">
                    Technique:
                  </strong>{" "}
                  {meta.shortDefinition}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {inst.detailed_explanation || inst.concise_explanation}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="bn-btn-secondary px-2 py-1 text-[11px]"
                    onClick={() => onJumpToSignal?.(inst.id)}
                  >
                    Jump in article
                  </button>
                  <button
                    type="button"
                    className="bn-btn-ghost px-2 py-1 text-[11px]"
                    onClick={() => {
                      const i = lessons.findIndex(
                        (l) => l.type === inst.bias_type
                      );
                      if (i >= 0) {
                        setLessonIndex(i);
                        setMode("lessons");
                      }
                    }}
                  >
                    Open lesson
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {mode === "glossary" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Directionally agnostic technique glossary. Full system prompt in
            Settings → Methodology.
          </p>
          {lessons.map((l) => (
            <details key={l.id} className="bn-card p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                <span style={{ color: l.hex }}>{l.icon}</span> {l.title}
                {progress?.completedLessons.includes(l.id) ? " · ✓" : ""}
              </summary>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {l.definition}
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                <li>· {l.mildExample}</li>
                <li>· {l.strongExample}</li>
              </ul>
              <button
                type="button"
                className="mt-2 text-[11px] font-semibold text-brand-600 underline dark:text-brand-400"
                onClick={() => {
                  const i = lessons.findIndex((x) => x.id === l.id);
                  if (i >= 0) {
                    setLessonIndex(i);
                    setMode("lessons");
                  }
                }}
              >
                Open full lesson
              </button>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function LiveSpotQuiz({
  target,
  distractors,
  guess,
  onGuess,
}: {
  target: BiasInstance;
  distractors: BiasType[];
  guess: BiasType | null;
  onGuess: (t: BiasType) => void;
}) {
  const options = useMemo(() => {
    const pool = [
      target.bias_type,
      ...distractors.filter((t) => t !== target.bias_type),
      "loaded_language" as BiasType,
      "omission_framing" as BiasType,
      "source_selection" as BiasType,
    ];
    const unique = [...new Set(pool)].slice(0, 4);
    return shuffleOptions(unique);
  }, [target.id, target.bias_type, distractors]);

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
        Live quiz — name the technique
      </p>
      <blockquote className="mt-1 border-l-2 border-cyan-400 pl-2 text-xs italic">
        “{target.span_text}”
      </blockquote>
      <div className="mt-2 grid gap-1.5">
        {options.map((t) => (
          <button
            key={t}
            type="button"
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-[11px] hover:border-brand-400 dark:border-slate-700"
            disabled={guess != null}
            onClick={() => onGuess(t)}
          >
            {getCategoryMeta(t).label}
          </button>
        ))}
      </div>
      {guess != null && (
        <p className="mt-2 text-[11px]" role="status">
          {guess === target.bias_type
            ? "Correct — mastery updated."
            : `Answer: ${getCategoryMeta(target.bias_type).label}.`}
        </p>
      )}
    </div>
  );
}
