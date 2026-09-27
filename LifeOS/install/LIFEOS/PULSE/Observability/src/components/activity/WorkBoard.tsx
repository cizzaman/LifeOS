"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAlgorithmState } from "@/hooks/useAlgorithmState";
import type { AlgorithmState, AlgorithmCriterion, ActivityClass } from "@/types/algorithm";
import { deriveLifecycle, LIFECYCLE_META, LIFECYCLE_ORDER, formatElapsed, formatAgo, type Lifecycle } from "@/lib/lifecycle";
import ClimbChart from "./ClimbChart";
import QuickPulseStrip from "./QuickPulseStrip";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Marker, TabBar, type Dim } from "@/components/ui/chrome";
import { ChevronRight, Loader2, RotateCcw, Shield } from "lucide-react";

// ─── WorkBoard — tracked climbs + untracked sessions ───
//
// Replaces UnifiedWorkDashboard (2026-07-14 redesign). No modes, no effort
// tiers, no phase stations. Two kinds of rows:
//   TRACKED  — an ISA backs the session: claims, evidence, the climb.
//   UNTRACKED — a live session with no ISA: liveness + what it's doing.
// Lifecycle is derived from data (lib/lifecycle.ts), never declared.

type BoardFilter = "all" | "tracked" | "untracked";

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tracked", label: "Climbs" },
  { id: "untracked", label: "Sessions" },
];

const VIEWS: { id: "list" | "kanban"; label: React.ReactNode }[] = [
  { id: "list", label: <span title="List view">List</span> },
  { id: "kanban", label: <span title="Kanban view — lifecycle lanes">Kanban</span> },
];

/** Liveness mark: teal while the run is live, faint once it is not. */
function LiveDot({ active, size = 6 }: { active: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: active ? "var(--accent-blue)" : "var(--ink-3)" }}
    />
  );
}

// ─── ISA badge — marks a tracked run, carries the ISC count ───

/** Claim counts with a legacy fallback: rows written before the progress
 *  normalization can carry 0/0 while their criteria[] are fully populated. */
export function claimCounts(s: AlgorithmState): { done: number; total: number } {
  if ((s.progress?.total ?? 0) > 0) return s.progress;
  const claims = s.criteria?.filter((c) => c.type !== "anti-criterion") ?? [];
  return { done: claims.filter((c) => c.status === "completed").length, total: claims.length };
}

/** Explicit absence marker — "no badge" was invisible convention (2026-07-15). */
function NoISAChip() {
  return (
    <span
      className="inline-flex items-center mono text-[10px] uppercase tracking-[0.1em] text-ink-3 shrink-0"
      title="Untracked session — no ISA, no claims; liveness only"
    >
      NO ISA
    </span>
  );
}

// ─── Activity chip — what the tool stream says the run is doing RIGHT NOW ───
//
// Second axis on top of the lifecycle lane (2026-07-22): the lane is the macro
// state from ISA data; this chip is the live state derived server-side from
// tool-activity.jsonl. Shown only while fresh (< 5 min since last tool call).

const ACTIVITY_META: Record<ActivityClass, { label: string }> = {
  exploring: { label: "Exploring" },
  building: { label: "Building" },
  verifying: { label: "Verifying" },
  delegating: { label: "Delegating" },
  other: { label: "Working" },
};

const ACTIVITY_FRESH_MS = 5 * 60 * 1000;

function ActivityChip({ s, size = "sm" }: { s: AlgorithmState; size?: "sm" | "xs" }) {
  const a = s.activity;
  if (!s.active || !a?.state || !a.lastTs || Date.now() - a.lastTs > ACTIVITY_FRESH_MS) return null;
  // A completed run is closed — residual tool calls in the same terminal are
  // post-run chatter, not run work. Done cards never advertise live activity
  // ({{PRINCIPAL_NAME}}, 2026-07-22: "Done shouldn't have anything with working").
  // A run in the learn wrap-up (phase not yet COMPLETE) keeps the chip: wrap-up
  // is real work. (Was "Summit keeps the chip" — summit folded into cairn 2026-07-30.)
  if (s.currentPhase === "COMPLETE") return null;
  const meta = ACTIVITY_META[a.state];
  return (
    <span
      className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-2 shrink-0"
      title={a.lastTool ? `${meta.label} — last tool ${a.lastTool} ${formatAgo(a.lastTs)}` : meta.label}
    >
      {meta.label}
      {size === "sm" && a.lastTool && <span className="normal-case tracking-normal text-ink-3">{a.lastTool}</span>}
    </span>
  );
}

/** ISC delta text — "+2 · ✓3 (1h)" — only when something actually moved. */
function deltaText(s: AlgorithmState): string | null {
  const d = s.iscDeltas;
  if (!d || (d.added1h === 0 && d.closed1h === 0)) return null;
  const parts: string[] = [];
  if (d.added1h > 0) parts.push(`+${d.added1h}`);
  if (d.closed1h > 0) parts.push(`✓${d.closed1h}`);
  return `${parts.join(" · ")} (1h)`;
}

function ISABadge({ s }: { s: AlgorithmState }) {
  if (!s.tracked) return <NoISAChip />;
  const { done, total } = claimCounts(s);
  return (
    <span
      className="inline-flex items-center mono text-[10px] uppercase tracking-[0.1em] text-ink-1 shrink-0"
      title={`ISA-tracked — ${done}/${total} claims verified`}
    >
      ISA{total > 0 ? ` ${done}/${total}` : ""}
    </span>
  );
}

// ─── Claims Kanban — columns are claim STATES, the thing that actually moves ───
//
// The old kanban's columns were phases (retired — nothing walked them). These
// columns are real: every card sits where its verification status puts it,
// and cards migrate left→right as evidence lands.

const CLAIM_COLUMNS: {
  key: string;
  label: string;
  dim: Dim;
  match: (c: AlgorithmCriterion) => boolean;
}[] = [
  // "In progress" column removed 2026-07-22: no writer has ever emitted
  // in_progress (parser is pending|completed) — the column was permanently empty.
  { key: "open", label: "Open", dim: "neutral", match: (c) => c.status !== "completed" && c.status !== "failed" },
  { key: "verified", label: "Verified", dim: "ok", match: (c) => c.status === "completed" },
];

function splitEvidence(c: AlgorithmCriterion): [string, string] {
  const m = c.description.match(/^([\s\S]*?)(?:\s*\*{0,2}Evidence:?\*{0,2}\s*)([\s\S]+)$/i);
  if (m) return [m[1].trim(), m[2].trim()];
  return [c.description, c.evidence || ""];
}

function ClaimsKanban({ s }: { s: AlgorithmState }) {
  const claims = s.criteria.filter((c) => c.type !== "anti-criterion");
  if (claims.length === 0) return null;
  const failed = claims.filter((c) => c.status === "failed");
  const cols = [
    ...CLAIM_COLUMNS,
    ...(failed.length > 0
      ? [{ key: "failed", label: "Failed", dim: "err" as Dim, match: (c: AlgorithmCriterion) => c.status === "failed" }]
      : []),
  ];

  return (
    <div className="grid gap-2 grid-cols-2 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" style={{ "--cols": cols.length } as React.CSSProperties}>
      {cols.map((col) => {
        const cards = claims.filter(col.match);
        return (
          <div key={col.key} className="rounded-[10px] border border-line-2 min-h-[80px] min-w-0">
            <div className="px-2.5 py-2 flex items-center gap-2 border-b border-line-2">
              <Marker dim={col.dim} />
              <span className="label-caps">{col.label}</span>
              <span className="mono text-[11px] text-ink-3 ml-auto">{cards.length}</span>
            </div>
            <div className="p-1.5 space-y-1.5">
              {cards.map((c) => {
                const [claimText, evidenceText] = splitEvidence(c);
                return (
                  <div
                    key={c.id}
                    className="rounded-[10px] px-2 py-1.5 border border-line-1"
                    title={evidenceText ? `${claimText}\n\nEvidence: ${evidenceText}` : claimText}
                    data-sensitive
                  >
                    <div className="mono text-[10px] text-ink-3 mb-0.5">
                      {c.id}
                    </div>
                    <p className="text-[12px] leading-snug text-ink-2 line-clamp-3">{claimText}</p>
                    {col.key === "verified" && evidenceText && (
                      <p className="text-[11px] leading-snug text-ink-3 line-clamp-2 mt-1">
                        <span className="text-ink-2">✓ </span>
                        {evidenceText}
                      </p>
                    )}
                  </div>
                );
              })}
              {cards.length === 0 && <div className="text-[11px] text-ink-3 px-1 py-2">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Claim row (expanded view) ───

function ClaimRow({ c }: { c: AlgorithmCriterion }) {
  const isAnti = c.type === "anti-criterion";
  const statusDim: Dim = c.status === "completed" ? "ok" : c.status === "failed" ? "err" : "neutral";

  // Evidence is embedded in descriptions as "Evidence: …" — split it out so
  // the claim reads clean and the proof reads quiet.
  const [claimText, evidenceText] = useMemo(() => {
    const m = c.description.match(/^([\s\S]*?)(?:\s*\*{0,2}Evidence:?\*{0,2}\s*)([\s\S]+)$/i);
    if (m) return [m[1].trim(), m[2].trim()];
    return [c.description, c.evidence || ""];
  }, [c.description, c.evidence]);

  return (
    <div className="flex items-start gap-2.5 px-3 py-1.5 rounded-[10px] border border-line-1" data-sensitive>
      {isAnti ? (
        <Shield className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" strokeWidth={1.5} />
      ) : (
        <span className="mt-1.5 flex shrink-0"><Marker dim={statusDim} /></span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="mono text-[11px] text-ink-3 shrink-0">{c.id}</span>
          {isAnti && <span className="label-caps text-ink-3 shrink-0">guardrail</span>}
        </div>
        <p className={`text-sm leading-snug ${c.status === "completed" ? "text-ink-2" : "text-ink-1"}`}>{claimText}</p>
        {evidenceText && c.status === "completed" && (
          <p className="text-[13px] text-ink-3 leading-snug mt-0.5 line-clamp-2">
            <span className="text-ink-2">evidence</span> {evidenceText}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Expanded view for an untracked session ───
//
// Everything work.json knows about a session with no ISA: the opening ask,
// timing, liveness. Exists because "I don't know anything about them"
// ({{PRINCIPAL_NAME}}, 2026-07-15) — every card must open into whatever we do know.

function SessionExpanded({ s, bare = false }: { s: AlgorithmState; bare?: boolean }) {
  // bare: plain always-open panel for the spotlight — see ClimbExpanded.
  const Wrapper = bare ? "div" : motion.div;
  const motionProps = bare
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.18, ease: "easeInOut" },
      };
  return (
    <Wrapper
      {...(motionProps as object)}
      className="overflow-hidden border-b border-line-2"
    >
      <div className="px-5 py-4 space-y-3">
        {s.rawTask && (
          <div>
            <div className="label-caps mb-1.5">Opening ask</div>
            <p className="text-sm text-ink-1 leading-relaxed" data-sensitive>“{s.rawTask}”</p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-2">
          <span>
            <span className="text-ink-3">started </span>
            {new Date(s.algorithmStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            <span className="text-ink-3"> · running </span>
            {formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))}
          </span>
          <span>
            <span className="text-ink-3">last activity </span>
            {formatAgo(s.phaseStartedAt || s.algorithmStartedAt)}
          </span>
          {s.sessionUUID && (
            <span className="mono text-[11px] text-ink-3 self-center">{s.sessionUUID.slice(0, 8)}</span>
          )}
        </div>
        <p className="text-[12px] text-ink-3 leading-snug">
          Untracked session — no ISA, so no claims, no climb. If this becomes real work, the run writes an ISA and
          this card graduates to a tracked climb automatically.
        </p>
      </div>
    </Wrapper>
  );
}

// ─── Expanded view for a tracked run ───

function ClimbExpanded({ s, bare = false }: { s: AlgorithmState; bare?: boolean }) {
  const claims = s.criteria.filter((c) => c.type !== "anti-criterion");
  const guards = s.criteria.filter((c) => c.type === "anti-criterion");
  // bare: render as a plain always-open panel (the spotlight). The 0→auto
  // height animation is for the list-view expander; as a persistent pane it
  // can wedge at collapsed height (observed 2026-07-22: 40px spotlight).
  const Wrapper = bare ? "div" : motion.div;
  const motionProps = bare
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.18, ease: "easeInOut" },
      };
  return (
    <Wrapper
      {...(motionProps as object)}
      className="overflow-hidden border-b border-line-2"
    >
      <div className="px-5 py-4 space-y-4">
        {((s.climb?.length ?? 0) > 0 || (s.activity?.ribbon?.length ?? 0) > 0) && (
          <div className="rounded-[10px] border border-line-2 p-3">
            <ClimbChart state={s} variant="full" />
          </div>
        )}

        {s.intent && !s.criteria.length && (
          <p className="text-sm text-ink-2 leading-relaxed" data-sensitive>{s.intent}</p>
        )}

        {claims.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <span className="label-caps">
                Claims <span className="mono text-ink-1">{claimCounts(s).done}/{claimCounts(s).total}</span>
              </span>
              {s.iscDeltas && (s.iscDeltas.addedTotal > 0 || s.iscDeltas.closedTotal > 0) && (
                <span className="mono text-[11px] text-ink-3">
                  {s.iscDeltas.addedTotal} added · {s.iscDeltas.closedTotal} closed
                  {deltaText(s) && <span className="text-ink-2"> · {deltaText(s)}</span>}
                </span>
              )}
            </div>
            <ClaimsKanban s={s} />
          </div>
        )}

        {guards.length > 0 && (
          <div className="space-y-1">
            <div className="label-caps mb-2">Guardrails</div>
            {guards.map((c) => (
              <ClaimRow key={c.id} c={c} />
            ))}
          </div>
        )}

        {s.criteriaParseWarning && (
          <p className="flex items-start gap-2 text-[13px] text-ink-2">
            <span className="mt-1.5 flex shrink-0"><Marker dim="warn" /></span>
            ISA criteria could not be parsed ({s.criteriaParseWarning}) — showing frontmatter progress only.
          </p>
        )}

        {(s.agents?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {s.agents.map((a, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] ${
                  a.status === "active" ? "text-ink-1" : "text-ink-3"
                }`}
                title={a.task || a.name}
                data-sensitive
              >
                {a.status === "active" && <LiveDot active />}
                ⬡ {a.name.split("::").pop()} · {a.agentType}
              </span>
            ))}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// ─── One board row ───

function BoardRow({
  s,
  expanded,
  onToggle,
}: {
  s: AlgorithmState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lc = deriveLifecycle(s);
  const meta = LIFECYCLE_META[lc];
  const rework = (s.iteration ?? 1) > 1;
  const elapsed = s.active
    ? formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))
    : formatAgo(s.completedAt || s.phaseStartedAt || s.algorithmStartedAt);
  const expandable = s.tracked
    ? s.criteria.length > 0 || (s.climb?.length ?? 0) > 0 || !!s.intent
    : !!s.rawTask;

  return (
    <>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-line-1 text-left transition-colors ${
          expandable ? "hover:bg-surface-3 cursor-pointer" : "cursor-default"
        }`}
      >
        <LiveDot active={s.active} />

        <span
          className={`mono text-[10px] uppercase tracking-[0.1em] shrink-0 ${meta.dim ? "text-ink-3" : "text-ink-2"}`}
        >
          {meta.label}
        </span>

        {/* title */}
        <span className={`text-sm truncate flex-1 ${s.active ? "text-ink-1" : "text-ink-2"}`} data-sensitive>
          {s.taskDescription}
        </span>

        {/* live activity — what the tool stream says is happening */}
        <ActivityChip s={s} />

        {/* ISA badge — tracked rows announce themselves */}
        <ISABadge s={s} />

        {/* rework badge */}
        {rework && (
          <span className="flex items-center gap-1 text-ink-2 shrink-0" title={`Iteration ${s.iteration}`}>
            <RotateCcw className="w-3.5 h-3.5 text-ink-3" strokeWidth={1.5} />
            <span className="mono text-[11px]">×{s.iteration}</span>
          </span>
        )}

        {/* climb sparkline for tracked rows */}
        {s.tracked && s.progress.total > 0 && <ClimbChart state={s} variant="mini" />}

        {/* untracked: what it's doing — only when it adds information beyond the title */}
        {!s.tracked &&
          s.rawTask &&
          !s.taskDescription.toLowerCase().startsWith(s.rawTask.toLowerCase().slice(0, 24)) &&
          !s.rawTask.toLowerCase().startsWith(s.taskDescription.toLowerCase().slice(0, 24)) && (
            <span className="text-[13px] text-ink-3 truncate max-w-[280px] shrink-0" data-sensitive>{s.rawTask}</span>
          )}

        <span className="mono text-[11px] text-ink-3 shrink-0 w-16 text-right">{elapsed}</span>

        {expandable && (
          <ChevronRight
            className={`w-4 h-4 text-ink-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            strokeWidth={1.5}
          />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && expandable && (s.tracked ? <ClimbExpanded s={s} /> : <SessionExpanded s={s} />)}
      </AnimatePresence>
    </>
  );
}

// ─── Board Kanban — lifecycle lanes, sessions as cards ───
//
// Lanes are DERIVED states (lib/lifecycle.ts), so a card's lane is always
// true: it sits where its data puts it. Click a card to expand its detail
// below the lanes.

// Live sessions lead the board (2026-07-15): most real-time activity is
// untracked quick work, and burying it in the last lane made an active
// morning read as a dead board ("I'm doing work and I see nothing").
//
// 2026-07-22 hill-climb lanes (6-state fold 2026-07-30): the in-flight middle (Ascending/
// Verifying) derives from the live tool stream, so cards migrate as the work's
// character changes — the old Scoping/Climbing/Learning trio was static by
// construction (see lib/lifecycle.ts). Left→right is the arc of a run.
// Lane names are the ascent-table labels (LIFECYCLE_META.label) — the same
// names the Kitty tab, status line, cmux pill, and ISA mirror show — so a
// change in ascent.ts propagates here with no board edit.

// Lane membership is TABLE POLICY (ascent.ts `board` field), never a list
// spelled here — the local list drifted twice on 2026-07-28 alone. Columns are
// STATIC ({{PRINCIPAL_NAME}}, 2026-07-30: "static columns. They never change… the same
// columns that we have for the tab title, colors, names, and icons"): every
// run state is a permanent column, populated or not; only 'hidden' (idle)
// never renders. The conditional placements ('laneWhenPopulated', 'list') and
// the separate Done ledger they produced are retired.
const LANE_STATES: Lifecycle[] = LIFECYCLE_ORDER.filter(
  (lc) => LIFECYCLE_META[lc].board === "lane",
);

function SessionCard2({
  s,
  selected,
  onSelect,
}: {
  s: AlgorithmState;
  selected: boolean;
  onSelect: () => void;
}) {
  const rework = (s.iteration ?? 1) > 1;
  // Metadata footer (2026-07-28): everything here already rides AlgorithmState —
  // last tool from the live stream, rope team size, ISC movement. The card says
  // what the run is DOING, not just what it's called.
  const lastToolFresh =
    s.active && s.activity?.lastTool && s.activity.lastTs && Date.now() - s.activity.lastTs < ACTIVITY_FRESH_MS
      ? s.activity
      : null;
  const activeAgents = s.agents?.filter((a) => a.status === "active").length ?? 0;
  const delta = s.tracked ? deltaText(s) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-[10px] border p-2.5 transition-colors ${
        selected
          ? "border-[color:var(--accent-blue)] bg-[color:var(--primary-soft)]"
          : "border-line-2 hover:border-[color:var(--accent-blue)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
        <LiveDot active={s.active} />
        <ISABadge s={s} />
        <ActivityChip s={s} size="xs" />
        {rework && (
          <span className="mono text-[10px] text-ink-2 shrink-0">×{s.iteration}</span>
        )}
        <span className="mono text-[10px] text-ink-3 ml-auto shrink-0">
          {s.active
            ? formatElapsed(Date.now() - (s.algorithmStartedAt || Date.now()))
            : formatAgo(s.completedAt || s.phaseStartedAt || s.algorithmStartedAt)}
        </span>
      </div>
      <p className="text-[13px] leading-snug text-ink-1 line-clamp-2 mb-1.5" data-sensitive>{s.taskDescription}</p>
      {s.tracked && s.progress.total > 0 && (
        <div className="flex items-center gap-2">
          <ClimbChart state={s} variant="mini" />
        </div>
      )}
      {/* untracked: show the opening ask so the card says WHAT it is */}
      {!s.tracked && s.rawTask && !s.taskDescription.toLowerCase().startsWith(s.rawTask.toLowerCase().slice(0, 24)) && (
        <p className="text-[12px] leading-snug text-ink-3 line-clamp-2 mb-1" data-sensitive>“{s.rawTask}”</p>
      )}
      {(lastToolFresh || activeAgents > 0 || delta) && (
        <div className="flex items-center gap-2 mono text-[10px] text-ink-3 truncate">
          {lastToolFresh && (
            <span title={`Last tool call ${formatAgo(lastToolFresh.lastTs!)}`} className="truncate">
              ⌘ {lastToolFresh.lastTool}
              <span className="opacity-60"> {formatAgo(lastToolFresh.lastTs!)}</span>
            </span>
          )}
          {activeAgents > 0 && (
            <span className="text-ink-2 shrink-0" title={`${activeAgents} delegate agent${activeAgents > 1 ? "s" : ""} active`}>
              ⬡ {activeAgents}
            </span>
          )}
          {delta && (
            <span className="text-ink-2 shrink-0" title="ISC movement, last hour">
              {delta}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function BoardKanban({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: AlgorithmState[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  // Camped is tracked-only by construction (deriveLifecycle); untracked
  // quiet rows land in "idle", which the table marks 'hidden'.
  // Static columns ({{PRINCIPAL_NAME}}, 2026-07-30): every lane renders every load —
  // no populated-only filter, no separate Done block. Cairn is a column.
  const byLane = LANE_STATES.map((lc) => ({
    lc,
    label: LIFECYCLE_META[lc].label,
    items: sessions
      .filter((s) => deriveLifecycle(s) === lc)
      .sort((a, b) =>
        lc === "cairn"
          ? (b.completedAt || b.phaseStartedAt || 0) - (a.completedAt || a.phaseStartedAt || 0)
          : (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0),
      ),
  }));

  const selected = sessions.find((s) => s.sessionId === selectedId) || null;

  // The detail panel sits ABOVE the lanes and is always populated ({{PRINCIPAL_NAME}},
  // 2026-07-22: "highlighting one of the active tasks being worked on").
  // Manual selection wins; otherwise auto-spotlight the most recently active
  // tracked run so the climb visualization is live by default.
  const autoSpotlight =
    sessions
      .filter((s) => s.tracked && s.active && deriveLifecycle(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0))[0] || null;
  const displayed = selected || autoSpotlight;

  return (
    // ONE scroll container (2026-07-28): the lanes are the highlight and own
    // the viewport. The spotlight rides the viewport bottom via sticky (still
    // never below the fold — the 2026-07-22 rule holds). The Done list is the
    // LOWEST block on the page, past the spotlight — scroll to reach it, and
    // it never steals height from the columns.
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* All lanes fit the viewport width with no horizontal scroll (2026-07-20);
          below lg they wrap into two or three columns instead of squeezing. */}
      <div
        className="grid gap-2 p-3 grid-cols-2 sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--lanes),minmax(0,1fr))]"
        style={{ "--lanes": byLane.length } as React.CSSProperties}
      >
        {byLane.map((lane) => {
          return (
            <div key={lane.lc} className="rounded-[10px] border border-line-2 min-h-[120px] min-w-0">
              <div className="px-2.5 py-2 flex items-center gap-2 border-b border-line-2">
                <span className="label-caps min-w-0 break-words">{lane.label}</span>
                <span className="mono text-[11px] text-ink-3 ml-auto">{lane.items.length}</span>
              </div>
              {/* Columns flex between ≈4 rows (floor) and ≈8 rows (ceiling),
                  scrolling internally only past 8 (principal, 2026-07-28). Grid
                  stretch keeps every lane the height of the tallest one. */}
              <div className="p-1.5 space-y-1.5 min-h-[384px] max-h-[780px] overflow-y-auto">
                {lane.items.map((s) => (
                  <SessionCard2
                    key={s.sessionId}
                    s={s}
                    selected={displayed?.sessionId === s.sessionId}
                    onSelect={() => onSelect(selectedId === s.sessionId ? null : s.sessionId)}
                  />
                ))}
                {lane.items.length === 0 && (
                  <div className="text-[11px] text-ink-3 px-1 py-2">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spotlight — the selected (or auto-selected active) run's expanded
          detail. Sticky bottom: rides the viewport while the lanes scroll,
          never below the fold. Auto-populates with the most recent active
          tracked run. */}
      {displayed && (
        // sticky bottom: the live area rides the viewport — never below the
        // fold no matter the screen height or scroll position. Opaque ground
        // so lanes don't bleed through while scrolling behind it.
        <div className="mx-3 mb-3 shrink-0 sticky bottom-3 z-20 rounded-[10px] border border-line-3 bg-surface-1 max-h-[42vh] overflow-y-auto">
          <div className="px-4 py-2 flex items-center gap-2.5 bg-surface-1 border-b border-line-2 sticky top-0">
            <LiveDot active={displayed.active} />
            <ISABadge s={displayed} />
            <span className="text-sm text-ink-1 truncate">{displayed.taskDescription}</span>
            {!selected && (
              <span className="label-caps text-ink-3 ml-auto shrink-0">
                live spotlight
              </span>
            )}
          </div>
          {displayed.tracked ? <ClimbExpanded s={displayed} bare /> : <SessionExpanded s={displayed} bare />}
        </div>
      )}

      {/* The separate Done/cairn ledger is GONE (principal, 2026-07-30): columns
          are static and cairn is a real column like every other state. */}
    </div>
  );
}

// ─── Section header ───

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-4 py-2 flex items-center gap-2 border-b border-line-2">
      <span className="label-caps">{label}</span>
      <span className="mono text-[11px] text-ink-3 ml-auto">{count}</span>
    </div>
  );
}

// ─── Main board ───

export default function WorkBoard() {
  const { algorithmStates, pulseStrip, isLoading } = useAlgorithmState();
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Key bumped to v2 (2026-07-20): kanban is the default, and stale "list"
  // prefs saved under the old key must not override it.
  const [view, setView] = useState<"list" | "kanban">(() => {
    if (typeof window === "undefined") return "kanban";
    return (localStorage.getItem("workboard-view-v2") as "list" | "kanban") || "kanban";
  });
  const switchView = (v: "list" | "kanban") => {
    setView(v);
    try {
      localStorage.setItem("workboard-view-v2", v);
    } catch {}
  };

  // Satisfaction pulses, windowed to the last 24h — a week-old rating has no
  // business setting today's mood (2026-07-14 review: widget read a low score off
  // one stale rating). dayAgo is computed INSIDE the memo, not as a dep: a fresh
  // Date.now() every render would change the dep on every render and defeat the
  // memo entirely (full recompute per render). The window instead re-evaluates
  // whenever the data actually changes, which is the correct trigger.
  const pulses = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const all = [...(pulseStrip ?? []), ...algorithmStates.flatMap((s) => s.ratings ?? [])];
    return all.filter((p) => p.timestamp > dayAgo).sort((a, b) => a.timestamp - b.timestamp);
  }, [algorithmStates, pulseStrip]);

  const { activeClimbs, liveSessions, resumable, doneList } = useMemo(() => {
    const byFilter = (s: AlgorithmState) =>
      filter === "all" ? true : filter === "tracked" ? s.tracked : !s.tracked;

    const visible = algorithmStates.filter(byFilter);
    const lcOf = (s: AlgorithmState) => deriveLifecycle(s);

    const activeClimbs = visible
      .filter((s) => s.tracked && s.active && lcOf(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    const liveSessions = visible
      .filter((s) => !s.tracked && s.active)
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    const resumable = visible
      .filter((s) => s.tracked && !s.active && lcOf(s) !== "cairn")
      .sort((a, b) => (b.phaseStartedAt || 0) - (a.phaseStartedAt || 0));
    // Un-windowed 2026-07-28 (was 24h): done is a list, the registry fold is
    // the retention bound — matches the kanban's Done section.
    const doneList = visible
      .filter((s) => lcOf(s) === "cairn")
      .sort((a, b) => (b.completedAt || b.phaseStartedAt || 0) - (a.completedAt || a.phaseStartedAt || 0));

    return { activeClimbs, liveSessions, resumable, doneList };
  }, [algorithmStates, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-3">
        <Loader2 className="w-4 h-4 animate-spin mr-2" strokeWidth={1.5} />
        <span className="text-[13px]">Loading work...</span>
      </div>
    );
  }

  const empty =
    activeClimbs.length + liveSessions.length + resumable.length + doneList.length === 0;

  if (empty && filter === "all") {
    return (
      <div className="px-6 pt-5">
        <EmptyStateGuide
          section="Work"
          description="Tracked runs land here as climbs — claims closing on evidence until the summit. Untracked sessions show as live activity. Start work in any session and the board fills in."
          hideInterview
          daPromptExample="run the Algorithm on my next task"
        />
      </div>
    );
  }

  const totalDone = activeClimbs.reduce((n, s) => n + s.progress.done, 0);
  const totalClaims = activeClimbs.reduce((n, s) => n + s.progress.total, 0);
  // Aggregate ISC movement across active climbs — the live add/close pulse.
  const added1h = activeClimbs.reduce((n, s) => n + (s.iscDeltas?.added1h ?? 0), 0);
  const closed1h = activeClimbs.reduce((n, s) => n + (s.iscDeltas?.closed1h ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <QuickPulseStrip pulses={pulses} />

      {/* Summary + filter bar */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2">
        <TabBar tabs={FILTERS} active={filter} onChange={setFilter} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ml-auto">
          {totalClaims > 0 && (
            <div className="flex items-center gap-2">
              <span className="label-caps">Claims</span>
              <span className="mono text-[12px] text-ink-1">
                {totalDone}/{totalClaims}
              </span>
              {(added1h > 0 || closed1h > 0) && (
                <span className="mono text-[11px] text-ink-2" title="ISC movement across active climbs, last hour">
                  {added1h > 0 && `+${added1h}`}
                  {added1h > 0 && closed1h > 0 && " · "}
                  {closed1h > 0 && `✓${closed1h}`}
                </span>
              )}
            </div>
          )}
          <TabBar tabs={VIEWS} active={view} onChange={switchView} />
        </div>
      </div>

      {view === "kanban" && (
        <BoardKanban
          sessions={algorithmStates.filter((s) =>
            filter === "all" ? true : filter === "tracked" ? s.tracked : !s.tracked,
          )}
          selectedId={expandedId}
          onSelect={setExpandedId}
        />
      )}

      {view === "list" && (
      <>{/* list view */}

      <ScrollArea className="flex-1">
        {activeClimbs.length > 0 && (
          <div>
            <SectionHeader label="Active climbs" count={activeClimbs.length} />
            {activeClimbs.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {liveSessions.length > 0 && (
          <div>
            <SectionHeader label="Live sessions" count={liveSessions.length} />
            {/* Live rows drew a chevron that did nothing — same toggle as every
                other section. ported from public PR #1735, @elhoim */}
            {liveSessions.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {resumable.length > 0 && (
          <div>
            <SectionHeader label="Resumable" count={resumable.length} />
            {resumable.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}

        {doneList.length > 0 && (
          <div>
            <SectionHeader label={LIFECYCLE_META.cairn.label} count={doneList.length} />
            {doneList.map((s) => (
              <BoardRow
                key={s.sessionId}
                s={s}
                expanded={expandedId === s.sessionId}
                onToggle={() => setExpandedId(expandedId === s.sessionId ? null : s.sessionId)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      </>
      )}
    </div>
  );
}
