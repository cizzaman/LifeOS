"use client";

import { useEffect, useRef, useState } from "react";
import { PageShell, PageHeader, Panel, Pill } from "@/components/ui/chrome";

// ── CONVEYOR: the live content board. Dense cards, SSE push, poll fallback. ──

interface Item {
  id: string;
  title: string;
  type: string;
  stage: string;
  legs: Record<string, string>;
  stage_status?: string;
  activity?: string;
  activity_at?: string;
  blocked?: boolean;
  attempt?: number;
  requested_run?: string;
  created: string;
}
interface BoardData {
  columns: string[];
  legs: string[];
  items: Item[];
  counts: Record<string, number>;
}

// Leg status → 7px key colour. running=teal, done=ok, failed=err, changes=warn, pending=grey.
const LEG_KEY: Record<string, string> = {
  running: "var(--accent-blue)",
  done: "var(--ok)",
  failed: "var(--err)",
  "changes-requested": "var(--warn)",
};
function legKey(s: string): string {
  return LEG_KEY[s] ?? "var(--ink-3)";
}
function elapsed(fromISO?: string, nowMs = Date.now()): string {
  if (!fromISO) return "";
  const s = Math.max(0, Math.round((nowMs - Date.parse(fromISO)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

export default function ContentPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [live, setLive] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    const startPoll = () => {
      if (pollRef.current) return;
      const load = async () => {
        try {
          const r = await fetch("/api/content", { cache: "no-store" });
          if (r.ok) setData(await r.json());
        } catch {
          /* keep last frame */
        }
      };
      load();
      pollRef.current = setInterval(load, 2500);
    };
    try {
      es = new EventSource("/api/content/stream");
      es.onmessage = (ev) => {
        try {
          setData(JSON.parse(ev.data));
          setLive(true);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        setLive(false);
        es?.close();
        startPoll();
      };
    } catch {
      startPoll();
    }
    return () => {
      es?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const columns = data?.columns ?? ["inbox", "prep", "produce", "review", "publishing", "done"];

  return (
    <PageShell>
      <style>{`
        @keyframes conv-breathe { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .conv-dot { animation: conv-breathe calc(var(--cycle) / 5) ease-in-out infinite; }
        .conv-x { color:var(--ink-3); cursor:pointer; transition:color .15s ease; background:none; border:none; font-family:inherit; }
        .conv-x:hover { color:var(--ink-1); }
      `}</style>

      <PageHeader
        title="Content"
        subtitle="drop → transcribe → produce (edit+augment · clips 2–16 · social · omny · discord) → review → publish"
        actions={
          <>
            <Pill dim={live ? "ok" : "neutral"}>
              {live ? "LIVE" : "POLLING"}
            </Pill>
            <span className="text-[12px] text-ink-3 mono">{data ? `${data.items.length}` : "…"}</span>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {columns.map((col) => {
          const items = (data?.items ?? []).filter((it) => (it.stage ?? "inbox") === col);
          return (
            <Panel key={col} className="p-2 max-sm:p-2 xl:min-h-[calc(100vh-220px)]">
              <div className="label-caps px-0.5 pt-0.5 pb-2">
                {col} <span className="mono text-ink-3">{items.length}</span>
              </div>
              {items.map((it) => {
                const running = it.stage_status === "running";
                const failed = it.stage_status === "failed" || it.blocked;
                const done = it.stage_status === "done";
                const dot = `var(--${running ? "accent-blue" : failed ? "err" : done ? "ok" : "ink-3"})`;
                const statusLabel = running ? "RUNNING" : failed ? "BLOCKED" : done ? "READY" : "IDLE";
                return (
                  <Panel key={it.id} className="p-3 max-sm:p-3 mb-2 border-line-2">
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <span className={`fig-key${running ? " conv-dot" : ""}`} style={{ color: dot, marginTop: 5 }} aria-hidden />
                      <span className="text-ink-1" style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{it.title}</span>
                      <button
                        type="button"
                        className="conv-x"
                        title="Delete item — stops its tasks"
                        aria-label={`Delete ${it.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${it.title}" and stop its tasks?`)) {
                            fetch(`/api/content/${it.id}`, { method: "DELETE" });
                          }
                        }}
                        style={{ fontSize: 15, lineHeight: 1, padding: "0 2px", flex: "0 0 auto" }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Meta row: type · status · elapsed */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0 2px", paddingLeft: 14 }}>
                      <Pill>{it.type}</Pill>
                      <span className="mono text-ink-2" style={{ fontSize: 10, letterSpacing: "0.1em" }}>{statusLabel}</span>
                      {it.requested_run ? (
                        <Pill>RUN QUEUED</Pill>
                      ) : (
                        !["review", "publishing", "done"].includes(it.stage) && (
                          <button
                            type="button"
                            title="Queue the regular run: edit → augment → clips → social (staged, never auto-published)"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch(`/api/content/${it.id}/run`, { method: "POST" });
                            }}
                            className="rounded-full mono text-[10px] tracking-[0.1em] text-ink-1 border border-line-3 hover:border-[color:var(--accent-blue)] transition-colors cursor-pointer"
                            style={{ padding: "1px 8px" }}
                          >
                            ▶ RUN
                          </button>
                        )
                      )}
                      {(running || done) && it.activity_at && (
                        <span className="mono text-ink-3" style={{ fontSize: 10 }}>{elapsed(it.activity_at, nowMs)}</span>
                      )}
                      {failed && it.attempt ? <span className="mono text-ink-2" style={{ fontSize: 10 }}>try {it.attempt}</span> : null}
                    </div>

                    {/* Activity line */}
                    {it.activity && (
                      <div
                        className={running || failed ? "text-ink-2" : "text-ink-3"}
                        style={{ fontSize: 10.5, margin: "3px 0 0", paddingLeft: 14, lineHeight: 1.35, wordBreak: "break-word" }}
                      >
                        {it.activity}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="bg-line-2" style={{ height: 1, margin: "9px 0 8px", marginLeft: 14 }} />

                    {/* Per-leg labeled chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", paddingLeft: 14 }}>
                      {Object.entries(it.legs ?? {}).map(([leg, status]) => (
                        <Pill key={leg} title={`${leg}: ${status}`}>
                          <span className="fig-key" style={{ color: legKey(status) }} aria-hidden />
                          {leg}
                        </Pill>
                      ))}
                    </div>
                  </Panel>
                );
              })}
            </Panel>
          );
        })}
      </div>
    </PageShell>
  );
}
