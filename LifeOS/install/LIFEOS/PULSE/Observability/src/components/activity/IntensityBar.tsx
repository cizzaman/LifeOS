"use client";

import type { TimeRange } from "@/hooks/useChartData";
import { TabBar } from "@/components/ui/chrome";

interface IntensityBarProps {
  intensity: number;
  label: string;
  eventsPerMinute: number;
  timeRange: TimeRange;
  timeRanges: TimeRange[];
  onSetTimeRange: (range: TimeRange) => void;
}

export default function IntensityBar({
  intensity,
  label,
  eventsPerMinute,
  timeRange,
  timeRanges,
  onSetTimeRange,
}: IntensityBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
      {/* Events per minute */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="mono text-[15px] text-ink-1">{eventsPerMinute}</span>
        <span className="label-caps">ev/min</span>
      </div>

      {/* Intensity bar */}
      <div className="progress-bar relative flex-1 min-w-[120px]">
        <div
          className="progress-bar-fill"
          style={{ width: `${Math.max(5, intensity * 100)}%` }}
          title={`Activity: ${label} (${Math.round(intensity * 100)}%)`}
        />
      </div>

      {/* Time range selector */}
      {timeRanges.length > 0 && (
        <TabBar
          className="shrink-0"
          tabs={timeRanges.map((range) => ({ id: range, label: range }))}
          active={timeRange}
          onChange={onSetTimeRange}
        />
      )}
    </div>
  );
}
