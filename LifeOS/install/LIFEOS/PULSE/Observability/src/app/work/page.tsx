"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import ProjectsBoard, { type ProjectGroup } from "@/components/ProjectsBoard";
import { PageShell, PageHeader, Panel, TabBar, Pill, EmptyState, Marker } from "@/components/ui/chrome";

interface AlgorithmSession {
  slug: string;
  task: string;
  phase: string;
  progress?: string;
  effort?: string;
}

interface WorkData {
  projects?: Array<{ name: string; path: string; url: string }>;
  currentFocus?: string;
  currentProject?: string;
  activeWorkstreams?: string;
  algorithmSessions?: AlgorithmSession[];
}

interface KanbanIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  assignees: string[];
  ageHours: number;
  column: string;
  updatedAt: string;
  source?: string;
  principal_stated_goal?: string;
}

interface KanbanData {
  setup_required?: boolean;
  reason?: string;
  instructions?: string[];
  config?: { repo: string; columns: string[]; poll_interval_seconds: number };
  columns?: Record<string, KanbanIssue[]>;
  items?: KanbanIssue[];
  lastFetch?: string | null;
  stale?: boolean;
  stale_reason?: string;
}

// Hairline control: small caps text, teal border on hover.
const BTN =
  "inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.16em] px-2.5 py-1 rounded-[10px] border border-line-2 text-ink-2 hover:text-ink-1 hover:border-[color:var(--accent-blue)] transition-colors cursor-pointer";
const BTN_ICON =
  "inline-flex items-center p-1 rounded-[10px] border border-line-2 text-ink-3 hover:text-ink-1 hover:border-[color:var(--accent-blue)] transition-colors cursor-pointer";

function progressPct(p?: string): number {
  if (!p) return 0;
  const m = p.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return 0;
  const [, done, total] = m;
  const d = parseInt(done, 10);
  const t = parseInt(total, 10);
  return t > 0 ? Math.round((d / t) * 100) : 0;
}

function Banner({
  focus,
  current,
  streams,
  sessionCount,
  projectCount,
}: {
  focus?: string;
  current?: string;
  streams?: string;
  sessionCount: number;
  projectCount: number;
}) {
  return (
    <Panel>
      <div className="label-caps mb-2">Current Focus</div>
      {focus ? (
        <p
          className="text-ink-1"
          style={{ font: "500 clamp(20px, 2.4vw, 28px)/1.3 var(--font-display)", letterSpacing: "-0.01em" }}
          data-sensitive="strong"
        >
          {focus}
        </p>
      ) : (
        <p className="text-[15px] text-ink-3">No current focus set in TELOS/CURRENT.md</p>
      )}
      {current && (
        <p className="text-sm mt-3 text-ink-2" data-sensitive>
          <span>Primary project:</span> {current}
        </p>
      )}
      {streams && (
        <p className="text-xs mt-2 text-ink-2" data-sensitive>
          Streams: {streams}
        </p>
      )}
      <div className="mt-4 flex gap-4 flex-wrap">
        <Pill>{sessionCount} active sessions</Pill>
        <Pill>{projectCount} projects</Pill>
      </div>
    </Panel>
  );
}

function AlgorithmSessions({ sessions }: { sessions?: AlgorithmSession[] }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <section>
      <h2 className="label-caps mb-4">
        Algorithm Sessions <span className="text-ink-3">({sessions.length})</span>
      </h2>
      <Panel className="p-0">
        <div>
          {sessions.slice(0, 10).map((s, i) => {
            const phase = (s.phase || "unknown").toUpperCase();
            const pct = progressPct(s.progress);
            return (
              <div
                key={s.slug}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${i === 0 ? "" : "border-t border-line-1"}`}
                data-sensitive
              >
                <Pill className="w-[90px] shrink-0 justify-center">{phase}</Pill>
                <div className="flex-1 min-w-[12rem]">
                  <div className="text-sm break-words text-ink-1" data-sensitive>
                    {s.task}
                  </div>
                  <div className="mono text-[12px] mt-0.5 break-all text-ink-3">{s.slug}</div>
                </div>
                <div className="w-28 shrink-0">
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: pct + "%" }} />
                  </div>
                  <div className="mono text-[11px] text-right mt-1 text-ink-3">{s.progress}</div>
                </div>
                {s.effort && <Pill className="shrink-0">{s.effort}</Pill>}
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

// ── Work items (GitHub Issues, polled from /api/work) ──────────────────────
// One fetch lives in WorkItemsPanel and feeds BOTH the List and Kanban views —
// they are two renderings of one dataset, never two fetches.

// Canonical kanban pipeline order — Status sort uses this, NOT alphabetical.
const STATUS_ORDER = ["Inbox", "Queued", "Ready", "In-Progress", "Blocked", "In-Review", "Complete", "Done"];

function statusRank(col: string): number {
  const i = STATUS_ORDER.indexOf(col);
  return i === -1 ? 99 : i;
}

function ageStr(h: number): string {
  if (h < 1) return "just now";
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d";
  return Math.floor(d / 7) + "w";
}

function cleanTitle(t: string): string {
  return t
    .replace(/\s*\[slug:[^\]]+\]\s*$/, "")
    .replace(/\s*\[goal:[^\]]+\]\s*$/, "")
    .trim();
}

// Priority: parse "Priority:P0".."Priority:P3" or bare "P0-…"; no priority → 4 (sinks below P3).
function priorityRank(labels: string[]): number {
  for (const l of labels) {
    const m = l.match(/^Priority:P([0-3])$/i) || l.match(/^P([0-3])\b/i);
    if (m) return parseInt(m[1], 10);
  }
  return 4;
}

function priorityLabel(labels: string[]): string | null {
  const r = priorityRank(labels);
  return r < 4 ? "P" + r : null;
}

function propValue(labels: string[]): string | null {
  for (const l of labels) {
    const m = l.match(/^Property:(.+)$/i);
    if (m) return m[1].toLowerCase();
  }
  for (const l of labels) {
    const lc = l.toLowerCase();
    if (["newsletter", "website", "youtube", "podcast", "community", "consulting", "open-source", "internal", "pai", "life"].includes(lc)) return lc;
  }
  return null;
}

// The canonical Type:* on an issue. Prefers a real type over the generic
// Type:queue when an issue still carries both.
function typeValue(labels: string[]): string | null {
  const types = labels
    .map((l) => { const m = l.match(/^Type:(.+)$/i); return m ? m[1].toLowerCase() : null; })
    .filter(Boolean) as string[];
  if (types.length === 0) return null;
  return types.find((t) => t !== "queue") ?? types[0];
}

function relativeUpdated(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d";
  return Math.floor(d / 7) + "w";
}

// Internal sync-marker labels hidden from Kanban chips. A set (not a single
// literal) so a marker rename can't leak the chip onto every card — `pai-sync`
// is the legacy pre-rebrand name still emitted today (public issue #1497).
const HIDDEN_LABELS = new Set(["pai-sync", "lifeos-sync"]);

function KanbanCard({ issue }: { issue: KanbanIssue }) {
  const labels = (issue.labels || []).filter((l) => !HIDDEN_LABELS.has(l));
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noreferrer"
      className="block no-underline border border-line-2 rounded-[10px] px-3 py-2.5 mb-2 transition-colors duration-200 hover:border-[color:var(--accent-blue)]"
    >
      <div className="mono text-[11px] text-ink-3 mb-1">
        #{issue.number}
      </div>
      <div className="text-[13px] leading-snug mb-1.5 text-ink-1 break-words" data-sensitive>
        {cleanTitle(issue.title)}
      </div>
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
          {labels.slice(0, 4).map((l) => (
            <Pill key={l} className="whitespace-normal break-all">{l}</Pill>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center gap-2 mt-1.5 mono text-[11px] text-ink-3">
        <span className="text-ink-2 break-all">
          {issue.assignees && issue.assignees.length > 0 ? "@" + issue.assignees.join(" @") : ""}
        </span>
        <span>{ageStr(issue.ageHours)}</span>
      </div>
    </a>
  );
}

// ── Kanban view (presentational — data comes from the panel) ───────────────

function KanbanView({ data }: { data: KanbanData }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const COLUMN_WIDTH = 220;
  const COLUMN_GAP = 12;

  const scrollByCol = (dir: -1 | 1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * (COLUMN_WIDTH + COLUMN_GAP), behavior: "smooth" });
  };

  const cols = data.config?.columns ?? [];
  const grouped = data.columns ?? {};

  return (
    <div>
      <div className="flex justify-end gap-1.5 mb-2">
        <button onClick={() => scrollByCol(-1)} className={BTN_ICON} aria-label="Scroll columns left">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button onClick={() => scrollByCol(1)} className={BTN_ICON} aria-label="Scroll columns right">
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="kanban-scroll"
        style={{
          display: "flex",
          gap: COLUMN_GAP,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 16,
          scrollSnapType: "x proximity",
          scrollBehavior: "smooth",
        }}
      >
        {cols.map((col) => {
          const items = grouped[col] || [];
          return (
            <div
              key={col}
              className="border border-line-2 rounded-[10px]"
              style={{
                padding: 0,
                display: "flex",
                flexDirection: "column",
                width: 220,
                flex: "0 0 220px",
                maxHeight: "70vh",
                scrollSnapAlign: "start",
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line-1">
                <Marker />
                <span className="label-caps">{col}</span>
                <span className="mono text-[11px] text-ink-3 ml-auto">{items.length}</span>
              </div>
              <div style={{ padding: 8, minHeight: 80, overflowY: "auto", flex: 1 }}>
                {items.length === 0 ? (
                  <div className="text-[12px] text-center text-ink-3 py-4">
                    empty
                  </div>
                ) : (
                  items.map((issue) => <KanbanCard key={issue.number} issue={issue} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List view (sortable flat list — the default tab) ───────────────────────

type SortKey = "updated" | "priority" | "status" | "age" | "title" | "number";
type SortDir = 1 | -1;

// First-click direction per key — one click always does the obvious thing.
const SORT_FIRST_DIR: Record<SortKey, SortDir> = {
  updated: -1, // newest first
  priority: 1, // P0 first
  status: 1, // pipeline order Inbox→Complete
  age: -1, // oldest first
  title: 1, // A→Z
  number: -1, // highest # first
};

function compareBy(a: KanbanIssue, b: KanbanIssue, key: SortKey): number {
  switch (key) {
    case "updated": return (Date.parse(a.updatedAt) || 0) - (Date.parse(b.updatedAt) || 0);
    case "priority": return priorityRank(a.labels || []) - priorityRank(b.labels || []);
    case "status": return statusRank(a.column) - statusRank(b.column);
    case "age": return (a.ageHours || 0) - (b.ageHours || 0);
    case "title": return cleanTitle(a.title).localeCompare(cleanTitle(b.title), undefined, { sensitivity: "base", numeric: true });
    case "number": return a.number - b.number;
  }
}

const SORT_STORAGE_KEY = "pulse.work.list.sort";

function SortHeader({
  label,
  col,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  col: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={() => onSort(col)}
      className={`label-caps inline-flex items-center gap-1 w-full p-0 bg-transparent border-0 cursor-pointer hover:!text-ink-1 ${align === "right" ? "justify-end" : "justify-start"}`}
      style={{ color: active ? "var(--ink-1)" : "var(--ink-3)" }}
    >
      {label}
      {active ? (
        dir === -1 ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} /> : <ChevronUp className="w-3 h-3" strokeWidth={1.5} />
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-40" strokeWidth={1.5} />
      )}
    </button>
  );
}

const LIST_GRID = "16px 28px 48px minmax(190px, 1fr) 96px 104px 96px 52px 66px 20px";

function WorkList({ data }: { data: KanbanData }) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>(-1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Restore persisted sort once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.key === "string") setSortKey(p.key);
        if (p && (p.dir === 1 || p.dir === -1)) setSortDir(p.dir);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const onSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => {
        const nd = (d === 1 ? -1 : 1) as SortDir;
        try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: k, dir: nd })); } catch { /* ignore */ }
        return nd;
      });
    } else {
      const nd = SORT_FIRST_DIR[k];
      setSortKey(k);
      setSortDir(nd);
      try { localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: k, dir: nd })); } catch { /* ignore */ }
    }
  };

  const allItems = data.items ?? [];
  const typesPresent = Array.from(
    new Set(allItems.map((i) => typeValue(i.labels || [])).filter(Boolean) as string[]),
  ).sort();
  const typeCount = (t: string) => allItems.filter((i) => typeValue(i.labels || []) === t).length;
  const items = typeFilter === "all" ? allItems : allItems.filter((i) => typeValue(i.labels || []) === typeFilter);
  const sorted = items.slice().sort((a, b) => {
    const c = compareBy(a, b, sortKey) * sortDir;
    if (c !== 0) return c;
    return a.number - b.number; // stable tiebreak so re-sorts don't jitter
  });

  if (allItems.length === 0) {
    return (
      <Panel>
        <EmptyState title="No work items. You're clear." />
      </Panel>
    );
  }

  return (
    <Panel className="p-0 overflow-hidden">
      {/* Filter toolbar */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-line-1 flex-wrap">
        <span className="label-caps" style={{ color: "var(--ink-3)" }}>Type</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-ground text-ink-1 border border-line-2 rounded-[10px] px-2 py-1 mono text-[12px] cursor-pointer"
        >
          <option value="all">all ({allItems.length})</option>
          {typesPresent.map((t) => (
            <option key={t} value={t}>{t} ({typeCount(t)})</option>
          ))}
        </select>
        {typeFilter !== "all" && (
          <button onClick={() => setTypeFilter("all")} className={BTN}>
            clear
          </button>
        )}
        <span className="flex-1" />
        <span className="mono text-[11px] text-ink-3">{sorted.length} shown</span>
      </div>
      {/* Header row */}
      <div
        className="grid items-center px-3.5 py-2.5 border-b border-line-2 sticky top-0 z-[1] bg-ground"
        style={{ gridTemplateColumns: LIST_GRID, gap: 10 }}
      >
        <span />
        <SortHeader label="P" col="priority" active={sortKey === "priority"} dir={sortDir} onSort={onSort} />
        <SortHeader label="#" col="number" active={sortKey === "number"} dir={sortDir} onSort={onSort} align="right" />
        <SortHeader label="Title" col="title" active={sortKey === "title"} dir={sortDir} onSort={onSort} />
        <span className="label-caps" style={{ color: "var(--ink-3)" }}>Type</span>
        <SortHeader label="Status" col="status" active={sortKey === "status"} dir={sortDir} onSort={onSort} />
        <span className="label-caps" style={{ color: "var(--ink-3)" }}>Property</span>
        <SortHeader label="Age" col="age" active={sortKey === "age"} dir={sortDir} onSort={onSort} align="right" />
        <SortHeader label="Updated" col="updated" active={sortKey === "updated"} dir={sortDir} onSort={onSort} align="right" />
        <span />
      </div>

      {/* Rows */}
      <div>
        {sorted.length === 0 && (
          <div className="text-ink-3 text-center text-[12px] px-4 py-6">
            No {typeFilter} items match.
          </div>
        )}
        {sorted.map((it) => {
          const isClosed = it.state === "CLOSED";
          const prio = priorityLabel(it.labels || []);
          const prop = propValue(it.labels || []);
          const tv = typeValue(it.labels || []);
          const isExpanded = expanded === it.number;
          return (
            <div key={it.number}>
              <div
                onClick={() => setExpanded(isExpanded ? null : it.number)}
                style={{
                  display: "grid",
                  gridTemplateColumns: LIST_GRID,
                  gap: 10,
                  alignItems: "center",
                  padding: "7px 14px",
                  borderBottom: "1px solid var(--line-1)",
                  cursor: "pointer",
                  opacity: isClosed ? 0.55 : 1,
                  background: isExpanded ? "var(--surface-3)" : undefined,
                }}
                className="work-row"
              >
                {/* status key: filled open, outlined closed */}
                <span className="inline-flex justify-center">
                  <Marker shape="circle" filled={!isClosed} />
                </span>
                {/* priority */}
                <span className="inline-flex justify-center mono text-[10px] text-ink-2">
                  {prio ?? null}
                </span>
                {/* number */}
                <span className="mono text-[12px] text-right text-ink-3">
                  #{it.number}
                </span>
                {/* title */}
                <span className="text-ink-1 text-[13px] min-w-0 break-words" data-sensitive>
                  {cleanTitle(it.title)}
                </span>
                {/* type */}
                <span className="flex min-w-0">
                  {tv ? <Pill className="whitespace-normal break-all">{tv}</Pill> : null}
                </span>
                {/* status */}
                <Pill className="justify-self-start whitespace-normal">{it.column}</Pill>
                {/* property */}
                <span className="text-ink-3 text-[11px] min-w-0 break-words">
                  {prop ?? ""}
                </span>
                {/* age */}
                <span className="mono text-[11px] text-right text-ink-3">
                  {ageStr(it.ageHours)}
                </span>
                {/* updated */}
                <span className="mono text-[11px] text-right text-ink-3">
                  {relativeUpdated(it.updatedAt)}
                </span>
                {/* open in github */}
                <a
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex justify-center text-ink-3 hover:text-ink-1 transition-colors"
                  aria-label="Open in GitHub"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                </a>
              </div>

              {/* Expanded detail — leads with the principal-stated goal (the "why"). */}
              {isExpanded && (
                <div className="border-b border-line-1" style={{ padding: "10px 16px 14px 16px" }}>
                  {it.principal_stated_goal && (
                    <p className="text-[12px] text-ink-2 mb-2" data-sensitive>
                      <span className="text-ink-3">why:</span> {it.principal_stated_goal}
                    </p>
                  )}
                  <p className="text-ink-1 text-[13px] mb-2 leading-snug break-words" data-sensitive>{cleanTitle(it.title)}</p>
                  {(it.labels || []).filter((l) => !HIDDEN_LABELS.has(l)).length > 0 && (
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 mb-2">
                      {(it.labels || []).filter((l) => !HIDDEN_LABELS.has(l)).map((l) => (
                        <Pill key={l} className="whitespace-normal break-all">{l}</Pill>
                      ))}
                    </div>
                  )}
                  <div className="mono text-[11px] text-ink-3 flex gap-3.5 flex-wrap items-center">
                    <span>state: {it.state}</span>
                    {it.assignees && it.assignees.length > 0 && <span>@{it.assignees.join(" @")}</span>}
                    {it.source && <span>source: {it.source}</span>}
                    <span>age {ageStr(it.ageHours)}</span>
                    <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink-1 transition-colors">
                      <ExternalLink className="w-3 h-3" strokeWidth={1.5} /> Open in GitHub
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Work items panel — owns the single /api/work fetch + List/Kanban tabs ──

function WorkItemsPanel() {
  const [data, setData] = useState<KanbanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"list" | "kanban">("list");

  const load = async () => {
    try {
      const r = await fetch("/api/work", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/work/refresh", { method: "POST" });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (error) {
    return (
      <section>
        <h2 className="label-caps mb-4">Work</h2>
        <Panel>
          <p className="text-sm text-ink-1 flex items-center gap-2">
            <Marker dim="err" /> Failed to load /api/work — {error}
          </p>
        </Panel>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <h2 className="label-caps mb-4">Work</h2>
        <div className="text-sm text-ink-2">Loading work items...</div>
      </section>
    );
  }

  if (data.setup_required) {
    return (
      <section>
        <h2 className="label-caps mb-4 flex items-center gap-2">
          <Marker dim="warn" /> Work — setup required
        </h2>
        <Panel>
          <p className="text-sm text-ink-2">{data.reason}</p>
          <ol className="text-sm mt-3 ml-5 space-y-1 text-ink-1" style={{ listStyle: "decimal" }}>
            {(data.instructions || []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Panel>
      </section>
    );
  }

  const total = data.items?.length ?? 0;

  const meta = (
    <>
      <span className="mono text-[11px] text-ink-3 hidden sm:inline">
        {total} issues · <span data-sensitive>{data.config?.repo}</span> · poll {data.config?.poll_interval_seconds}s
        {data.lastFetch && ` · last fetch ${new Date(data.lastFetch).toLocaleTimeString()}`}
      </span>
      <button onClick={handleRefresh} disabled={refreshing} className={BTN}>
        <RefreshCw className="w-3 h-3" strokeWidth={1.5} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />
        {refreshing ? "Refreshing" : "Refresh"}
      </button>
    </>
  );

  return (
    <section>
      <TabBar<"list" | "kanban">
        className="mb-4"
        tabs={[
          { id: "list", label: "List" },
          { id: "kanban", label: "Kanban" },
        ]}
        active={tab}
        onChange={setTab}
        right={meta}
      />

      {data.stale && (
        <Panel className="mb-3 py-3">
          <p className="text-xs text-ink-2 flex items-center gap-2">
            <Marker dim="warn" /> Stale data — {data.stale_reason || "gh fetch failed; showing cached snapshot"}
          </p>
        </Panel>
      )}

      {tab === "list" ? <WorkList data={data} /> : <KanbanView data={data} />}
    </section>
  );
}

// ── Page-level area tabs ─────────────────────────────────────────────────────
// Board and Sessions are fixed areas; every group /api/projects returns becomes
// its own tab (live / telos / retired today — new source files appear with no
// code change here beyond an optional icon mapping).

type AreaTab = string;

export default function WorkPage() {
  const [data, setData] = useState<WorkData | null>(null);
  const [projectsData, setProjectsData] = useState<{ groups?: ProjectGroup[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AreaTab>("board");

  // ?tab= deep link (/work?tab=telos) — read after hydration; an initializer
  // that reads window.location diverges from the static prerender and loses.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t) setTab(t);
  }, []);

  useEffect(() => {
    fetch("/api/life/work")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch((e) => setError(String(e)));
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setProjectsData)
      .catch(() => setProjectsData(null));
  }, []);

  // Keep ?tab= in the URL so tabs are linkable/refresh-stable without a nav.
  const selectTab = (t: AreaTab) => {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "board") u.searchParams.delete("tab");
    else u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u.toString());
  };

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Work" subtitle="Focus, work items, sessions, and projects" />
        <Panel>
          <h2 className="flex items-center gap-2 text-[15px] text-ink-1">
            <Marker dim="err" /> Failed to load work
          </h2>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell>
        <PageHeader title="Work" subtitle="Focus, work items, sessions, and projects" />
        <div className="text-sm text-ink-2">Loading Work...</div>
      </PageShell>
    );
  }

  const groups = projectsData?.groups ?? [];
  const sessionCount = data.algorithmSessions?.length ?? 0;
  const liveCount = groups.find((g) => g.key === "live")?.count ?? 0;
  const showEmptyGuide = sessionCount === 0 && liveCount === 0 && !data.currentFocus && !data.currentProject;
  const activeGroup = groups.find((g) => g.key === tab);

  return (
    <PageShell>
      <PageHeader title="Work" subtitle="Focus, work items, sessions, and projects" />
      {showEmptyGuide && (
        <EmptyStateGuide
          section="Work Hub"
          description="Active tasks, projects, and team work. Wire it up to GitHub Issues, Linear, ClickUp, or another PM tool to populate."
          hideInterview
          daPromptExample="set up my work hub against my project tracker"
        />
      )}
      <Banner
        focus={data.currentFocus}
        current={data.currentProject}
        streams={data.activeWorkstreams}
        sessionCount={sessionCount}
        projectCount={liveCount}
      />

      <TabBar<AreaTab>
        active={activeGroup ? tab : tab === "sessions" ? "sessions" : "board"}
        onChange={selectTab}
        tabs={[
          { id: "board", label: "Board" },
          { id: "sessions", label: "Sessions", hint: sessionCount || undefined },
          ...groups.map((g) => ({ id: g.key, label: g.label, hint: g.count })),
        ]}
      />

      {activeGroup ? (
        <ProjectsBoard group={activeGroup} />
      ) : tab === "sessions" ? (
        <AlgorithmSessions sessions={data.algorithmSessions} />
      ) : (
        <>
          <WorkItemsPanel />
          <AlgorithmSessions sessions={data.algorithmSessions} />
        </>
      )}
    </PageShell>
  );
}
