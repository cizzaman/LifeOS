"use client";
import { useState } from "react";

export interface FreshnessFile {
  name: string;
  date: string | null;
  source: "state" | "content" | "filename" | "mtime" | "unknown";
}
export interface FreshnessData {
  dataDate: string | null;
  label: string;
  daysOld: number | null;
  tier: "fresh" | "aging" | "stale" | "unknown";
  perFile: FreshnessFile[];
}

function formatAge(daysOld: number | null): string {
  if (daysOld == null) return "—";
  if (daysOld < 1) return "today";
  if (daysOld < 2) return "1 day old";
  if (daysOld < 60) return `${daysOld} days old`;
  const months = Math.round(daysOld / 30);
  if (months < 12) return `${months} mo old`;
  const years = (daysOld / 365).toFixed(1);
  return `${years} yr old`;
}

const TIER_STYLE: Record<FreshnessData["tier"], { key: string | null; label: string }> = {
  fresh:   { key: "var(--ok)",    label: "Fresh" },
  aging:   { key: "var(--warn)",  label: "Aging" },
  stale:   { key: "var(--err)",   label: "Stale" },
  unknown: { key: null,           label: "Unknown" },
};

export function FreshnessIndicator({
  freshness,
  className = "",
  compact = false,
}: {
  freshness: FreshnessData | null | undefined;
  className?: string;
  /** Drop the `· N of M sources dated` inline label so the pill stays narrow
   *  when mounted in chrome. Hover tooltip still shows full per-source list. */
  compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  if (!freshness) {
    return (
      <div className={`inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-3 ${className}`}>
        No date info
      </div>
    );
  }
  const style = TIER_STYLE[freshness.tier];
  const dated = freshness.perFile.filter(f => f.date);
  const undated = freshness.perFile.filter(f => !f.date);
  const sorted = [...dated].sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const top = sorted.slice(0, 6);

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 mono text-[10px] uppercase tracking-[0.1em] leading-[1.5] text-ink-2 cursor-default"
        aria-label={`Data freshness: ${style.label} — ${formatAge(freshness.daysOld)}`}
      >
        {style.key && <span className="fig-key" style={{ color: style.key }} aria-hidden />}
        <span>{style.label}</span>
        <span className="text-ink-3">· {formatAge(freshness.daysOld)}</span>
        {!compact && freshness.label && freshness.label !== "No date info" && (
          <span className="text-ink-3">· {freshness.label}</span>
        )}
      </div>

      {hover && dated.length > 0 && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-32px)] rounded-[10px] border border-line-3 bg-surface-1 p-3">
          <div className="label-caps mb-2">
            Data sources
          </div>
          <div className="flex flex-col gap-1">
            {top.map((f) => (
              <div key={f.name} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-ink-2 break-words min-w-0">{f.name}</span>
                <span className="mono text-ink-3 shrink-0">{f.date}</span>
              </div>
            ))}
          </div>
          {undated.length > 0 && (
            <div className="mt-2 pt-2 border-t border-line-2 text-[11px] text-ink-3">
              {undated.length} file{undated.length === 1 ? "" : "s"} without a date
            </div>
          )}
        </div>
      )}
    </div>
  );
}
