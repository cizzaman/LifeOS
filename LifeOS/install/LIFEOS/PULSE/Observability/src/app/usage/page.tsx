"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TabBar,
  EmptyState,
  Marker,
  type Dim,
} from "@/components/ui/chrome";

/**
 * Usage tab — Anthropic subscription utilization + durable token/cost/model usage.
 * Zero data here; fetches /api/usage/{summary,trend,models}. The durable per-day
 * store behind trend/models is written nightly by LIFEOS/TOOLS/UsageAggregator.ts.
 */

interface Totals { totalTokens: number; costUsd: number; messages: number }
interface Summary {
  ts: string | null;
  subscription: { fiveHourPct: number | null; sevenDayPct: number | null };
  monthUsedUsd: number | null;
  monthUsedSource: string | null;
  today: Totals; week: Totals; month: Totals;
  hasDaily: boolean; daysTracked: number;
}
interface TrendPoint { label: string; totalTokens: number; costUsd: number; messages: number }
interface ModelRow { model: string; messages: number; totalTokens: number; costUsd: number; pct: number }

type Range = "daily" | "weekly" | "monthly";

const fmtTokens = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
const fmtUsd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

const RANGE_TABS: { id: Range; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export default function UsagePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [range, setRange] = useState<Range>("daily");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usage/summary", { cache: "no-store" }).then((r) => r.json()).then(setSummary).catch((e) => setError(String(e)));
    fetch("/api/usage/models?window=all", { cache: "no-store" }).then((r) => r.json()).then((d) => setModels(d.models ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/usage/trend?range=${range}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setTrend(d.points ?? [])).catch(() => {});
  }, [range]);

  const maxCost = useMemo(() => Math.max(1e-6, ...trend.map((p) => p.costUsd)), [trend]);

  return (
    <PageShell className="max-w-[1400px]">
      <PageHeader
        title="Usage"
        subtitle={
          <>
            Anthropic subscription utilization and Claude usage over time — models, tokens, and cost.
            {summary?.daysTracked ? ` ${summary.daysTracked} days tracked.` : ""}
            <span className="block text-[12px] text-ink-3 mt-1">
              <strong className="text-ink-2">Cost = what this usage would cost at list API prices if it were NOT on the subscription</strong> — the number that starts to matter as Fable moves off-plan. Per-model breakdown below. The &ldquo;API spend&rdquo; card is what&apos;s already billed outside the subscription (admin cost report).
            </span>
          </>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          <Marker dim="warn" />
          Couldn&apos;t reach Usage API: {error}
        </div>
      )}
      {!summary && !error && <div className="text-ink-3 text-[13px]">Loading…</div>}

      {summary && (
        <>
          {/* Subscription gauges */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GaugeCard label="5-hour window" pct={summary.subscription.fiveHourPct} />
            <GaugeCard label="7-day window" pct={summary.subscription.sevenDayPct} />
            <StatTile label="API spend (month)" value={fmtUsd(summary.monthUsedUsd)} sub={summary.monthUsedSource ?? ""} />
            <StatTile label="Messages (30d)" value={summary.month.messages.toLocaleString()} sub={`${fmtTokens(summary.month.totalTokens)} tokens`} />
          </div>

          {/* Today / week / month token+cost */}
          <div className="grid gap-3 sm:grid-cols-3">
            <PeriodCard label="Today" t={summary.today} />
            <PeriodCard label="This week" t={summary.week} />
            <PeriodCard label="This month" t={summary.month} />
          </div>

          {!summary.hasDaily && (
            <div className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2 rounded-[10px] border border-line-2 px-3 py-2">
              <span className="pt-[7px]"><Marker dim="warn" /></span>
              <span>
                No per-day rollup yet. Run <code className="mono text-[12px] text-ink-1 break-all">bun ~/.claude/LIFEOS/TOOLS/UsageAggregator.ts</code> (or wait for the nightly job) to populate token/cost history.
              </span>
            </div>
          )}

          {/* Trend */}
          <Panel>
            <PanelHeader
              title="Cost trend"
              actions={<TabBar tabs={RANGE_TABS} active={range} onChange={setRange} />}
            />
            {trend.length === 0 ? (
              <EmptyState title="No data for this range yet." />
            ) : (
              <div className="flex items-end gap-1 h-48">
                {trend.map((p) => (
                  <div key={p.label} className="flex-1 h-full flex flex-col items-center justify-end min-w-0" title={`${p.label}: ${fmtUsd(p.costUsd)} · ${fmtTokens(p.totalTokens)} tok · ${p.messages} msgs`}>
                    <div
                      className="w-full transition-colors"
                      style={{
                        height: `${Math.max(2, (p.costUsd / maxCost) * 100)}%`,
                        border: "1px solid var(--accent-blue)",
                        background: "var(--primary-soft)",
                      }}
                    />
                    <div className="mono text-[10px] leading-tight text-ink-3 mt-1 w-full text-center">{p.label.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Model mix */}
          <Panel>
            <PanelHeader title="Model mix (all time)" />
            {models.length === 0 ? (
              <EmptyState title="No model data yet." />
            ) : (
              <div className="flex flex-col gap-3">
                {models.map((m) => (
                  <div key={m.model} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
                      <span className="text-ink-1 break-words">{m.model}</span>
                      <span className="mono text-[11px] text-ink-3">
                        {m.pct}% · {m.messages.toLocaleString()} msgs · {fmtTokens(m.totalTokens)} tok · {fmtUsd(m.costUsd)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${Math.max(1, m.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </PageShell>
  );
}

function GaugeCard({ label, pct }: { label: string; pct: number | null }) {
  const v = pct ?? 0;
  const dim: Dim = pct == null ? "neutral" : v >= 85 ? "err" : v >= 60 ? "warn" : "ok";
  return (
    <StatTile
      label={label}
      value={pct == null ? "—" : `${pct}%`}
      dim={dim}
      sub={
        <div className="progress-bar mt-1">
          <div className="progress-bar-fill" style={{ width: `${Math.min(100, v)}%` }} />
        </div>
      }
    />
  );
}

function PeriodCard({ label, t }: { label: string; t: Totals }) {
  return (
    <Panel className="p-4 flex flex-col gap-2">
      <span className="label-caps">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="mono text-[20px] leading-tight text-ink-1">{fmtUsd(t.costUsd)}</span>
        <span className="mono text-[11px] text-ink-3">{fmtTokens(t.totalTokens)} tok · {t.messages} msgs</span>
      </div>
    </Panel>
  );
}
