"use client";

import { useRef, useEffect, useMemo } from "react";
import type { RatingPulse } from "@/types/algorithm";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatTimeRange(first: number, last: number): string {
  const d1 = new Date(first);
  const d2 = new Date(last);
  return `${d1.getHours()}:${String(d1.getMinutes()).padStart(2, "0")} – ${d2.getHours()}:${String(d2.getMinutes()).padStart(2, "0")}`;
}

type MoodTier = { label: string; icon: string };

function getMood(avg: number): MoodTier {
  if (avg >= 9) return { label: "Euphoric", icon: "◆" };
  if (avg >= 7) return { label: "Pleased", icon: "▲" };
  if (avg >= 5) return { label: "Neutral", icon: "●" };
  if (avg >= 3) return { label: "Frustrated", icon: "▼" };
  return { label: "Stormy", icon: "▼▼" };
}

function getTrend(pulses: RatingPulse[]): { arrow: string; label: string } {
  if (pulses.length < 4) return { arrow: "–", label: "Too few" };
  const half = Math.floor(pulses.length / 2);
  const firstHalf = pulses.slice(0, half);
  const secondHalf = pulses.slice(half);
  const avg1 = firstHalf.reduce((s, p) => s + p.value, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((s, p) => s + p.value, 0) / secondHalf.length;
  const delta = avg2 - avg1;
  if (delta > 1.5) return { arrow: "↑", label: "Improving" };
  if (delta > 0.5) return { arrow: "↗", label: "Rising" };
  if (delta < -1.5) return { arrow: "↓", label: "Declining" };
  if (delta < -0.5) return { arrow: "↘", label: "Dipping" };
  return { arrow: "→", label: "Steady" };
}

interface QuickPulseStripProps {
  pulses: RatingPulse[];
}

export default function QuickPulseStrip({ pulses }: QuickPulseStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [pulses.length]);

  const avg = useMemo(() => {
    if (!pulses || pulses.length === 0) return 0;
    return pulses.reduce((sum, p) => sum + p.value, 0) / pulses.length;
  }, [pulses]);

  const trend = useMemo(() => getTrend(pulses || []), [pulses]);

  if (!pulses || pulses.length === 0) return null;

  // Below 3 ratings a mood verdict is noise, not signal (2026-07-14 review:
  // the strip declared "Frustrated" off one stale rating). Render a quiet
  // single-line note instead.
  if (pulses.length < 3) {
    const last = pulses[pulses.length - 1];
    return (
      <div className="px-4 py-2 border-b border-line-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="mono text-[13px] text-ink-1">{last.value}/10</span>
        <span className="text-[13px] text-ink-3">
          {pulses.length} rating{pulses.length > 1 ? "s" : ""} in the last 24h
          {last.message ? ` — “${last.message}”` : ""}
        </span>
        <span className="mono text-[11px] text-ink-3 ml-auto">{formatRelative(last.timestamp)}</span>
      </div>
    );
  }

  const mood = getMood(avg);
  const timeRange = formatTimeRange(pulses[0].timestamp, pulses[pulses.length - 1].timestamp);
  const lo = Math.min(...pulses.map((p) => p.value));
  const hi = Math.max(...pulses.map((p) => p.value));

  return (
    <div className="px-4 py-2 border-b border-line-2">
      <div className="flex items-center gap-4">

        {/* Mood + Score */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="mono text-[20px] leading-none text-ink-1">
              {avg.toFixed(1)}
            </span>
            <span className="mono text-[11px] text-ink-3">/10</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="label-caps leading-none">
              {mood.icon} {mood.label}
            </span>
            <span className="text-[12px] leading-none text-ink-3">
              {trend.arrow} {trend.label}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-line-2 shrink-0" />

        {/* Sparkline bar chart */}
        <div
          ref={scrollRef}
          className="flex items-end gap-px overflow-x-auto scrollbar-none flex-1 h-7"
        >
          {pulses.map((pulse, i) => {
            const heightPct = Math.max(10, (pulse.value / 10) * 100);
            return (
              <div
                key={`${pulse.timestamp}-${i}`}
                className="group relative shrink-0 flex items-end"
                style={{ height: "100%" }}
              >
                <div
                  className="w-2.5 border border-[color:var(--accent-blue)] bg-[color:var(--primary-soft)] hover:bg-[color:var(--accent-blue)] transition-colors cursor-default"
                  style={{
                    height: `${heightPct}%`,
                    animation: i === pulses.length - 1 ? "bar-grow 300ms ease-out" : undefined,
                  }}
                />
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-2 rounded-[10px] bg-surface-1 border border-line-3 text-xs text-ink-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 min-w-[180px] max-w-[280px]">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="mono text-[13px] text-ink-1">
                      {pulse.value}/10
                    </span>
                    <span className="mono text-ink-3 text-[11px]">{formatTime(pulse.timestamp)}</span>
                  </div>
                  {pulse.message && (
                    <div className="text-ink-2 text-[13px] leading-snug line-clamp-2">
                      {pulse.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-line-2 shrink-0" />

        {/* Stats */}
        <div className="flex flex-col gap-0.5 shrink-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="label-caps text-ink-3">Range</span>
            <span className="mono text-[11px] text-ink-2">{lo}–{hi}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="label-caps text-ink-3">Count</span>
            <span className="mono text-[11px] text-ink-2">{pulses.length}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="label-caps text-ink-3">Span</span>
            <span className="mono text-[11px] text-ink-2">{timeRange}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bar-grow {
          0% { height: 0%; opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
