"use client";

import { useState, useEffect, useCallback } from "react";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TabBar,
  Marker,
  dimStyle,
  type Dim,
  type TabSpec,
} from "@/components/ui/chrome";

type Tab = "cost" | "failures" | "anthropic";

interface AnthropicSnapshot {
  ts: string;
  subscription: { five_hour_pct: number | null; seven_day_pct: number | null };
  api_spend: { month_used_usd: number | null; source: string };
  call_sites: { total: number; bypass: number; legit: number; new_since_baseline: string[] };
  alerts: string[];
}

interface AnthropicCallSite {
  file: string;
  line: number;
  classification: "bypass" | "legit" | "unknown";
  reason: string;
}

interface AnthropicData {
  current: AnthropicSnapshot | null;
  history: AnthropicSnapshot[];
  total_entries: number;
  sites: AnthropicCallSite[];
  baseline_updated: string | null;
}

interface CostData {
  days: number;
  totalSessions: number;
  totalCost: number;
  totalTokens: number;
  avgCostPerSession: number;
  costBreakdown: { input: number; output: number; cacheWrite: number; cacheRead: number };
  byModel: Array<{ model: string; cost: number; sessions: number; tokens: number }>;
  dailyCosts: Array<{ day: string; cost: number }>;
  topSessions: Array<{
    sessionId: string;
    project: string;
    primaryModel: string;
    messageCount: number;
    costTotal: number;
    totalTokens: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }>;
}

interface FailureData {
  totalFailures: number;
  totalCalls: number;
  overallRate: number;
  byTool: Array<{ tool: string; failures: number; calls: number; failureRate: number }>;
  trend: Array<{ day: string; failures: number; total: number; rate: number }>;
}

function formatCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortModel(m: string): string {
  if (m.includes("fable")) {
    const ver = m.match(/fable-(\d+)/)?.[1];
    return ver ? `Fable ${ver}` : "Fable";
  }
  if (m.includes("opus")) return "Opus";
  if (m.includes("haiku")) return "Haiku";
  if (m.includes("sonnet")) return "Sonnet";
  return m.slice(0, 20);
}

const rowHoverIn = (e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = "var(--surface-3)");
const rowHoverOut = (e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = "transparent");

/** Outlined bar mark: 1px stroke in the series colour over a faint fill of the same colour. */
const barMark = (color = "var(--accent-blue)"): React.CSSProperties => ({
  border: `1px solid ${color}`,
  background: `color-mix(in srgb, ${color} 12%, transparent)`,
});

function CostTab({ data }: { data: CostData | null }) {
  if (!data) return <div className="p-8 text-ink-3">Loading cost data...</div>;

  const maxDaily = Math.max(...data.dailyCosts.map((d) => d.cost), 1);
  const isEmpty = data.totalSessions === 0 && data.totalCost === 0 && data.totalTokens === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <EmptyStateGuide
          section="Performance"
          description="Runtime telemetry — tool latency, model timing, agent durations. Populates as you use LifeOS."
          hideInterview
          daPromptExample="show me where my sessions are spending time"
        />
      )}
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={`Total (${data.days}d)`}
          value={formatCost(data.totalCost)}
          sub={`${data.totalSessions.toLocaleString()} sessions`}
        />
        <StatTile label="Avg / Session" value={formatCost(data.avgCostPerSession)} />
        <StatTile label="Total Tokens" value={formatTokens(data.totalTokens)} />
        <StatTile
          label="Cache Read $"
          value={formatCost(data.costBreakdown.cacheRead)}
          sub={`${Math.round((data.costBreakdown.cacheRead / Math.max(data.totalCost, 0.01)) * 100)}% of total`}
        />
      </div>

      {/* Cost breakdown */}
      <Panel>
        <PanelHeader title="Cost Breakdown" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Input", val: data.costBreakdown.input },
            { label: "Output", val: data.costBreakdown.output },
            { label: "Cache Write", val: data.costBreakdown.cacheWrite },
            { label: "Cache Read", val: data.costBreakdown.cacheRead },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center gap-2 mb-1">
                <Marker />
                <span className="label-caps">{item.label}</span>
              </div>
              <div className="mono text-lg text-ink-1">{formatCost(item.val)}</div>
              <div className="mono text-xs text-ink-3">
                {Math.round((item.val / Math.max(data.totalCost, 0.01)) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Model breakdown */}
      <Panel>
        <PanelHeader title="Cost by Model" />
        <div className="space-y-2">
          {data.byModel.map((m) => (
            <div key={m.model} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs w-20 shrink-0 text-ink-1">{shortModel(m.model)}</span>
              <div className="progress-bar flex-1 min-w-[120px]">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.max((m.cost / Math.max(data.totalCost, 1)) * 100, 1)}%` }}
                />
              </div>
              <span className="mono text-[12px] text-ink-2">
                {formatCost(m.cost)} · {m.sessions} sessions
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Daily trend */}
      {data.dailyCosts.length > 1 && (
        <Panel>
          <PanelHeader title="Daily Cost Trend" />
          <div className="flex items-end gap-1 h-32">
            {data.dailyCosts.slice(-30).map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full min-h-[2px] transition-all"
                  style={{ height: `${(d.cost / maxDaily) * 100}%`, ...barMark() }}
                  title={`${d.day}: ${formatCost(d.cost)}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="mono text-[10px] text-ink-3">{data.dailyCosts[0]?.day?.slice(5)}</span>
            <span className="mono text-[10px] text-ink-3">
              {data.dailyCosts[data.dailyCosts.length - 1]?.day?.slice(5)}
            </span>
          </div>
        </Panel>
      )}

      {/* Top sessions */}
      <Panel>
        <PanelHeader title="Most Expensive Sessions" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="label-caps border-b border-line-2">
                <th className="text-left py-2 pr-3 font-normal">Cost</th>
                <th className="text-left py-2 pr-3 font-normal">Model</th>
                <th className="text-right py-2 pr-3 font-normal">Msgs</th>
                <th className="text-right py-2 pr-3 font-normal">Tokens</th>
                <th className="text-left py-2 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.topSessions.slice(0, 15).map((s) => (
                <tr
                  key={s.sessionId}
                  className="border-b border-line-1 transition-colors"
                  onMouseEnter={rowHoverIn}
                  onMouseLeave={rowHoverOut}
                >
                  <td className="py-2 pr-3 mono text-ink-1">{formatCost(s.costTotal)}</td>
                  <td className="py-2 pr-3 text-ink-1">{shortModel(s.primaryModel)}</td>
                  <td className="py-2 pr-3 text-right mono text-ink-2">{s.messageCount}</td>
                  <td className="py-2 pr-3 text-right mono text-ink-2">{formatTokens(s.totalTokens)}</td>
                  <td className="py-2 mono text-ink-3">{(s.lastTimestamp || "").slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FailuresTab({ data }: { data: FailureData | null }) {
  if (!data) return <div className="p-8 text-ink-3">Loading failure data...</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Overall Failure Rate"
          value={`${data.overallRate}%`}
          sub={`${data.totalFailures.toLocaleString()} failures / ${data.totalCalls.toLocaleString()} calls`}
        />
        <StatTile
          label="Top Offender"
          value={data.byTool[0]?.tool || "—"}
          sub={`${data.byTool[0]?.failures ?? 0} failures (${data.byTool[0]?.failureRate ?? 0}%)`}
        />
        <StatTile
          label="Trend"
          value={data.trend.length >= 2 ? `${data.trend[data.trend.length - 1]?.rate ?? 0}%` : "—"}
          sub="Most recent day"
        />
      </div>

      {/* Daily trend */}
      {data.trend.length > 1 && (
        <Panel>
          <PanelHeader title="7-Day Failure Rate" />
          <div className="flex items-end gap-2 h-24">
            {data.trend.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="mono text-[10px] text-ink-3">{d.rate}%</span>
                <div
                  className="w-full min-h-[2px]"
                  style={{ height: `${Math.min(d.rate * 5, 100)}%`, ...barMark() }}
                />
                <span className="mono text-[10px] text-ink-3">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Per-tool table */}
      <Panel>
        <PanelHeader title="Failure Rate by Tool" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="label-caps border-b border-line-2">
                <th className="text-left py-2 pr-4 font-normal">Tool</th>
                <th className="text-right py-2 pr-4 font-normal">Failures</th>
                <th className="text-right py-2 pr-4 font-normal">Total Calls</th>
                <th className="text-right py-2 pr-4 font-normal">Rate</th>
                <th className="text-left py-2 font-normal" style={{ width: "30%" }}>Bar</th>
              </tr>
            </thead>
            <tbody>
              {data.byTool
                .filter((t) => t.failures > 0)
                .map((t) => (
                  <tr
                    key={t.tool}
                    className="border-b border-line-1 transition-colors"
                    onMouseEnter={rowHoverIn}
                    onMouseLeave={rowHoverOut}
                  >
                    <td className="py-2 pr-4 font-medium text-ink-1">{t.tool}</td>
                    <td className="py-2 pr-4 text-right mono text-ink-1">{t.failures}</td>
                    <td className="py-2 pr-4 text-right mono text-ink-2">{t.calls.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right mono text-ink-1">{t.failureRate}%</td>
                    <td className="py-2">
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(t.failureRate * 2, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function AnthropicTab({ data }: { data: AnthropicData | null }) {
  if (!data) return <div className="p-8 text-ink-3">Loading Anthropic cost data...</div>;
  if (!data.current)
    return (
      <div className="p-8 text-ink-3">
        No ledger entries yet. CostTracker cron runs hourly — next entry at :00.
        Run manually: <code className="mono">bun ~/.claude/LIFEOS/TOOLS/CostTracker.ts log</code>
      </div>
    );

  const snap = data.current;
  const fiveH = snap.subscription.five_hour_pct ?? 0;
  const sevenD = snap.subscription.seven_day_pct ?? 0;
  const apiSpend = snap.api_spend.month_used_usd;
  const bypassSites = data.sites.filter((s) => s.classification === "bypass");
  const legitSites = data.sites.filter((s) => s.classification === "legit");
  const unknownSites = data.sites.filter((s) => s.classification === "unknown");

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {snap.alerts.length > 0 && (
        <Panel>
          <div className="flex items-center gap-2 mb-3">
            <Marker dim="err" />
            <span className="label-caps text-ink-1">Active Alerts</span>
          </div>
          <ul className="text-sm space-y-1 text-ink-1">
            {snap.alerts.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          dim={fiveH > 80 ? "warn" : "ok"}
          label="Subscription 5h"
          value={`${fiveH}%`}
          sub={fiveH > 80 ? "approaching cap" : "healthy"}
        />
        <StatTile
          dim={sevenD > 80 ? "warn" : "ok"}
          label="Subscription 7d"
          value={`${sevenD}%`}
          sub={sevenD > 80 ? "approaching cap" : "healthy"}
        />
        <StatTile
          label="API Spend MTD"
          value={apiSpend !== null ? `$${apiSpend.toFixed(2)}` : "—"}
          sub={apiSpend !== null ? snap.api_spend.source : "set ANTHROPIC_ADMIN_API_KEY"}
        />
        <StatTile
          dim={bypassSites.length > 0 ? "err" : "ok"}
          label="Bypass call sites"
          value={String(bypassSites.length)}
          sub={bypassSites.length === 0 ? "all guarded" : "review and patch"}
        />
      </div>

      {/* Call sites inventory */}
      <Panel>
        <PanelHeader
          title={`Call Sites (${data.sites.length})`}
          actions={
            <span className="mono text-[10px] text-ink-3">
              baseline: {data.baseline_updated ? new Date(data.baseline_updated).toLocaleString() : "none"}
            </span>
          }
        />
        <div className="space-y-1" style={{ fontSize: 12 }}>
          {([
            ...bypassSites.map((site) => ({ site, dim: "err" as Dim, key: "b" })),
            ...unknownSites.map((site) => ({ site, dim: "warn" as Dim, key: "u" })),
            ...legitSites.map((site) => ({ site, dim: "ok" as Dim, key: "l" })),
          ]).map(({ site, dim, key }, i) => (
            <div key={`${key}-${i}`} className="flex items-start gap-2 py-1">
              <span className="pt-[5px]"><Marker dim={dim} /></span>
              <div className="flex-1 min-w-0">
                <div className="mono break-all text-ink-1">
                  {site.file}:{site.line}
                </div>
                <div className="text-ink-3 text-[12px]">{site.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 24h trend */}
      <Panel>
        <PanelHeader title="Last 24h — subscription usage" />
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {data.history.length === 0 ? (
            <span className="text-ink-3 text-xs">Waiting for hourly samples…</span>
          ) : (
            data.history.map((h, i) => {
              const pct = h.subscription.five_hour_pct ?? 0;
              const alert = h.alerts.length > 0;
              return (
                <div
                  key={i}
                  className="flex-1"
                  title={`${new Date(h.ts).toLocaleTimeString()} — 5h=${pct}%, sites=${h.call_sites.total} (bypass=${h.call_sites.bypass})`}
                  style={{
                    height: `${Math.max(pct, 2)}%`,
                    ...barMark(alert ? "var(--err)" : undefined),
                    minWidth: 8,
                  }}
                />
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="mono text-[10px] text-ink-3">{data.total_entries} total ledger entries</span>
          <span className="mono text-[10px] text-ink-3">
            last sample: {new Date(snap.ts).toLocaleTimeString()}
          </span>
        </div>
      </Panel>

      {/* How-to */}
      <Panel className="opacity-85">
        <div className="text-xs text-ink-3 space-y-1">
          <div>
            <span className="mono text-ink-1">
              bun ~/.claude/LIFEOS/TOOLS/CostTracker.ts status
            </span>{" "}
            — human-readable snapshot
          </div>
          <div>
            <span className="mono text-ink-1">
              bun ~/.claude/LIFEOS/TOOLS/CostTracker.ts scan
            </span>{" "}
            — re-run static scan
          </div>
          <div>
            <span className="mono text-ink-1">
              bun ~/.claude/LIFEOS/TOOLS/CostTracker.ts baseline
            </span>{" "}
            — lock a new known-good snapshot
          </div>
        </div>
      </Panel>
    </div>
  );
}

const TABS: TabSpec<Tab>[] = [
  { id: "cost", label: "Cost" },
  { id: "failures", label: "Failures" },
  { id: "anthropic", label: "Anthropic" },
];

export default function PerformancePage() {
  const [tab, setTab] = useState<Tab>("cost");
  const [costData, setCostData] = useState<CostData | null>(null);
  const [failureData, setFailureData] = useState<FailureData | null>(null);
  const [anthropicData, setAnthropicData] = useState<AnthropicData | null>(null);
  const [days, setDays] = useState(30);

  const fetchCost = useCallback(async () => {
    try {
      const res = await fetch(`/api/performance/cost?days=${days}`);
      if (res.ok) setCostData(await res.json());
    } catch { /* silent */ }
  }, [days]);

  const fetchFailures = useCallback(async () => {
    try {
      const res = await fetch("/api/performance/failures");
      if (res.ok) setFailureData(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchAnthropic = useCallback(async () => {
    try {
      const res = await fetch("/api/performance/anthropic-cost");
      if (res.ok) setAnthropicData(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCost();
    fetchFailures();
    fetchAnthropic();
    const interval = setInterval(() => {
      fetchCost();
      fetchFailures();
      fetchAnthropic();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchCost, fetchFailures, fetchAnthropic]);

  const daysSwitcher = (
    <div className="flex items-center gap-1.5">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDays(d)}
          className="px-2.5 py-1 rounded-full mono text-[11px] cursor-pointer transition-colors"
          style={dimStyle("neutral", days === d)}
        >
          {d}d
        </button>
      ))}
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="Performance"
        subtitle="Runtime cost, tool failures, and Anthropic subscription guardrails."
        actions={tab === "cost" ? daysSwitcher : undefined}
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "cost" && <CostTab data={costData} />}
      {tab === "failures" && <FailuresTab data={failureData} />}
      {tab === "anthropic" && <AnthropicTab data={anthropicData} />}
    </PageShell>
  );
}
