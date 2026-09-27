"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { PageShell, PageHeader, Panel, PanelHeader, StatTile, Pill } from "@/components/ui/chrome";

// ────────── Types ──────────

interface HomeData {
  oneSentence: string | null;
  updated?: string | null;
  updatedBy?: string | null;
  domains?: Array<{ name: string; summary: string; body: string }>;
  current: {
    mood?: string;
    energy?: string;
    focus?: string;
    location?: string;
    last_meal?: string;
    sleep_last_night?: string;
    calendar_load?: string;
    inbox?: string;
    top_intent?: string;
  };
  topGoals?: Array<{ id: string; text: string }>;
  nextActions?: string[];
  spark?: string;
  timelineBlockCount?: number;
}

interface UserIndexStats {
  total_files: number;
  avg_completeness: number;
  frontmatter_coverage: number;
  by_kind: Record<string, number>;
  by_publish: Record<string, number>;
}

interface UserIndex {
  files: unknown[];
  by_category: Record<string, unknown[]>;
  domains: unknown[];
  publish_feed: unknown[];
  stale_queue: unknown[];
  interview_gaps: unknown[];
  stats: UserIndexStats;
}

interface GoalsData {
  goals?: Array<{ id: string; text: string }>;
  mission?: Array<{ heading: string; body: string }>;
  problems?: Array<{ heading: string; body: string }>;
  status?: Array<{ heading: string; body: string }>;
}

interface BusinessData {
  revenueSummary?: string;
  latestRevenueReport?: string;
  businessOverview?: Array<{ heading: string; body: string }>;
  revenueByProduct?: string;
}

interface HealthData {
  files?: Array<{ name: string; sections: string[] }>;
}

interface FinancesData {
  accounts?: Array<{ heading: string; body: string }>;
}

interface WorkData {
  projects?: Array<{ name: string; path: string; url: string }>;
}

interface AirMonitor {
  id: number;
  name: string;
  pm25: number | null;
  co2: number | null;
  temp: number | null;
  rh: number | null;
  aqi: number | null;
  aqiLabel: string | null;
  type: string | null;
}

interface AirData {
  fetched_at: string | null;
  count: number;
  worst_aqi: number | null;
  worst_label: string | null;
  monitors: AirMonitor[];
  error?: string;
}

// ────────── Helpers ──────────

function parseRatio(value?: string): number | null {
  if (!value) return null;
  const m = value.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  if (m) return Math.round(parseFloat(m[1]) * 10);
  const pct = value.match(/(\d+)%/);
  if (pct) return parseInt(pct[1], 10);
  return null;
}

function parseMoodToScore(mood?: string): number | null {
  if (!mood) return null;
  const text = mood.toLowerCase();
  if (/\b(energized|clear|focused|great|amazing)\b/.test(text)) return 85;
  if (/\b(good|solid|fine|ok)\b/.test(text)) return 70;
  if (/\b(tired|foggy|slow)\b/.test(text)) return 45;
  if (/\b(bad|stressed|anxious|overwhelmed)\b/.test(text)) return 30;
  return 60;
}

function parseRevenueSummary(md?: string): { total?: string; deals?: string; largest?: string } {
  if (!md) return {};
  const out: Record<string, string> = {};
  const lines = md.split("\n");
  for (const line of lines) {
    const m = line.match(/\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/);
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return { total: out["total revenue"], deals: out["deals closed"], largest: out["largest single deal"] };
}

// ────────── Primitives ──────────

function RingMetric({ label, score, valueText }: { label: string; score: number | null; valueText?: string }) {
  if (score === null) return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mono text-xs border border-line-2 text-ink-3">
        —
      </div>
      <div className="label-caps text-ink-3">{label}</div>
    </div>
  );
  const data = [{ value: score }];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="92%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" fill="var(--accent-blue)" cornerRadius={0} background={{ fill: "var(--line-2)" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="mono text-lg text-ink-1">{score}</span>
        </div>
      </div>
      <div className="label-caps">{label}</div>
      {valueText && <div className="text-[12px] text-ink-2 text-center max-w-[120px] break-words">{valueText}</div>}
    </div>
  );
}

function DomainCard({
  title, href, headline, secondary, children, empty, pulse = false,
}: {
  title: string;
  href: string;
  headline?: string | null;
  secondary?: string | null;
  children?: React.ReactNode;
  empty?: string;
  pulse?: boolean;
}) {
  return (
    <Link href={href} className="h-full">
      <Panel hover className={`h-full group flex flex-col gap-2${pulse ? " pulse" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="fig-key" style={{ color: "var(--ink-3)" }} aria-hidden />
            <h2 className="label-caps">{title}</h2>
          </div>
          <ArrowUpRight className="w-4 h-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink-1" strokeWidth={1.5} />
        </div>
        {headline ? (
          <>
            <div className="text-ink-1" style={{ font: "400 28px/1.2 var(--font-mono)", letterSpacing: "-0.03em" }} data-sensitive>{headline}</div>
            {secondary && <div className="text-xs text-ink-2 leading-relaxed" data-sensitive>{secondary}</div>}
          </>
        ) : empty ? (
          <div className="text-xs text-ink-3 py-2">{empty}</div>
        ) : null}
        {children}
      </Panel>
    </Link>
  );
}

// ────────── Sections ──────────

function NarrativeBanner({ home }: { home: HomeData | null }) {
  if (!home) return <Panel className="h-24" />;
  const mood = parseMoodToScore(home.current?.mood);
  const energy = parseRatio(home.current?.energy);
  const focus = home.current?.focus ? 70 : null; // focus depth is categorical — render existence as 70
  const hasRings = mood !== null || energy !== null || focus !== null;
  const domains = home.domains ?? [];
  return (
    <Panel className="p-8">
      <div className="flex items-start justify-between gap-8 flex-wrap">
        <div className="flex-1 min-w-0 max-w-4xl">
          <div className="label-caps mb-3">
            How is life going
            {home.updated && <span className="ml-3 text-ink-3">as of {home.updated}{home.updatedBy ? ` · via ${home.updatedBy}` : ""}</span>}
          </div>
          {home.oneSentence ? (
            <p className="text-2xl lg:text-3xl font-medium leading-snug text-ink-1" data-sensitive>
              {home.oneSentence}
            </p>
          ) : domains.length > 0 ? (
            <div className="space-y-4" data-sensitive>
              {domains.map(d => (
                <div key={d.name} className="flex items-start gap-4">
                  <span className="label-caps shrink-0 w-32 mt-1">
                    {d.name}
                  </span>
                  <p className="text-sm leading-relaxed text-ink-1 min-w-0" title={d.body}>
                    {d.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">
              No Current State yet — run an interview or add a Current State section to Telos.
            </p>
          )}
          {home.current?.top_intent && (
            <p className="mt-4 text-sm text-ink-2" data-sensitive>
              <span>Top intent:</span> {home.current.top_intent}
            </p>
          )}
        </div>
        {hasRings && (
          <div className="flex flex-wrap items-center gap-6" data-sensitive>
            <RingMetric label="Mood" score={mood} valueText={home.current?.mood} />
            <RingMetric label="Energy" score={energy} valueText={home.current?.energy} />
            <RingMetric label="Focus" score={focus} valueText={home.current?.focus} />
          </div>
        )}
      </div>
      {(home.current?.location || home.current?.sleep_last_night || home.current?.calendar_load) && (
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 pt-4 border-t border-line-2" data-sensitive>
          {home.current?.location && <Pill className="whitespace-normal">Location · {home.current.location}</Pill>}
          {home.current?.sleep_last_night && <Pill className="whitespace-normal">Sleep · {home.current.sleep_last_night}</Pill>}
          {home.current?.calendar_load && <Pill className="whitespace-normal">Calendar · {home.current.calendar_load}</Pill>}
          {home.current?.last_meal && <Pill className="whitespace-normal">Meal · {home.current.last_meal}</Pill>}
        </div>
      )}
    </Panel>
  );
}

function DomainGrid({
  business, health, finances, work, goals, air,
}: {
  business: BusinessData | null;
  health: HealthData | null;
  finances: FinancesData | null;
  work: WorkData | null;
  goals: GoalsData | null;
  air: AirData | null;
}) {
  const rev = parseRevenueSummary(business?.revenueSummary);
  const healthFileCount = health?.files?.length ?? 0;
  const accountCount = finances?.accounts?.length ?? 0;
  const projectCount = work?.projects?.length ?? 0;
  const goalCount = goals?.goals?.length ?? 0;
  const airMonitorCount = air?.count ?? 0;
  const worstAqi = air?.worst_aqi ?? null;
  const indoorCo2 = air?.monitors
    ?.filter(m => m.type !== "outdoor" && m.name.toLowerCase() !== "backyard")
    ?.reduce((max, m) => m.co2 !== null && (max === null || m.co2 > max) ? m.co2 : max, null as number | null)
    ?? null;
  const airHeadline = worstAqi !== null ? `AQI ${worstAqi}` : null;
  const airSecondary = airMonitorCount > 0
    ? `${airMonitorCount} monitors${air?.worst_label ? ` · ${air.worst_label}` : ""}${indoorCo2 !== null ? ` · indoor CO₂ ${indoorCo2}ppm` : ""}`
    : null;

  return (
    <section>
      <PanelHeader title="Domains" className="mb-4" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DomainCard title="Business" href="/business"
          headline={rev.total || null}
          secondary={rev.deals ? `${rev.deals} deals · largest ${rev.largest ?? "—"}` : null}
          empty={!rev.total ? "Wire finances pipeline to surface revenue" : undefined}
        />
        <DomainCard title="Health" href="/health"
          headline={healthFileCount > 0 ? `${healthFileCount} sources` : null}
          secondary="Labs, fitness, nutrition tracked"
          empty={healthFileCount === 0 ? "Add health files to surface trends" : undefined}
        />
        <DomainCard title="Work" href="/work"
          pulse={projectCount > 0}
          headline={projectCount > 0 ? `${projectCount} active` : null}
          secondary="Projects in flight"
          empty={projectCount === 0 ? "No active projects tracked" : undefined}
        />
        <DomainCard title="Finances" href="/finances"
          headline={accountCount > 0 ? `${accountCount} accounts` : null}
          secondary="Tracked accounts & categories"
          empty={accountCount === 0 ? "Add accounts to Finances/ domain" : undefined}
        />
        <DomainCard title="Telos Goals" href="/telos"
          headline={goalCount > 0 ? `${goalCount} active` : null}
          secondary={goals?.mission?.[0]?.body?.slice(0, 80) ?? "Telos mission & goals"}
          empty={goalCount === 0 ? "Define goals in Telos/" : undefined}
        />
        <DomainCard title="Telos" href="/telos"
          headline={`${goals?.mission?.length ?? 0} missions`}
          secondary={goals?.problems?.length ? `${goals.problems.length} problems · ${goals?.status?.length ?? 0} status entries` : null}
        />
        <DomainCard title="Air Quality" href="/air"
          headline={airHeadline}
          secondary={airSecondary}
          empty={airMonitorCount === 0 ? "Run the AirGradient poller to prime cache" : undefined}
        />
      </div>
    </section>
  );
}

function ActiveGoals({ goals }: { goals: GoalsData | null }) {
  const items = goals?.goals?.slice(0, 8) ?? [];
  if (items.length === 0) return null;
  return (
    <section>
      <PanelHeader
        title="Active Goals"
        className="mb-4"
        actions={<Link href="/telos" className="text-xs text-ink-3 hover:text-ink-1">see all →</Link>}
      />
      <Panel>
        <div className="space-y-3" data-sensitive>
          {items.map(g => (
            <div key={g.id} className="flex items-start gap-4">
              <span className="text-xs mono text-ink-3 w-8 shrink-0 mt-0.5">{g.id}</span>
              <span className="text-sm flex-1 min-w-0 text-ink-1">{g.text}</span>
              <Pill className="shrink-0 mt-0.5">active</Pill>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 text-xs text-ink-3 border-t border-line-2">
          Progress tracking appears once each goal has a `progress` field in Telos/Goals.md
        </div>
      </Panel>
    </section>
  );
}

function NextActionsSpark({ home }: { home: HomeData | null }) {
  const actions = home?.nextActions ?? [];
  const spark = home?.spark;
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <Panel>
        <PanelHeader title="Next Actions" className="mb-3" />
        {actions.length > 0 ? (
          <ul className="space-y-2 text-ink-1" data-sensitive>
            {actions.slice(0, 6).map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="fig-key mt-[7px]" style={{ color: "var(--ink-3)" }} aria-hidden />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-3">No actions in `current.md` yet.</p>
        )}
      </Panel>
      <Panel>
        <PanelHeader title="Spark" className="mb-3" />
        {spark ? (
          <p className="text-base leading-relaxed text-ink-1">{spark}</p>
        ) : (
          <p className="text-xs text-ink-3">Sparks surfaces random entries from Telos/Sparks.md</p>
        )}
      </Panel>
    </section>
  );
}

function SystemContextDrawer({ index }: { index: UserIndex | null }) {
  const [open, setOpen] = useState(false);
  if (!index) return null;
  const byCat = index.by_category;
  const daemonCount = (index.stats.by_publish.daemon || 0) + (index.stats.by_publish["daemon-summary"] || 0);

  return (
    <section>
      <Panel
        as="div"
        hover
        className="p-0"
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-3 text-left p-5 cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-ink-3" strokeWidth={1.5} /> : <ChevronRight className="w-4 h-4 text-ink-3" strokeWidth={1.5} />}
            <span className="label-caps">System Context</span>
            <span className="mono text-xs text-ink-3">
              {index.stats.total_files} files · {daemonCount} broadcast · {index.interview_gaps.length} gaps
            </span>
          </div>
          <Pill dim="neutral">{open ? "collapse" : "expand"}</Pill>
        </button>
      </Panel>
      {open && (
        <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {(["identity", "voice", "mind", "taste", "shape", "ops", "domain"] as const).map(cat => {
            const files = byCat[cat] ?? [];
            if (files.length === 0) return null;
            return (
              <StatTile key={cat} label={cat} value={files.length} sub="files" />
            );
          })}
        </div>
      )}
    </section>
  );
}
// ────────── Page ──────────

export default function LifePage() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [finances, setFinances] = useState<FinancesData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [work, setWork] = useState<WorkData | null>(null);
  const [goals, setGoals] = useState<GoalsData | null>(null);
  const [index, setIndex] = useState<UserIndex | null>(null);
  const [air, setAir] = useState<AirData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJson = (path: string) => fetch(path).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([
      fetchJson("/api/life/home").then(setHome),
      fetchJson("/api/life/health").then(setHealth),
      fetchJson("/api/life/finances").then(setFinances),
      fetchJson("/api/life/business").then(setBusiness),
      fetchJson("/api/life/work").then(setWork),
      fetchJson("/api/life/goals").then(setGoals),
      fetchJson("/api/life/air").then(setAir),
      fetchJson("/api/user-index").then(setIndex),
    ]).catch(err => setError(String(err)));
  }, []);

  if (error) {
    return (
      <PageShell>
        <Panel>
          <div className="flex items-center gap-2 mb-2">
            <span className="fig-key" style={{ color: "var(--err)" }} aria-hidden />
            <h2 className="label-caps text-ink-1">Dashboard unavailable</h2>
          </div>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-[1920px]">
      <PageHeader title="Life" subtitle="Your current state across every domain — mood, goals, work, and the numbers behind them." />
      <NarrativeBanner home={home} />
      <DomainGrid business={business} health={health} finances={finances} work={work} goals={goals} air={air} />
      <ActiveGoals goals={goals} />
      <NextActionsSpark home={home} />
      <SystemContextDrawer index={index} />
    </PageShell>
  );
}
