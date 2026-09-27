"use client";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { PageShell, PageHeader, Panel, StatTile } from "@/components/ui/chrome";

interface GrowthData {
  generatedAt: string;
  newsletter: {
    totalActive: number;
    free: number;
    premium: number;
    newToday: number;
    new7d: number;
    new30d: number;
    avgPerDay7d: number;
    avgPerDay30d: number;
    openRate: number;
    clickRate: number;
    dailyTrend: { date: string; count: number }[];
    todayChannels: Record<string, number>;
    channels30d: Record<string, number>;
  } | null;
  youtube: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
    recentVideos: { title: string; views: number; likes: number; comments: number }[];
  } | null;
  web: { range: string; pageviews: number; visitors: number } | null;
  errors: string[];
}

// One series per chart, so one colour: the teal.
const SERIES = "var(--accent-blue)";

const CHART_TOOLTIP = {
  background: "var(--surface-1)",
  border: "1px solid var(--line-3)",
  borderRadius: 10,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--ink-1)",
};
const AXIS_TICK = { fill: "var(--ink-3)", fontSize: 10, fontFamily: "var(--font-mono)" };

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function mmdd(d: string): string {
  const p = d.split("-");
  return p.length === 3 ? `${p[1]}/${p[2]}` : d;
}

function Hero({ nl }: { nl: NonNullable<GrowthData["newsletter"]> }) {
  return (
    <Panel>
      <div className="flex items-start gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="label-caps mb-4">
            Audience Growth
          </div>
          <div className="flex items-baseline gap-8 flex-wrap">
            <div>
              <div className="label-caps text-ink-3">New subscribers today</div>
              <div className="stat-value text-ink-1">
                {nl.newToday}
              </div>
            </div>
            <div>
              <div className="label-caps text-ink-3">Total active</div>
              <div className="stat-value text-ink-1">
                {fmt(nl.totalActive)}
              </div>
              <div className="text-xs mt-1 text-ink-2">
                {fmt(nl.free)} free · {nl.premium.toLocaleString()} premium
              </div>
            </div>
            <div className="text-sm space-y-1 text-ink-2">
              <div>
                <span className="mono text-ink-1">{nl.new7d}</span> in 7d ·{" "}
                {nl.avgPerDay7d}/day
              </div>
              <div>
                <span className="mono text-ink-1">{nl.new30d.toLocaleString()}</span> in 30d ·{" "}
                {nl.avgPerDay30d}/day
              </div>
              <div className="text-xs">
                Open {nl.openRate}% · Click {nl.clickRate}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TrendChart({ nl }: { nl: NonNullable<GrowthData["newsletter"]> }) {
  const data = nl.dailyTrend.map((d) => ({ ...d, label: mmdd(d.date) }));
  return (
    <section>
      <h2 className="label-caps mb-4">
        New Subscribers · 30 Days
      </h2>
      <Panel>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid stroke="var(--line-1)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" stroke="var(--line-2)" tick={AXIS_TICK} interval={4} tickLine={false} />
              <YAxis stroke="var(--line-2)" tick={AXIS_TICK} width={32} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP}
                cursor={{ stroke: "var(--line-3)" }}
                formatter={(v: number) => [`${v} new`, "Subscribers"]}
              />
              <Area type="monotone" dataKey="count" stroke={SERIES} strokeWidth={1.5} fill={SERIES} fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </section>
  );
}

function Channels({ nl }: { nl: NonNullable<GrowthData["newsletter"]> }) {
  const rows = Object.entries(nl.channels30d).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = rows.reduce((s, [, v]) => s + v, 0) || 1;
  const today = Object.entries(nl.todayChannels).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="label-caps mb-4">
        Where They Came From · 30 Days
      </h2>
      <Panel>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.map(([name, count]) => ({ name, count }))} layout="vertical" margin={{ left: 20, right: 40 }}>
              <XAxis type="number" stroke="var(--line-2)" tick={AXIS_TICK} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke="var(--line-2)" tick={AXIS_TICK} width={120} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP}
                cursor={{ fill: "var(--surface-3)" }}
                formatter={(v: number) => [`${v} (${((v / total) * 100).toFixed(0)}%)`, "Subs"]}
              />
              <Bar dataKey="count" fill={SERIES} fillOpacity={0.12} stroke={SERIES} strokeWidth={1} radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {today.length > 0 && (
          <div className="text-xs text-ink-2 mt-4 pt-4 border-t border-line-2">
            Today: {today.map(([k, v]) => `${k} ${v}`).join(" · ")}
          </div>
        )}
      </Panel>
    </section>
  );
}

function NotConnected({ label, envVar, note }: { label: string; envVar: string; note: string }) {
  return (
    <Panel className="p-4">
      <h3 className="label-caps mb-2">{label}</h3>
      <div className="text-sm text-ink-2">Not connected</div>
      <div className="text-xs text-ink-3 mt-1 break-words">
        {note} Set <code className="mono text-ink-1">{envVar}</code> in <code className="mono">~/.claude/.env</code>.
      </div>
    </Panel>
  );
}

export default function GrowthPage() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/life/growth")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Growth" subtitle="Audience across newsletter, YouTube, and web." />
        <Panel>
          <h2 className="flex items-center gap-2 label-caps text-ink-1 mb-2">
            <span className="fig-key" style={{ color: "var(--err)" }} aria-hidden />
            Failed to load growth
          </h2>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell>
        <PageHeader title="Growth" subtitle="Audience across newsletter, YouTube, and web." />
        <div className="text-sm text-ink-2">Loading Growth…</div>
      </PageShell>
    );
  }

  const nl = data.newsletter;

  return (
    <PageShell>
      <PageHeader
        title="Growth"
        subtitle="Audience across newsletter, YouTube, and web."
        actions={
          <div className="text-xs text-ink-3 mono">
            {data.generatedAt && (
              <>Updated {new Date(data.generatedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT</>
            )}
            {(data.errors?.length ?? 0) > 0 && <span> · {data.errors.length} source(s) need credentials</span>}
          </div>
        }
      />

      {nl ? (
        <>
          <Hero nl={nl} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart nl={nl} />
            <Channels nl={nl} />
          </div>
        </>
      ) : (
        <Panel>
          <h2 className="label-caps text-ink-1 mb-2">Newsletter not connected</h2>
          <p className="text-sm text-ink-2">Set BEEHIIV_API_KEY and BEEHIIV_PUB_ID in ~/.claude/.env.</p>
        </Panel>
      )}

      <h2 className="label-caps">Other Channels</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.youtube ? (
          <StatTile
            label="YouTube"
            value={fmt(data.youtube.subscribers)}
            sub={`${fmt(data.youtube.totalViews)} views · ${data.youtube.videoCount} videos`}
          />
        ) : (
          <NotConnected label="YouTube" envVar="GOOGLE_API_KEY" note="Enable YouTube Data API v3 on this key's project." />
        )}
        {data.web ? (
          <StatTile
            label={`Web traffic (${data.web.range})`}
            value={fmt(data.web.pageviews)}
            sub={`${fmt(data.web.visitors)} visitors`}
          />
        ) : (
          <NotConnected label="Web traffic" envVar="CLOUDFLARE_API_TOKEN" note="Needs Account Analytics Read scope." />
        )}
        {nl && (
          <StatTile
            label="List health"
            value={`${nl.openRate}%`}
            sub={`open · ${nl.clickRate}% click · ${nl.premium.toLocaleString()} premium`}
          />
        )}
        {nl && (
          <StatTile label="Free / Premium" value={fmt(nl.free)} sub={`free · ${nl.premium.toLocaleString()} premium`} />
        )}
      </div>
    </PageShell>
  );
}
