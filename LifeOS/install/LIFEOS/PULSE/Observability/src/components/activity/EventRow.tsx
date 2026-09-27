"use client";

import { useState } from "react";
import type { HookEvent } from "@/hooks/useAgentEvents";
import {
  Wrench,
  CheckCircle,
  Bell,
  StopCircle,
  UserCheck,
  Package,
  MessageSquare,
  Rocket,
  Flag,
  FileText,
  Copy,
  Eye,
  FilePlus,
  Edit3,
  Terminal,
  Search,
  FolderSearch,
  Globe,
  Compass,
  Zap,
  Command,
  CheckSquare,
  MessageCircleQuestion,
  BookOpen,
  Code,
  type LucideIcon,
} from "lucide-react";

// ─── Color Maps ───

const EVENT_TYPE_COLORS: Record<string, string> = {
  PreToolUse: "#f5c451",
  PostToolUse: "#f97316",
  Completed: "#22c55e",
  Notification: "#f97316",
  Stop: "#f87171",
  SubagentStop: "#a78bfa",
  PreCompact: "#1abc9c",
  UserPromptSubmit: "#7cd5e6",
  SessionStart: "#5cc4d8",
  SessionEnd: "#5cc4d8",
};

const TOOL_COLORS: Record<string, string> = {
  Read: "#5cc4d8",
  Write: "#22c55e",
  Edit: "#f5c451",
  Bash: "#a78bfa",
  Grep: "#f87171",
  Glob: "#f97316",
  Task: "#5cc4d8",
  WebFetch: "#7cd5e6",
  WebSearch: "#7cd5e6",
  Skill: "#d9d2c4",
  SlashCommand: "#d9d2c4",
  TodoWrite: "#f5c451",
  AskUserQuestion: "#a78bfa",
  NotebookEdit: "#22c55e",
  NotebookRead: "#5cc4d8",
  BashOutput: "#a78bfa",
  KillShell: "#f87171",
  ExitPlanMode: "#22c55e",
};

const AGENT_HEX: Record<string, string> = {
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

// ─── Icons ───

const HOOK_ICONS: Record<string, LucideIcon> = {
  PreToolUse: Wrench,
  PostToolUse: CheckCircle,
  Notification: Bell,
  Stop: StopCircle,
  SubagentStop: UserCheck,
  PreCompact: Package,
  UserPromptSubmit: MessageSquare,
  SessionStart: Rocket,
  SessionEnd: Flag,
  Completed: CheckCircle,
};

const TOOL_ICONS: Record<string, LucideIcon> = {
  Read: Eye,
  Write: FilePlus,
  Edit: Edit3,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderSearch,
  Task: Zap,
  WebFetch: Globe,
  WebSearch: Compass,
  Skill: Zap,
  SlashCommand: Command,
  TodoWrite: CheckSquare,
  AskUserQuestion: MessageCircleQuestion,
  NotebookEdit: BookOpen,
  NotebookRead: FileText,
  BashOutput: Terminal,
  KillShell: Terminal,
  ExitPlanMode: CheckCircle,
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  PreToolUse: "Pre-Tool",
  PostToolUse: "Post-Tool",
  UserPromptSubmit: "UserPromptSubmit",
  SessionStart: "SessionStart",
  SessionEnd: "SessionEnd",
  Stop: "Stop",
  SubagentStop: "SubagentStop",
  PreCompact: "PreCompact",
  Notification: "Notification",
  Completed: "Completed",
};

// ─── Helpers ───

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // Prepend the date when the event is not from today, so cross-day events
  // stay unambiguous in the Time column. public PR #1628, @elhoim
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return time;
  // Non-today: zero-padded day + 3-letter month (e.g. "03 Jul"). Across a year
  // boundary, also show the year (e.g. "31 Dec 2025 07:31:22").
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(
    "en-GB",
    sameYear
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric" },
  );
  return `${date} ${time}`;
}

function getToolInfo(event: HookEvent): { tool: string; detail?: string } | null {
  const payload = event.payload;

  if (event.hook_event_type === "Completed") {
    return { tool: "", detail: payload.task || event.summary || "Task completed" };
  }

  if (event.hook_event_type === "UserPromptSubmit" && payload.prompt) {
    const preview = payload.prompt.slice(0, 300);
    return { tool: "Prompt:", detail: `"${preview}${payload.prompt.length > 300 ? "..." : ""}"` };
  }

  if (event.hook_event_type === "PreCompact") {
    const trigger = payload.trigger || "unknown";
    return { tool: "Compaction:", detail: trigger === "manual" ? "Manual compaction" : "Auto-compaction" };
  }

  if (event.hook_event_type === "SessionStart") {
    const source = payload.source || "unknown";
    const labels: Record<string, string> = { startup: "New session", resume: "Resuming session", clear: "Fresh session" };
    return { tool: "Session:", detail: labels[source] || source };
  }

  if (payload.tool_name) {
    const info: { tool: string; detail?: string } = { tool: payload.tool_name };
    if (payload.tool_input) {
      if (payload.tool_input.command) {
        info.detail = payload.tool_input.command.slice(0, 200) + (payload.tool_input.command.length > 200 ? "..." : "");
      } else if (payload.tool_input.file_path) {
        const parts = payload.tool_input.file_path.split("/");
        info.detail = parts.length > 3 ? ".../" + parts.slice(-3).join("/") : payload.tool_input.file_path;
      } else if (payload.tool_input.pattern) {
        info.detail = payload.tool_input.pattern;
      }
    }
    return info;
  }

  return null;
}

// ─── Component ───

interface EventRowProps {
  event: HookEvent;
}

export default function EventRow({ event }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyText, setCopyText] = useState("Copy");

  const agentId =
    event.hook_event_type === "UserPromptSubmit"
      ? "User"
      : event.source_app === "subagent" && event.agent_name && event.agent_name !== "subagent"
      ? event.agent_name
      : event.source_app
      ? event.source_app.charAt(0).toUpperCase() + event.source_app.slice(1)
      : "unknown";

  const agentKey = (event.agent_name || event.source_app || "unknown").split(":")[0].toLowerCase();
  const appColor = AGENT_HEX[agentKey] || "#5cc4d8";
  const eventTypeColor = EVENT_TYPE_COLORS[event.hook_event_type] || "#5cc4d8";
  const HookIcon = HOOK_ICONS[event.hook_event_type] || MessageSquare;

  const toolInfo = getToolInfo(event);
  const toolColor = toolInfo?.tool ? TOOL_COLORS[toolInfo.tool] || "#5cc4d8" : "#5cc4d8";
  const ToolIcon = toolInfo?.tool ? TOOL_ICONS[toolInfo.tool] || Code : Code;

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event.payload, null, 2));
      setCopyText("Copied!");
      setTimeout(() => setCopyText("Copy"), 2000);
    } catch {
      setCopyText("Failed");
      setTimeout(() => setCopyText("Copy"), 2000);
    }
  };

  return (
    <div
      className={`group relative p-3 rounded-xl cursor-pointer hover:bg-white/[0.02] transition-colors ${
        expanded ? "ring-1 ring-blue-500/50" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="ml-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Agent Badge */}
            <div
              className="text-xs font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shrink-0"
              style={{
                borderColor: appColor + "50",
                backgroundColor: appColor + "15",
              }}
            >
              <span className="font-mono text-xs whitespace-nowrap text-white">{agentId}</span>
            </div>

            {/* Event Type Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
              style={{ backgroundColor: eventTypeColor + "12", color: eventTypeColor }}
            >
              <HookIcon size={12} strokeWidth={2} />
              {EVENT_TYPE_LABELS[event.hook_event_type] || event.hook_event_type}
            </span>

            {/* Tool Info */}
            {toolInfo && (
              <span className="flex items-center gap-1.5 min-w-0">
                {toolInfo.tool && (
                  <span
                    className="text-sm font-medium px-2 py-1 rounded-lg inline-flex items-center gap-1 shrink-0"
                    style={{ backgroundColor: toolColor + "10", color: toolColor }}
                  >
                    <ToolIcon size={11} strokeWidth={2} />
                    {toolInfo.tool}
                  </span>
                )}
                {toolInfo.detail && (
                  <span
                    data-sensitive
                    className="text-base truncate flex-1 min-w-0"
                    style={{
                      fontFamily:
                        event.hook_event_type === "UserPromptSubmit"
                          ? "Georgia, serif"
                          : "Georgia, serif",
                      fontStyle: event.hook_event_type === "UserPromptSubmit" ? "italic" : undefined,
                      color:
                        event.hook_event_type === "UserPromptSubmit"
                          ? "#7cd5e6"
                          : event.hook_event_type === "Completed"
                          ? "#22c55e"
                          : "var(--ink-2)",
                    }}
                  >
                    {toolInfo.detail}
                  </span>
                )}
              </span>
            )}

            {/* Summary */}
            {event.summary && (
              <span className="inline-flex items-center gap-1.5 text-xs text-white font-medium px-2.5 py-1 bg-blue-500/10 rounded-lg min-w-0 max-w-sm" data-sensitive>
                <FileText size={11} strokeWidth={2} className="text-blue-400 shrink-0" />
                <span className="truncate">{event.summary}</span>
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span className="text-xs text-[var(--line-2)] font-medium whitespace-nowrap">
            {formatTime(event.timestamp)}
          </span>
        </div>

        {/* Expanded: Payload */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-[var(--ink-2)] flex items-center gap-1.5">
                  <Package size={14} strokeWidth={2} />
                  Payload
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPayload();
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 text-[var(--ink-2)] hover:text-white bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <Copy size={12} strokeWidth={2} />
                  {copyText}
                </button>
              </div>
              <pre className="text-sm text-white bg-black/20 p-3 rounded-xl overflow-x-auto max-h-64 overflow-y-auto font-mono" data-sensitive>
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
