"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { HookEvent } from "@/hooks/useAgentEvents";
import { useChartData, type TimeRange } from "@/hooks/useChartData";
import { useAdvancedMetrics } from "@/hooks/useAdvancedMetrics";
import { useHeatLevel } from "@/hooks/useHeatLevel";
import { createChartRenderer, chartColorsFromTokens, agentColor, type ChartDimensions, type ChartConfig } from "./ChartRenderer";
import { Loader2 } from "lucide-react";

// ─── Format Helpers ───

function formatTokens(tokens: number): string {
  if (tokens === 0) return "~0";
  if (tokens >= 1_000_000) return `~${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 10_000) return `~${Math.round(tokens / 1000)}K`;
  if (tokens >= 1000) return `~${(tokens / 1000).toFixed(1)}K`;
  return `~${tokens}`;
}

// ─── Props ───

interface LivePulseChartProps {
  events: HookEvent[];
  externalTimeRange?: TimeRange;
  onHeatUpdate?: (data: { intensity: number; label: string }) => void;
  onEventsPerMinuteUpdate?: (epm: number) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
  onAllAgentsUpdate?: (ids: string[]) => void;
  onAgentPillClick?: (agentId: string) => void;
}

// ─── Component ───

export default function LivePulseChart({
  events,
  externalTimeRange,
  onHeatUpdate,
  onEventsPerMinuteUpdate,
  onTimeRangeChange,
  onAllAgentsUpdate,
  onAgentPillClick,
}: LivePulseChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ReturnType<typeof createChartRenderer> | null>(null);
  const processedIdsRef = useRef(new Set<string>());
  const renderLoopRef = useRef<number | null>(null);
  const [chartHeight] = useState(260);

  const {
    timeRange,
    dataPoints,
    addEvent,
    getChartData,
    setTimeRange,
    clearData,
    currentConfig,
    uniqueAgentIdsInWindow,
    allUniqueAgentIds,
    allEvents,
  } = useChartData();

  const { eventsPerMinute, totalTokens, topTools, skillsAndWorkflows, agentActivity, estimatedCost } =
    useAdvancedMetrics(allEvents, dataPoints, timeRange, currentConfig);

  const activeAgentCount = agentActivity.length;
  const heat = useHeatLevel(eventsPerMinute, activeAgentCount);

  // Stable agent names
  const seenAgentsRef = useRef(new Set<string>());

  const hasUserEvents = useMemo(() => allEvents.some((e) => e.hook_event_type === "UserPromptSubmit"), [allEvents]);

  const stableAgentNames = useMemo(() => {
    if (hasUserEvents) seenAgentsRef.current.add("User");
    allUniqueAgentIds.forEach((id) => {
      const name = id.split(":")[0];
      seenAgentsRef.current.add(name.charAt(0).toUpperCase() + name.slice(1));
    });
    return Array.from(seenAgentsRef.current).sort();
  }, [allUniqueAgentIds, hasUserEvents]);

  // Agent action counts
  const agentActionCounts = useMemo(() => {
    const now = Date.now();
    const cutoff = now - currentConfig.duration;
    const counts: Record<string, number> = {};
    allEvents.forEach((e) => {
      if (e.timestamp && e.timestamp >= cutoff) {
        const raw = e.agent_name || e.source_app || "unknown";
        const name = raw.charAt(0).toUpperCase() + raw.slice(1);
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return counts;
  }, [allEvents, currentConfig.duration]);

  const isAgentActive = useCallback(
    (name: string): boolean => {
      if (name === "User") {
        const now = Date.now();
        return allEvents.some(
          (e) => e.hook_event_type === "UserPromptSubmit" && e.timestamp && now - e.timestamp < 30000
        );
      }
      return uniqueAgentIdsInWindow.some((id) => {
        const raw = id.split(":")[0];
        return raw.charAt(0).toUpperCase() + raw.slice(1) === name;
      });
    },
    [allEvents, uniqueAgentIdsInWindow]
  );

  // Emit callbacks
  useEffect(() => {
    onHeatUpdate?.(heat);
  }, [heat]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onEventsPerMinuteUpdate?.(eventsPerMinute);
  }, [eventsPerMinute]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onTimeRangeChange?.(timeRange);
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onAllAgentsUpdate?.(allUniqueAgentIds);
  }, [allUniqueAgentIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // External time range sync
  useEffect(() => {
    if (externalTimeRange && externalTimeRange !== timeRange) {
      setTimeRange(externalTimeRange);
    }
  }, [externalTimeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chart config
  const getActiveConfig = (): ChartConfig => ({
    maxDataPoints: 60,
    animationDuration: 300,
    barWidth: 3,
    barGap: 1,
    colors: chartColorsFromTokens(),
  });

  const getDimensions = (): ChartDimensions => ({
    width: containerRef.current?.offsetWidth || 800,
    height: chartHeight,
    padding: { top: 15, right: 15, bottom: 35, left: 15 },
  });

  const render = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return;
    const data = getChartData();
    const maxVal = Math.max(...data.map((d) => d.count), 1);
    rendererRef.current.clear();
    rendererRef.current.drawBackground();
    rendererRef.current.drawAxes();
    rendererRef.current.drawTimeLabels(timeRange);
    rendererRef.current.drawBars(data, maxVal);
  }, [getChartData, timeRange]);

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const dims = getDimensions();
    const config = getActiveConfig();
    rendererRef.current = createChartRenderer(canvasRef.current, dims, config);

    const resizeObs = new ResizeObserver(() => {
      if (rendererRef.current) {
        rendererRef.current.resize(getDimensions());
        render();
      }
    });
    resizeObs.observe(containerRef.current);

    // Render loop
    let lastRender = 0;
    const frameInterval = 1000 / 30;
    const loop = (t: number) => {
      if (t - lastRender >= frameInterval) {
        render();
        lastRender = t - ((t - lastRender) % frameInterval);
      }
      renderLoopRef.current = requestAnimationFrame(loop);
    };
    renderLoopRef.current = requestAnimationFrame(loop);

    return () => {
      resizeObs.disconnect();
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      rendererRef.current?.stopAnimation();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Process events
  useEffect(() => {
    if (events.length === 0) {
      clearData();
      processedIdsRef.current.clear();
      return;
    }

    const newEvents: HookEvent[] = [];
    events.forEach((event) => {
      const key = String(event.id);
      if (!processedIdsRef.current.has(key)) {
        processedIdsRef.current.add(key);
        newEvents.push(event);
      }
    });

    const currentIds = new Set(events.map((e) => String(e.id)));
    processedIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) processedIdsRef.current.delete(id);
    });

    newEvents.forEach((event) => {
      if (event.hook_event_type === "refresh" || event.hook_event_type === "initial") return;
      addEvent(event);
    });
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = dataPoints.some((dp) => dp.count > 0);
  const skills = skillsAndWorkflows.filter((sw) => sw.type === "skill");
  const workflows = skillsAndWorkflows.filter((sw) => sw.type === "workflow");

  return (
    <div className="flex flex-col">
      {/* Header Bar: Skills, Workflows, Tools, Tokens, Cost */}
      <div className="px-5 py-3 border-b border-line-2">
        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap">
          {/* Skills */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="label-caps">Skills</span>
            {skills.length === 0 ? (
              <span className="mono text-[12px] text-ink-3">—</span>
            ) : (
              skills.slice(0, 3).map((s) => (
                <span key={s.name} className="mono text-[12px] text-ink-1">{s.name}</span>
              ))
            )}
          </div>

          {/* Workflows */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="label-caps">Workflows</span>
            {workflows.length === 0 ? (
              <span className="mono text-[12px] text-ink-3">None</span>
            ) : (
              workflows.slice(0, 3).map((w) => (
                <span key={w.name} className="mono text-[12px] text-ink-1">{w.name}</span>
              ))
            )}
          </div>

          {/* Tools */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className="label-caps">Tools</span>
            {topTools.length === 0
              ? ["Read", "Edit", "Bash"].map((t) => (
                  <span key={t} className="mono text-[12px] text-ink-3">{t}</span>
                ))
              : topTools.filter((t) => t.tool !== "unknown").slice(0, 4).map((tool) => (
                  <span key={tool.tool} className="inline-flex items-baseline gap-1.5 mono text-[12px] text-ink-1">
                    {tool.tool}
                    <span className="text-ink-3">{tool.count}</span>
                  </span>
                ))}
          </div>

          <div className="flex-1" />

          {/* Tokens */}
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="label-caps">Tokens</span>
            <span className="mono text-[12px] text-ink-1">
              {formatTokens(totalTokens.input)}/{formatTokens(totalTokens.output)}
            </span>
          </div>

          {/* Cost */}
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="label-caps">Cost</span>
            <span className="mono text-[12px] text-ink-1">${estimatedCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Agent Pills Bar — the legend for the chart's agent keys */}
        <div className="flex flex-wrap gap-2 min-h-[32px] mt-3 pt-3 border-t border-line-1">
          {stableAgentNames.length === 0 ? (
            ["User", "Agent"].map((name) => (
              <div
                key={name}
                className="flex-1 min-w-0 px-3 py-1.5 rounded-[10px] border border-line-2 flex items-center gap-2 justify-center"
              >
                <span className="fig-key" style={{ color: "var(--ink-3)" }} aria-hidden />
                <span className="mono text-[11px] truncate text-ink-3">{name}</span>
              </div>
            ))
          ) : (
            stableAgentNames.map((name) => {
              const active = isAgentActive(name);
              const color = agentColor(name);
              const count = name === "User"
                ? allEvents.filter((e) => e.hook_event_type === "UserPromptSubmit" && e.timestamp && Date.now() - e.timestamp < currentConfig.duration).length
                : agentActionCounts[name] || 0;

              // Find matching agent ID for swim lane toggle
              const matchingAgentId = allUniqueAgentIds.find((id) => {
                const raw = id.split(":")[0];
                return raw.charAt(0).toUpperCase() + raw.slice(1) === name;
              });

              return (
                <button
                  key={name}
                  onClick={() => matchingAgentId && onAgentPillClick?.(matchingAgentId)}
                  className={`flex-1 min-w-0 px-3 py-1.5 rounded-[10px] border transition-colors cursor-pointer flex items-center gap-2 justify-center hover:border-[color:var(--accent-blue)] ${
                    active ? "border-line-3 text-ink-1" : "border-line-2 text-ink-3 hover:text-ink-2"
                  }`}
                >
                  <span className="fig-key" style={{ color: active ? color : "var(--ink-3)" }} aria-hidden />
                  <span className="mono text-[11px] truncate">{name}</span>
                  {count >= 1 && (
                    <span className="mono text-[11px] text-ink-3 shrink-0">{count}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Canvas Chart */}
      <div className="px-5 py-4">
        <div ref={containerRef} className="relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ height: chartHeight + "px" }}
          />
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 text-ink-3 text-[13px]">
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                <span>Waiting for events...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
