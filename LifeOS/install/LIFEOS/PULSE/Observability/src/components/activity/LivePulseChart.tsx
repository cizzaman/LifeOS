"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { HookEvent } from "@/hooks/useAgentEvents";
import { useChartData, type TimeRange } from "@/hooks/useChartData";
import { useAdvancedMetrics } from "@/hooks/useAdvancedMetrics";
import { useHeatLevel } from "@/hooks/useHeatLevel";
import { createChartRenderer, type ChartDimensions, type ChartConfig } from "./ChartRenderer";
import {
  Settings2,
  Hammer,
  Cpu,
  DollarSign,
  Sparkles,
  Moon,
  Loader2,
  FileText,
  FilePlus,
  FileEdit,
  Search,
  FolderSearch,
  Globe,
  Terminal,
  Send,
  MessageSquare,
  Wrench,
  Cog,
  Play,
  Code,
  type LucideIcon,
} from "lucide-react";

// ─── Tool Icons ───

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  Read: FileText,
  Write: FilePlus,
  Edit: FileEdit,
  Bash: Terminal,
  BashOutput: Terminal,
  Grep: Search,
  Glob: FolderSearch,
  WebFetch: Globe,
  WebSearch: Globe,
  Task: Send,
  TodoWrite: MessageSquare,
  NotebookEdit: Code,
  NotebookRead: Code,
  Skill: Cog,
  SlashCommand: Play,
};

const TOOL_STYLE_MAP: Record<string, { bg: string; text: string }> = {
  Read: { bg: "bg-[#7cd5e6]/10", text: "text-[#7cd5e6]" },
  Write: { bg: "bg-[#7cd5e6]/10", text: "text-[#7cd5e6]" },
  Edit: { bg: "bg-[#7cd5e6]/10", text: "text-[#7cd5e6]" },
  Grep: { bg: "bg-[#a78bfa]/10", text: "text-[#a78bfa]" },
  Glob: { bg: "bg-[#a78bfa]/10", text: "text-[#a78bfa]" },
  Bash: { bg: "bg-[#22c55e]/10", text: "text-[#22c55e]" },
  BashOutput: { bg: "bg-[#22c55e]/10", text: "text-[#22c55e]" },
  WebFetch: { bg: "bg-[#f97316]/10", text: "text-[#f97316]" },
  WebSearch: { bg: "bg-[#f97316]/10", text: "text-[#f97316]" },
  Task: { bg: "bg-[#f87171]/10", text: "text-[#f87171]" },
  TodoWrite: { bg: "bg-[#f87171]/10", text: "text-[#f87171]" },
};

const DEFAULT_STYLE = { bg: "bg-[rgba(107,125,137,0.1)]", text: "text-[var(--ink-2)]" };

// ─── Agent Colors ───

const AGENT_HEX_COLORS: Record<string, string> = {
  pentester: "#f87171",
  engineer: "#3fb2c9",
  designer: "#a78bfa",
  architect: "#a78bfa",
  intern: "#3fb2c9",
  artist: "#3fb2c9",
  "perplexity-researcher": "#f5c451",
  "claude-researcher": "#f5c451",
  "gemini-researcher": "#f5c451",
  main: "#3fb2c9",
  da: "#3fb2c9",
  pai: "#3fb2c9",
  "claude-code": "#3fb2c9",
};

function getHexColorForApp(name: string): string {
  const key = name.split(":")[0].toLowerCase();
  return AGENT_HEX_COLORS[key] || "#5cc4d8";
}

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
  onHeatUpdate?: (data: { intensity: number; color: string; label: string }) => void;
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
    colors: { primary: "#3fb2c9", glow: "#5cc4d8", axis: "#333", text: "#55636d" },
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
      <div className="px-5 py-2 border-b border-white/[0.03]">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Skills */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-[var(--ink-3)] font-medium uppercase">SKILLS:</span>
            {skills.length === 0 ? (
              <span className="text-sm font-medium text-[var(--ink-3)]">—</span>
            ) : (
              skills.slice(0, 3).map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#a78bfa]/10">
                  <Settings2 size={14} className="text-[#a78bfa]" />
                  <span className="font-medium text-[#a78bfa]">{s.name}</span>
                </div>
              ))
            )}
          </div>

          <span className="text-[var(--line-2)]">|</span>

          {/* Workflows */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-[var(--ink-3)] font-medium uppercase">WORKFLOWS:</span>
            {workflows.length === 0 ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[rgba(107,125,137,0.2)]">
                <Hammer size={14} className="text-[var(--ink-3)]" />
                <span className="font-medium text-[var(--ink-3)]">None</span>
              </div>
            ) : (
              workflows.slice(0, 3).map((w) => (
                <div key={w.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[#5cc4d8]/10">
                  <Hammer size={14} className="text-[#5cc4d8]" />
                  <span className="font-medium text-[#5cc4d8]">{w.name}</span>
                </div>
              ))
            )}
          </div>

          <span className="text-[var(--line-2)]">|</span>

          {/* Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-[var(--ink-3)] font-medium uppercase">TOOLS:</span>
            {topTools.length === 0 ? (
              ["Read", "Edit", "Bash"].map((t) => {
                const Icon = TOOL_ICON_MAP[t] || Wrench;
                return (
                  <div key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm bg-[rgba(107,125,137,0.2)]">
                    <Icon size={14} className="text-[var(--ink-3)]" />
                    <span className="font-medium text-[var(--ink-3)]">{t}</span>
                  </div>
                );
              })
            ) : (
              topTools.filter((t) => t.tool !== "unknown").slice(0, 4).map((tool) => {
                const Icon = TOOL_ICON_MAP[tool.tool] || Wrench;
                const style = TOOL_STYLE_MAP[tool.tool] || DEFAULT_STYLE;
                return (
                  <div key={tool.tool} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm ${style.bg}`}>
                    <Icon size={14} className={style.text} />
                    <span className={`font-medium ${style.text}`}>{tool.tool}</span>
                    <span className={`font-bold ${style.text}`}>{tool.count}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex-1" />

          {/* Tokens */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm shrink-0"
            style={{ backgroundColor: "rgba(245,196,81,0.15)" }}
          >
            <Cpu size={14} className="text-[#f5c451]" />
            <span className="font-medium text-[#f5c451]">
              {formatTokens(totalTokens.input)}/{formatTokens(totalTokens.output)}
            </span>
          </div>

          {/* Cost */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm shrink-0"
            style={{ backgroundColor: "rgba(34,197,94,0.15)" }}
          >
            <DollarSign size={14} className="text-[#22c55e]" />
            <span className="font-medium text-[#22c55e]">${estimatedCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Agent Pills Bar */}
        <div className="flex gap-2 min-h-[32px] mt-2 pt-2 border-t border-white/[0.03]">
          {stableAgentNames.length === 0 ? (
            ["User", "Agent"].map((name) => (
              <div
                key={name}
                className="flex-1 min-w-0 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 justify-center bg-[rgba(107,125,137,0.2)]"
              >
                <Moon size={10} className="shrink-0 text-[var(--ink-3)]" />
                <span className="font-mono truncate text-[var(--ink-3)]">{name}</span>
              </div>
            ))
          ) : (
            stableAgentNames.map((name) => {
              const active = isAgentActive(name);
              const color = getHexColorForApp(name);
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
                  className={`flex-1 min-w-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2 justify-center ${
                    active ? "text-white" : "text-[var(--ink-2)] opacity-40 hover:opacity-70"
                  }`}
                  style={{
                    borderColor: color + (active ? "60" : "20"),
                    backgroundColor: color + (active ? "20" : "05"),
                  }}
                >
                  {active ? (
                    <Sparkles size={10} className="shrink-0" style={{ color }} />
                  ) : (
                    <Moon size={10} className="shrink-0 opacity-50" />
                  )}
                  <span className="font-mono truncate">{name}</span>
                  {count >= 1 && (
                    <span
                      className="px-1.5 py-0.5 text-[16px] font-bold rounded min-w-[20px] text-center shrink-0"
                      style={{ backgroundColor: color, color: "var(--ground)" }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Canvas Chart */}
      <div className="px-5 py-4">
        <div ref={containerRef} className="relative rounded-xl overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ height: chartHeight + "px" }}
          />
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-3 text-[var(--ink-3)] text-base">
                <Loader2 size={20} strokeWidth={2} className="animate-spin text-blue-500" />
                <span className="font-medium">Waiting for events...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
