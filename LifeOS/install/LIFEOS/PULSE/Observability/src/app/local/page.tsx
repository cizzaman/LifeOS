"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { PageShell, PageHeader, Panel, TabBar, EmptyState, type TabSpec } from "@/components/ui/chrome";

type SourceStatus = "ok" | "unavailable" | "empty";
type Item = { title: string; source: string; url: string; date: string; summary?: string };
type FetchResult = { items: Item[]; source_status: SourceStatus; errors?: string[] };

interface Digest {
  meta: {
    city: string;
    state: string;
    county?: string;
    zip?: string;
    generated_at: string;
    sources_used: string[];
    sources_failed: string[];
    errors: string[];
  };
  construction: FetchResult;
  crime: FetchResult;
  business: FetchResult;
  officials: FetchResult;
  legislation: FetchResult;
  elections: FetchResult;
  arrests: FetchResult;
  news: FetchResult;
}

type SectionKey =
  | "construction"
  | "crime"
  | "business"
  | "officials"
  | "legislation"
  | "elections"
  | "arrests"
  | "news";

type HistoryItem = Item & { digest_date: string };

interface History {
  range: string;
  window_days: number;
  days_covered: number;
  first_date: string | null;
  last_date: string | null;
  city: string | null;
  state: string | null;
  sections: Record<SectionKey, { items: HistoryItem[]; days_with_data: number }>;
}

type Range = "day" | "week" | "month" | "year";
type SectionTab = "all" | SectionKey;

const RANGES: { id: Range; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

interface SectionDef {
  key: SectionKey;
  label: string;
  emptyHint: string;
}

const SECTIONS: SectionDef[] = [
  { key: "construction", label: "Construction", emptyHint: "No new construction permits in this window." },
  { key: "crime", label: "Crime", emptyHint: "No new crime stats in this window." },
  { key: "business", label: "New Business", emptyHint: "No new business openings in this window." },
  { key: "officials", label: "Officials", emptyHint: "No officials news in this window." },
  { key: "legislation", label: "Legislation", emptyHint: "No pending or enacted laws in this window." },
  { key: "elections", label: "Elections", emptyHint: "No upcoming elections." },
  { key: "arrests", label: "Arrests", emptyHint: "No new arrests reported in this window." },
  { key: "news", label: "Local News", emptyHint: "No local news in this window." },
];

const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, SectionDef>;

const STALE_AFTER_MS = 36 * 3600 * 1000;
// The refresh includes an AI research pass for sections the fetchers can't
// cover — allow minutes, not seconds, before giving up on the poll.
const REFRESH_POLL_MS = 6 * 60_000;

function fmtRangeDate(s: string | null, windowDays: number): string {
  if (!s) return "—";
  const t = new Date(`${s}T12:00:00`);
  if (!Number.isFinite(t.getTime())) return s;
  // Windows that can span a year boundary need the year or the strip reads
  // backwards ("Jul 18 – Jul 17").
  return t.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(windowDays > 31 ? { year: "numeric" } : {}),
  });
}

function shortDate(s: string): string {
  const t = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  if (!Number.isFinite(t.getTime())) return s;
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const ago = Math.floor((Date.now() - t) / 1000);
  // Future-dated items (bid deadlines, upcoming elections) get the absolute
  // date — a negative "-521489s ago" is a bug, not information.
  if (ago < 0) return shortDate(iso);
  if (ago < 60) return `${ago}s ago`;
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  if (ago < 86400 * 30) return `${Math.floor(ago / 86400)}d ago`;
  if (ago < 86400 * 365) return `${Math.floor(ago / (86400 * 30))}mo ago`;
  return `${Math.floor(ago / (86400 * 365))}y ago`;
}

/* ── Segmented time picker — deliberately NOT a pill row, so "when" reads as a
   different control class than the section "what" tabs below it. ── */
function TimePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex rounded-[10px] border border-line-2 overflow-hidden">
      {RANGES.map((r, i) => {
        const active = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={`px-3.5 py-1.5 text-[13px] transition-colors ${
              i > 0 ? "border-l border-line-2" : ""
            } ${active ? "" : "text-ink-3 hover:text-ink-1"}`}
            style={
              active
                ? {
                    color: "var(--ink-1)",
                    background: "var(--primary-soft)",
                    outline: "1px solid var(--accent-blue)",
                    outlineOffset: -1,
                  }
                : undefined
            }
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function RefreshButton({ refreshing, onClick }: { refreshing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={refreshing}
      className="inline-flex items-center gap-2 rounded-[10px] border border-line-2 hover:border-[color:var(--accent-blue)] hover:text-ink-1 disabled:opacity-50 px-3 py-1.5 text-sm text-ink-2 transition-colors"
    >
      <RefreshCw className={refreshing ? "w-4 h-4 animate-spin" : "w-4 h-4"} strokeWidth={1.5} />
      {refreshing ? "Researching…" : "Refresh now"}
    </button>
  );
}

function ItemRow({
  item,
  showAbsoluteDates,
}: {
  item: Item | HistoryItem;
  showAbsoluteDates: boolean;
}) {
  const when = item.date || (item as HistoryItem).digest_date || "";
  return (
    <li className="group">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <div className="text-[14px] font-medium text-ink-1 leading-snug underline-offset-4 decoration-line-3 group-hover:underline">
          {item.title}
        </div>
        {item.summary ? (
          <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">{item.summary}</p>
        ) : null}
        <div className="mt-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-3 flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words">{item.source}</span>
          {when ? (
            <>
              <span className="text-ink-3">·</span>
              <span>{showAbsoluteDates ? shortDate(when) : relativeTime(when)}</span>
            </>
          ) : null}
        </div>
      </a>
    </li>
  );
}

/* ── Compact card used in the All grid ── */
function SectionCard({
  section,
  items,
  status,
  emptyText,
  showAbsoluteDates,
  daysWithData,
  onOpen,
}: {
  section: SectionDef;
  items: (Item | HistoryItem)[];
  status?: SourceStatus;
  emptyText: string;
  showAbsoluteDates: boolean;
  daysWithData?: number;
  onOpen: () => void;
}) {
  const keyColor =
    status === "ok" ? "var(--ok)" : status === "empty" ? "var(--ink-3)" : status ? "var(--warn)" : "var(--ink-3)";
  return (
    <Panel as="section" hover className="flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button type="button" onClick={onOpen} className="label-caps cursor-pointer hover:text-ink-1 transition-colors" title={`Open ${section.label}`}>
          {section.label}
        </button>
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
          {items.length > 0 ? <span>{items.length}</span> : null}
          {daysWithData != null && daysWithData > 0 ? <span>· {daysWithData}d</span> : null}
          {status ? (
            <div className="flex items-center gap-1.5">
              <span className="fig-key" style={{ color: keyColor }} aria-hidden />
              <span>{status}</span>
            </div>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-ink-3">
          {status === "unavailable" ? "Source unavailable for this city." : emptyText}
        </p>
      ) : (
        <ul className="space-y-3.5 flex-1">
          {items.slice(0, 5).map((item, i) => (
            <li key={i} className="group">
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                <div className="text-[14px] font-medium text-ink-1 leading-snug underline-offset-4 decoration-line-3 group-hover:underline">
                  {item.title}
                </div>
                {item.summary && item.summary.toLowerCase() !== item.title.toLowerCase() ? (
                  <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">{item.summary}</p>
                ) : null}
                <div className="mt-1 mono text-[10px] uppercase tracking-[0.1em] text-ink-3 flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words">{item.source}</span>
                  {(item.date || (item as HistoryItem).digest_date) ? (
                    <>
                      <span className="text-ink-3">·</span>
                      <span>
                        {showAbsoluteDates
                          ? shortDate(item.date || (item as HistoryItem).digest_date)
                          : relativeTime(item.date || (item as HistoryItem).digest_date)}
                      </span>
                    </>
                  ) : null}
                </div>
              </a>
            </li>
          ))}
          {items.length > 5 ? (
            <li>
              <button
                type="button"
                onClick={onOpen}
                className="mono text-[10px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink-1 transition-colors"
              >
                +{items.length - 5} more →
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </Panel>
  );
}

/* ── Expanded single-section view — items grouped by date for range views ── */
function SectionDetail({
  section,
  items,
  status,
  range,
}: {
  section: SectionDef;
  items: (Item | HistoryItem)[];
  status?: SourceStatus;
  range: Range;
}) {
  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          title={status === "unavailable" ? "Source unavailable for this city." : section.emptyHint}
        />
      </Panel>
    );
  }

  if (range === "day") {
    return (
      <Panel as="section">
        <ul className="space-y-5">
          {items.map((item, i) => (
            <ItemRow key={i} item={item} showAbsoluteDates={false} />
          ))}
        </ul>
      </Panel>
    );
  }

  // Range views: group by the date the item entered the digest history.
  // Render cap keeps a year of dense data (hundreds of incidents) scrollable.
  const RENDER_CAP = 120;
  const capped = items.slice(0, RENDER_CAP);
  const overflow = items.length - capped.length;
  const groups = new Map<string, (Item | HistoryItem)[]>();
  for (const it of capped) {
    const d = (it as HistoryItem).digest_date || it.date || "undated";
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(it);
  }
  const ordered = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <Panel as="section">
      <div className="space-y-7">
        {overflow > 0 ? (
          <p className="mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
            showing newest {capped.length} of {items.length} items
          </p>
        ) : null}
        {ordered.map(([date, group]) => (
          <div key={date}>
            <div className="label-caps mb-3.5 pb-1.5 border-b border-line-2">
              {date === "undated" ? "Undated" : shortDate(date)}
            </div>
            <ul className="space-y-5">
              {group.map((item, i) => (
                <ItemRow key={i} item={item} showAbsoluteDates={range !== "week"} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function LocalPage() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [history, setHistory] = useState<Partial<Record<Range, History>>>({});
  const [range, setRange] = useState<Range>("day");
  const [section, setSection] = useState<SectionTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/local-intelligence", { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 404 ? "not-yet-generated" : `http_${res.status}`);
        setDigest(null);
        return;
      }
      const j = (await res.json()) as Digest;
      setDigest(j);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setDigest(null);
    }
  }, []);

  const loadHistory = useCallback(async (r: Exclude<Range, "day">) => {
    try {
      const res = await fetch(`/api/local-intelligence/history?range=${r}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as History;
      setHistory((h) => ({ ...h, [r]: j }));
    } catch {
      /* history is additive — the Day view still works without it */
    }
  }, []);

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/local-intelligence/refresh", { method: "POST" });
      const start = Date.now();
      while (Date.now() - start < REFRESH_POLL_MS) {
        await new Promise((r) => setTimeout(r, 5000));
        const res = await fetch("/api/local-intelligence", { cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as Digest;
          if (!digest || j.meta.generated_at !== digest.meta.generated_at) {
            setDigest(j);
            setError(null);
            setHistory({}); // invalidate range caches — today's digest changed
            break;
          }
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (range !== "day" && !history[range]) void loadHistory(range);
  }, [range, history, loadHistory]);

  if (error === "not-yet-generated") {
    return (
      <PageShell>
        <PageHeader title="Local" subtitle="Civic intelligence digest for your hometown." />
        <Panel className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <p className="font-medium text-ink-1">No digest generated yet.</p>
            <p className="text-sm text-ink-2 mt-1">
              The first refresh hasn&apos;t completed. Click below to run it now or wait for the daily 6 a.m. job.
            </p>
            <div className="mt-4">
              <RefreshButton refreshing={refreshing} onClick={refreshNow} />
            </div>
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Local" subtitle="Civic intelligence digest for your hometown." />
        <Panel className="flex items-start gap-2 text-sm text-ink-1">
          <span className="fig-key mt-[7px]" style={{ color: "var(--err)" }} aria-hidden />
          <span>Error loading digest: {error}</span>
        </Panel>
      </PageShell>
    );
  }

  if (!digest) {
    return (
      <PageShell>
        <PageHeader title="Local" subtitle="Civic intelligence digest for your hometown." />
        <EmptyState title="Loading…" />
      </PageShell>
    );
  }

  const { meta } = digest;
  const totalSources = meta.sources_used.length + meta.sources_failed.length;
  const generatedMs = new Date(meta.generated_at).getTime();
  const isStale = Number.isFinite(generatedMs) && Date.now() - generatedMs > STALE_AFTER_MS;
  const hist = range === "day" ? null : history[range];

  const itemsFor = (key: SectionKey): (Item | HistoryItem)[] =>
    range === "day" ? digest[key].items : (hist?.sections?.[key]?.items ?? []);
  const statusFor = (key: SectionKey): SourceStatus | undefined =>
    range === "day" ? digest[key].source_status : undefined;

  const totalItems = SECTIONS.reduce((a, s) => a + itemsFor(s.key).length, 0);

  const sectionTabs: TabSpec<SectionTab>[] = [
    { id: "all", label: "All", hint: totalItems || undefined },
    ...SECTIONS.map((s) => ({
      id: s.key as SectionTab,
      label: s.label,
      hint: itemsFor(s.key).length || undefined,
    })),
  ];

  const coverage =
    range === "day"
      ? `${totalItems} items today`
      : hist
        ? `${fmtRangeDate(hist.first_date, hist.window_days)} – ${fmtRangeDate(hist.last_date, hist.window_days)} · ${totalItems} items · ${hist.days_covered}/${hist.window_days} days covered`
        : "loading…";

  return (
    <PageShell>
      <PageHeader
        title="Local"
        subtitle={`${meta.city}, ${meta.state} — civic intelligence digest.`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2 max-w-[calc(100vw-2rem)]">
            <div className="flex flex-wrap items-center gap-2 mono text-[10px] uppercase tracking-[0.1em] text-ink-3">
              {meta.zip ? <span>{meta.zip}</span> : null}
              {meta.county ? (
                <>
                  <span className="text-ink-3">·</span>
                  <span>{meta.county} County</span>
                </>
              ) : null}
              <span className="text-ink-3">·</span>
              <span>refreshed {relativeTime(meta.generated_at)}</span>
              <span className="text-ink-3">·</span>
              <span className="text-ink-2">
                {meta.sources_used.length}/{totalSources} sources
              </span>
            </div>
            <RefreshButton refreshing={refreshing} onClick={refreshNow} />
          </div>
        }
      />

      {isStale ? (
        <Panel className="flex items-center gap-3 py-3">
          <span className="fig-key" style={{ color: "var(--warn)" }} aria-hidden />
          <p className="text-sm text-ink-2">
            This digest is <span className="text-ink-1 font-medium">{relativeTime(meta.generated_at)}</span> old —
            the daily 6 a.m. job may not be landing. Check the Assistant tab&apos;s cron panel or refresh now.
          </p>
        </Panel>
      ) : null}

      {/* WHEN — segmented control, visually distinct from the section pills */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <TimePicker value={range} onChange={setRange} />
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{coverage}</span>
      </div>

      {/* WHAT — section pill tabs */}
      <TabBar tabs={sectionTabs} active={section} onChange={setSection} />

      {section === "all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {SECTIONS.map((s) => (
            <SectionCard
              key={s.key}
              section={s}
              items={itemsFor(s.key)}
              status={statusFor(s.key)}
              emptyText={range !== "day" && !hist ? "Loading history…" : s.emptyHint}
              showAbsoluteDates={range === "month" || range === "year"}
              daysWithData={range === "day" ? undefined : hist?.sections?.[s.key]?.days_with_data}
              onOpen={() => setSection(s.key)}
            />
          ))}
        </div>
      ) : (
        <SectionDetail
          section={SECTION_BY_KEY[section]}
          items={itemsFor(section)}
          status={statusFor(section)}
          range={range}
        />
      )}

      {/* Errors (day view only — history views aggregate many runs) */}
      {range === "day" && section === "all" && meta.errors.length > 0 ? (
        <details className="text-xs text-ink-3 mono">
          <summary className="cursor-pointer hover:text-ink-1 uppercase tracking-[0.16em] text-[10px]">
            {meta.errors.length} source error{meta.errors.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 space-y-1 pl-4">
            {meta.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </PageShell>
  );
}
