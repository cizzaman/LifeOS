"use client";

import { useState } from "react";
import type { HookEvent } from "@/hooks/useAgentEvents";
import { Copy } from "lucide-react";

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

  const toolInfo = getToolInfo(event);

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
      className={`group relative p-3 rounded-[10px] border cursor-pointer transition-colors ${
        expanded
          ? "border-[color:var(--accent-blue)] bg-[color:var(--primary-soft)]"
          : "border-transparent hover:bg-surface-3"
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="ml-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
            {/* Agent */}
            <span className="mono text-[11px] whitespace-nowrap text-ink-1 shrink-0">{agentId}</span>

            {/* Event Type */}
            <span className="mono text-[10px] uppercase tracking-[0.1em] whitespace-nowrap text-ink-2 shrink-0">
              {EVENT_TYPE_LABELS[event.hook_event_type] || event.hook_event_type}
            </span>

            {/* Tool Info */}
            {toolInfo && (
              <span className="flex items-center gap-2 min-w-0">
                {toolInfo.tool && (
                  <span className="mono text-[11px] text-ink-1 shrink-0">{toolInfo.tool}</span>
                )}
                {toolInfo.detail && (
                  <span
                    data-sensitive
                    className={`text-[13px] truncate flex-1 min-w-0 ${
                      event.hook_event_type === "UserPromptSubmit" || event.hook_event_type === "Completed"
                        ? "text-ink-1"
                        : "text-ink-2"
                    }`}
                  >
                    {toolInfo.detail}
                  </span>
                )}
              </span>
            )}

            {/* Summary */}
            {event.summary && (
              <span className="text-[13px] text-ink-2 min-w-0 max-w-sm truncate" data-sensitive>
                {event.summary}
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span className="mono text-[11px] text-ink-3 whitespace-nowrap">
            {formatTime(event.timestamp)}
          </span>
        </div>

        {/* Expanded: Payload */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-line-2 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="label-caps">Payload</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPayload();
                  }}
                  className="px-3 py-1.5 rounded-[10px] border border-line-2 flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-2 hover:text-ink-1 hover:border-[color:var(--accent-blue)] transition-colors"
                >
                  <Copy size={12} strokeWidth={1.5} />
                  {copyText}
                </button>
              </div>
              <pre className="mono text-[12px] text-ink-2 p-3 rounded-[10px] border border-line-2 overflow-x-auto max-h-64 overflow-y-auto" data-sensitive>
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
