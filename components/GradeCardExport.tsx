import { useState } from "react";
import {
  copyText,
  downloadGradeCard,
  gradeCardTweetText,
  type GradeCardFormat,
  type GradeCardModel,
} from "../lib/grade-card";

interface Props {
  model: GradeCardModel;
  compact?: boolean;
}

export function GradeCardExport({ model, compact = false }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  async function save(format: GradeCardFormat) {
    try {
      await downloadGradeCard(model, format);
      setStatus(
        format === "jpeg"
          ? "Saved JPEG on this device"
          : "Saved PNG on this device"
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not export card");
    }
    window.setTimeout(() => setStatus(null), 2800);
  }

  async function copyCaption() {
    const ok = await copyText(gradeCardTweetText(model));
    setStatus(ok ? "Caption copied — attach the image on X" : "Copy failed");
    window.setTimeout(() => setStatus(null), 2800);
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="bn-btn-primary text-xs"
          onClick={() => void save("png")}
          title="Download a 1200×630 PNG. Built on this device — no upload."
        >
          Grade card PNG
        </button>
        <button
          type="button"
          className="bn-btn-secondary text-xs"
          onClick={() => void save("jpeg")}
          title="Smaller JPEG for tweet attachments. Still local."
        >
          JPEG
        </button>
        <button
          type="button"
          className="bn-btn-ghost text-xs"
          onClick={() => void copyCaption()}
          title="Copy a caption that does not include article body text"
        >
          Copy caption
        </button>
      </div>
      <p className="text-[10px] leading-snug text-slate-500">
        Share card is rendered in this panel. Title, host, letter grade, and
        technique <em>names</em> only — no article text leaves the device.
      </p>
      {status && (
        <p className="text-[11px] font-medium text-brand-600 dark:text-brand-400" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
