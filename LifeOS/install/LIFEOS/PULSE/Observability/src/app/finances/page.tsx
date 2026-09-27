"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Sankey,
  Rectangle,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FreshnessIndicator, type FreshnessData } from "@/components/FreshnessIndicator";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TabBar,
  Pill,
  Marker,
  type TabSpec,
} from "@/components/ui/chrome";

// ─── Types matching /api/life/finances v2 envelope ───

interface Section {
  heading: string;
  body: string;
}
interface Stream {
  label: string;
  annual: number;
}

interface ResolvedLine {
  id: string;
  name: string;
  scope: string;
  monthly_usd: number;
  annual_usd: number;
  source: "collector" | "manual" | "unconfigured";
  cadence: string;
  tags?: string[];
  notes?: string;
  collector?: string;
}

interface TrendPoint {
  month: string;
  income: number;
  outbound: number;
  net: number;
}

interface InsightLine {
  display: string;
  monthly_usd: number;
  annual_usd: number;
  observed_usd: number;
  cadence: string;
  confidence: "high" | "medium" | "low";
  scope: string;
  tags: string[];
  active_months: number;
  charge_count: number;
  last_seen: string;
  reason?: string;
}

interface SpendInsights {
  top_bills: InsightLine[];
  top_ai_services: InsightLine[];
  top_infrastructure_services: InsightLine[];
  cut_candidates: InsightLine[];
  by_category: { category: string; annual_usd: number; merchants: number }[];
  total_annualized: number;
  statement_spend: {
    generated_at: string | null;
    record_count: number;
    jsonl_path: string;
    tool: string;
  };
}

interface FinancesDataV2 {
  version?: number;
  income?: {
    streams: Stream[];
    annual: number;
    monthly: number;
    mrr_monthly: number;
    mrr_annual: number;
  };
  outbound?: {
    vendors: ResolvedLine[];
    obligations: ResolvedLine[];
    other: ResolvedLine[];
    annual: number;
    monthly: number;
    vendors_annual: number;
    obligations_annual: number;
    other_annual: number;
  };
  overall?: {
    net_pre_tax_annual: number;
    net_pre_tax_monthly: number;
    net_post_tax_annual: number;
    net_post_tax_monthly: number;
    effective_tax_rate: number;
    trend: TrendPoint[];
  };
  collector_status?: {
    configured_vendors: number;
    active_collectors: string[];
    jsonl_path: string;
  };
  insights?: SpendInsights;
  currency?: string;
  // v1 legacy fields (still populated)
  accounts?: Section[];
  goals?: Section[];
  expenses?: Section[];
  investments?: Section[];
  taxes?: Section[];
  overview?: Section[];
  plan?: {
    present: boolean;
    flywheel: { n: number; stage: string; text: string }[];
    targets: { headers: string[]; rows: string[][] } | null;
    sections: Section[];
  };
  incomeStreams?: Stream[];
  expenseCategories?: Stream[];
  annualIncome?: number;
  annualExpenses?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  net?: number;
  freshness?: FreshnessData;
  freshness_per_card?: {
    income?: FreshnessData;
    outbound?: FreshnessData;
    overall?: FreshnessData;
    accounts?: FreshnessData;
    investments?: FreshnessData;
    taxes?: FreshnessData;
    plan?: FreshnessData;
  };
}

// ─── Formatting ───

// Deterministic symbols for the currencies LifeOS ships sample data for —
// checked first so the default ("USD" when [principal].currency is unset)
// resolves to the exact literal this page always used, independent of the
// server's ICU/locale environment. Any other ISO 4217 code falls through to
// Intl as a best-effort lookup.
// ported from public PR #1777, @takanorinishida and public PR #1801, @prafed
const CURRENCY_SYMBOL_FALLBACK: Record<string, string> = { USD: "$", JPY: "¥", EUR: "€", GBP: "£" };

function resolveCurrencySymbol(currency: string): string {
  const known = CURRENCY_SYMBOL_FALLBACK[currency.toUpperCase()];
  if (known) return known;
  try {
    const parts = new Intl.NumberFormat(undefined, { style: "currency", currency }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

// Module-level rather than component state: fmtHero is also called from
// SankeyNode, a plain function recharts invokes directly (not a component in
// the tree), so it has no access to hooks or props threaded from FinancesPage.
// Defaults to "$" — the literal every version of this page has rendered — so
// an install with no [principal].currency configured, or a request that
// hasn't resolved yet, is byte-identical to before currency support existed.
let currencySymbol = "$";

function setCurrency(currency: string | undefined | null): void {
  currencySymbol = resolveCurrencySymbol(currency || "USD");
}

function fmtHero(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  // Threshold on magnitude, not the signed value. A negative net is a real,
  // common case here (the card renders red ink when spending exceeds income),
  // and it missed every `>=` check, falling through to the unabridged digit
  // string — "$-2,120,000" sitting next to a sibling KPI reading "$2.1M".
  // ported from public PR #1778, @takanorinishida
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${currencySymbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${currencySymbol}${Math.round(abs / 1000)}K`;
  if (abs >= 1_000) {
    const k = abs / 1000;
    return k % 1 === 0 ? `${sign}${currencySymbol}${k.toFixed(0)}K` : `${sign}${currencySymbol}${k.toFixed(1)}K`;
  }
  return `${sign}${currencySymbol}${Math.round(abs).toLocaleString()}`;
}

function fmtExact(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return `${currencySymbol}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtPct(rate: number | null | undefined): string {
  const n = Number(rate) || 0;
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Series colours — the same three data colours as the trend chart legend:
// income, expenses, net. Chart marks only; text and chrome stay neutral. ───

const SERIES = {
  income: "var(--money)",
  outbound: "var(--creative)",
  net: "var(--freedom)",
} as const;

const SANKEY_COLORS: Record<string, string> = {
  "Gross Income": SERIES.income,
  "Net": SERIES.net,
  "Expenses": SERIES.outbound,
  "Vendors": SERIES.outbound,
  "Obligations": SERIES.outbound,
  "Other": SERIES.outbound,
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--line-3)",
  borderRadius: 10,
  color: "var(--ink-1)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

const AXIS_TICK = { fill: "var(--ink-3)", fontSize: 10, fontFamily: "var(--font-mono)" };

const HERO_NUMBER = { font: "400 clamp(36px, 4.5vw, 48px)/1.1 var(--font-mono)", letterSpacing: "-0.03em" };

function parseSubheadings(body: string): string[] {
  return body
    .split("\n")
    .filter((l) => l.startsWith("### "))
    .map((l) => l.replace(/^###\s*/, ""));
}

// ─── Shared bits ───

function KpiChip({
  label,
  value,
  sensitive = true,
}: {
  label: string;
  value: string;
  sensitive?: boolean;
}) {
  return (
    <StatTile
      label={label}
      value={sensitive ? <span data-sensitive>{value}</span> : value}
    />
  );
}

function SourceBadge({ source }: { source: string }) {
  return <Pill>{source}</Pill>;
}

function ScopeBadge({ scope }: { scope: string }) {
  return <Pill>{scope}</Pill>;
}

function LineRow({ line }: { line: ResolvedLine }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
        <span className="text-[14px] text-ink-1 break-words">{line.name}</span>
        <ScopeBadge scope={line.scope} />
        <SourceBadge source={line.source} />
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="mono text-[18px] text-ink-1" data-sensitive>
          {fmtHero(line.monthly_usd)}
        </span>
        <span className="text-xs text-ink-2">/mo</span>
        <span className="ml-auto mono text-[12px] text-ink-2" data-sensitive>
          {fmtHero(line.annual_usd)}/yr
        </span>
      </div>
      {line.notes && (
        <p className="mt-1 text-[12px] text-ink-2">{line.notes}</p>
      )}
    </Panel>
  );
}

function StreamCard({ stream }: { stream: Stream }) {
  return (
    <Panel className="p-4">
      <span className="text-[14px] text-ink-1 block break-words">{stream.label}</span>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="mono text-[18px] text-ink-1" data-sensitive>
          {fmtHero(stream.annual)}
        </span>
        <span className="text-xs text-ink-2">/yr</span>
        <span className="ml-auto mono text-[12px] text-ink-2" data-sensitive>
          {fmtHero(stream.annual / 12)}/mo
        </span>
      </div>
    </Panel>
  );
}

// ─── Hero banners ───

function IncomeHero({
  data,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["income"]>;
  freshness?: FreshnessData;
}) {
  return (
    <Panel className="relative">
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="label-caps">Total Annual Income</span>
      <div className="flex items-baseline gap-3 mt-2 flex-wrap">
        <span className="text-ink-1" style={HERO_NUMBER} data-sensitive="strong">
          {fmtHero(data.annual)}
        </span>
        <span className="mono text-[13px] text-ink-2" data-sensitive>
          {fmtHero(data.monthly)}/mo
        </span>
      </div>
      <span className="text-[13px] mt-1 block text-ink-3">
        Private. Toggle Observer mode to blur.
      </span>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <KpiChip label="Monthly Recurring" value={fmtHero(data.mrr_monthly)} />
        <KpiChip label="MRR Annualized" value={fmtHero(data.mrr_annual)} />
        <KpiChip label="Streams" value={`${data.streams.length}`} sensitive={false} />
        <KpiChip label="Monthly Income" value={fmtHero(data.monthly)} />
      </div>
    </Panel>
  );
}

function OutboundHero({
  data,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["outbound"]>;
  freshness?: FreshnessData;
}) {
  return (
    <Panel className="relative">
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="label-caps">Total Annual Expenses</span>
      <div className="flex items-baseline gap-3 mt-2 flex-wrap">
        <span className="text-ink-1" style={HERO_NUMBER} data-sensitive>
          {fmtHero(data.annual)}
        </span>
        <span className="mono text-[13px] text-ink-2" data-sensitive>
          {fmtHero(data.monthly)}/mo
        </span>
      </div>
      <span className="text-[13px] mt-1 block text-ink-3">
        Sum of vendors, personal obligations, and other.
      </span>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <KpiChip label="Vendors" value={fmtHero(data.vendors_annual)} />
        <KpiChip label="Obligations" value={fmtHero(data.obligations_annual)} />
        <KpiChip label="Other" value={fmtHero(data.other_annual)} />
        <KpiChip
          label="Lines Tracked"
          value={`${data.vendors.length + data.obligations.length + data.other.length}`}
          sensitive={false}
        />
      </div>
    </Panel>
  );
}

function OverallHero({
  data,
  periodView,
  freshness,
}: {
  data: NonNullable<FinancesDataV2["overall"]>;
  periodView: "monthly" | "annual";
  freshness?: FreshnessData;
}) {
  const pre = periodView === "monthly" ? data.net_pre_tax_monthly : data.net_pre_tax_annual;
  const post = periodView === "monthly" ? data.net_post_tax_monthly : data.net_post_tax_annual;
  return (
    <Panel className="relative">
      <div className="absolute top-5 right-5 md:top-6 md:right-6 z-10">
        <FreshnessIndicator freshness={freshness} />
      </div>
      <span className="label-caps">
        Net ({periodView === "monthly" ? "Monthly" : "Annual"})
      </span>
      <div className="flex items-baseline gap-3 mt-2 flex-wrap">
        <span className="text-ink-1" style={HERO_NUMBER} data-sensitive>
          {fmtHero(pre)}
        </span>
        <span className="text-[13px] text-ink-2">pre-tax</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <KpiChip label="Post-Tax Net" value={fmtHero(post)} />
        <KpiChip
          label="Effective Tax Rate"
          value={fmtPct(data.effective_tax_rate)}
          sensitive={false}
        />
        <KpiChip
          label={periodView === "monthly" ? "Annual Pre-Tax" : "Monthly Pre-Tax"}
          value={fmtHero(
            periodView === "monthly" ? data.net_pre_tax_annual : data.net_pre_tax_monthly,
          )}
        />
        <KpiChip
          label={periodView === "monthly" ? "Annual Post-Tax" : "Monthly Post-Tax"}
          value={fmtHero(
            periodView === "monthly" ? data.net_post_tax_annual : data.net_post_tax_monthly,
          )}
        />
      </div>
    </Panel>
  );
}

// ─── Overall trend chart ───

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <Panel>
      <PanelHeader title="Income vs Expenses — 12 Month Trend" />
      <div className="w-full h-64" data-sensitive>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line-1)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--line-3)" tick={AXIS_TICK} tickLine={false} />
            <YAxis
              stroke="var(--line-3)"
              tick={AXIS_TICK}
              tickLine={false}
              tickFormatter={(v) => `${currencySymbol}${Math.round(v / 1000)}K`}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: "var(--line-3)", strokeWidth: 1 }} />
            <Legend
              iconSize={10}
              wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
            />
            <Line type="monotone" dataKey="income" stroke={SERIES.income} strokeWidth={1.5} dot={false} name="Income" />
            <Line type="monotone" dataKey="outbound" stroke={SERIES.outbound} strokeWidth={1.5} dot={false} name="Expenses" />
            <Line type="monotone" dataKey="net" stroke={SERIES.net} strokeWidth={1.5} dot={false} name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[12px] mt-2 text-ink-3">
        Flat baseline until Phase 2 collectors accumulate historical monthly data.
      </p>
    </Panel>
  );
}

// ─── Sankey ───

interface SankeyNodePayload {
  name?: string;
  category?: string;
  value?: number;
}

interface SankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: SankeyNodePayload;
}

function SankeyNode(props: SankeyNodeProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const name = payload?.name ?? "";
  const color =
    SANKEY_COLORS[name] ||
    (payload?.category === "income"
      ? SERIES.income
      : payload?.category === "outbound"
        ? SERIES.outbound
        : payload?.category === "net"
          ? SERIES.net
          : "var(--ink-3)");
  const isLeft = x < 300;
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.12}
        stroke={color}
        strokeWidth={1}
      />
      <text
        x={isLeft ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="central"
        fill="var(--ink-1)"
        fontSize={11}
        fontFamily="var(--font-mono)"
      >
        {name}
      </text>
      <text
        x={isLeft ? x - 8 : x + width + 8}
        y={y + height / 2 + 16}
        textAnchor={isLeft ? "end" : "start"}
        dominantBaseline="central"
        fill="var(--ink-3)"
        fontSize={10}
        fontFamily="var(--font-mono)"
        data-sensitive
      >
        {payload?.value != null ? `${fmtHero(payload.value / 12)}/mo` : ""}
      </text>
    </g>
  );
}

interface SankeyLinkProps {
  sourceX?: number;
  sourceY?: number;
  sourceControlX?: number;
  targetX?: number;
  targetY?: number;
  targetControlX?: number;
  linkWidth?: number;
  payload?: {
    source?: SankeyNodePayload;
    target?: SankeyNodePayload;
  };
}

function SankeyLink(props: SankeyLinkProps) {
  const {
    sourceX = 0,
    sourceY = 0,
    sourceControlX = 0,
    targetX = 0,
    targetY = 0,
    targetControlX = 0,
    linkWidth = 0,
    payload,
  } = props;
  const sourceName = payload?.source?.name ?? "";
  const targetName = payload?.target?.name ?? "";
  const color =
    SANKEY_COLORS[targetName] ||
    SANKEY_COLORS[sourceName] ||
    (payload?.source?.category === "income" ? SERIES.income : "var(--ink-3)");
  return (
    <path
      d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={color}
      strokeWidth={linkWidth}
      strokeOpacity={0.12}
    />
  );
}

interface SankeyNodeDatum {
  name: string;
  category: "income" | "outbound" | "pool" | "net";
}

interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
}

function FinancesSankey({
  incomeStreams,
  outbound,
  net,
}: {
  incomeStreams: Stream[];
  outbound: NonNullable<FinancesDataV2["outbound"]>;
  net: number;
}) {
  const data = useMemo<{ nodes: SankeyNodeDatum[]; links: SankeyLinkDatum[] }>(() => {
    const nodes: SankeyNodeDatum[] = [];
    const links: SankeyLinkDatum[] = [];
    incomeStreams.forEach((s) => nodes.push({ name: s.label, category: "income" }));
    nodes.push({ name: "Gross Income", category: "pool" });
    const grossIdx = nodes.length - 1;
    incomeStreams.forEach((s, i) => {
      if (s.annual > 0) links.push({ source: i, target: grossIdx, value: s.annual });
    });
    nodes.push({ name: "Expenses", category: "pool" });
    const outboundIdx = nodes.length - 1;
    if (outbound.annual > 0)
      links.push({ source: grossIdx, target: outboundIdx, value: outbound.annual });
    if (net > 0) {
      nodes.push({ name: "Net", category: "net" });
      links.push({ source: grossIdx, target: nodes.length - 1, value: net });
    }
    if (outbound.vendors_annual > 0) {
      nodes.push({ name: "Vendors", category: "outbound" });
      links.push({ source: outboundIdx, target: nodes.length - 1, value: outbound.vendors_annual });
    }
    if (outbound.obligations_annual > 0) {
      nodes.push({ name: "Obligations", category: "outbound" });
      links.push({
        source: outboundIdx,
        target: nodes.length - 1,
        value: outbound.obligations_annual,
      });
    }
    if (outbound.other_annual > 0) {
      nodes.push({ name: "Other", category: "outbound" });
      links.push({ source: outboundIdx, target: nodes.length - 1, value: outbound.other_annual });
    }
    return { nodes, links };
  }, [incomeStreams, outbound, net]);

  if (data.nodes.length === 0) return null;

  return (
    <Panel className="p-4 overflow-x-auto">
      <div className="w-full min-w-[1200px] h-[460px]" data-sensitive>
        <Sankey
          width={1200}
          height={460}
          data={data}
          node={<SankeyNode />}
          link={<SankeyLink />}
          nodePadding={50}
          margin={{ top: 20, bottom: 20, left: 100, right: 100 }}
        >
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmtExact(v)} />
        </Sankey>
      </div>
    </Panel>
  );
}

// ─── Tabs ───

type TabKey = "income" | "outbound" | "overall" | "plan";
const TABS: TabSpec<TabKey>[] = [
  { id: "income", label: "Income", hint: "1" },
  { id: "outbound", label: "Expenses", hint: "2" },
  { id: "overall", label: "Overall", hint: "3" },
  { id: "plan", label: "Flywheel", hint: "4" },
];

const PERIOD_TABS: TabSpec<"monthly" | "annual">[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

// ─── Section renderers ───

function SectionGroup({
  title,
  items,
  freshness,
}: {
  title: string;
  items?: Section[];
  freshness?: FreshnessData;
}) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="label-caps">{title}</h2>
        {freshness && <FreshnessIndicator freshness={freshness} />}
      </div>
      <div className="prob-grid">
        {items.map((item, i) => (
          <Panel key={i}>
            <h3 className="text-[14px] text-ink-1 mb-1">{item.heading}</h3>
            <div className="text-xs whitespace-pre-wrap text-ink-2" data-sensitive>
              {item.body}
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function AccountCategory({ item }: { item: Section }) {
  const subs = parseSubheadings(item.body);
  return (
    <Panel>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="label-caps">{item.heading}</h3>
        <span className="ml-auto mono text-[10px] text-ink-3">
          {subs.length > 0 ? `${subs.length} items` : ""}
        </span>
      </div>
      {subs.length > 0 ? (
        <div className="space-y-2" data-sensitive>
          {subs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-ink-1">
              <span className="w-1 h-1 rounded-full shrink-0 bg-ink-3" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs whitespace-pre-wrap text-ink-2" data-sensitive>
          {item.body}
        </div>
      )}
    </Panel>
  );
}

// ─── Tabs ───

function IncomeTab({ data }: { data: FinancesDataV2 }) {
  const income = data.income;
  const streams = income?.streams ?? data.incomeStreams ?? [];
  const incomeFreshness = data.freshness_per_card?.income ?? data.freshness;
  return (
    <div className="space-y-6">
      {income && <IncomeHero data={income} freshness={incomeFreshness} />}
      {streams.length > 0 && (
        <section>
          <h2 className="label-caps mb-4">Income Streams</h2>
          <div className="prob-grid">
            {streams.map((s) => (
              <StreamCard key={s.label} stream={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OutboundSubgroup({
  title,
  lines,
}: {
  title: string;
  lines: ResolvedLine[];
}) {
  if (lines.length === 0) return null;
  const total = lines.reduce((s, l) => s + l.annual_usd, 0);
  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="label-caps">{title}</h3>
        <span className="mono text-[12px] text-ink-2" data-sensitive>
          {fmtHero(total / 12)}/mo · {fmtHero(total)}/yr
        </span>
      </div>
      <div className="prob-grid">
        {lines.map((l) => (
          <LineRow key={l.id} line={l} />
        ))}
      </div>
    </section>
  );
}

function InsightLineRow({ line }: { line: InsightLine }) {
  // Honest cadence labels — only true monthly_recurring shows /yr projection prominently.
  // observed_one_month and one_time show "$X observed (1mo)" so the user sees what we actually saw.
  const isUncertain = line.cadence === "observed_one_month" || (line.cadence === "one_time" && line.charge_count >= 2);
  const cadenceLabel =
    line.cadence === "monthly_recurring"
      ? `${line.charge_count}× over ${line.active_months}mo · monthly`
      : line.cadence === "annual_subscription"
        ? "annual subscription"
        : line.cadence === "observed_one_month"
          ? `${line.charge_count}× in 1mo · observed only`
          : "one-time";
  return (
    <div className="border border-line-2 rounded-[10px] p-3.5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[14px] text-ink-1 break-words">{line.display}</span>
        <span className="mono text-[15px] text-ink-1" data-sensitive>
          {isUncertain ? fmtHero(line.observed_usd) : fmtHero(line.annual_usd)}
          <span className="text-[12px] text-ink-2 ml-1">{isUncertain ? "observed" : "/yr"}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-2 flex-wrap mt-1">
        {!isUncertain && line.monthly_usd > 0 && (
          <>
            <span data-sensitive>{fmtHero(line.monthly_usd)}/mo</span>
            <span>·</span>
          </>
        )}
        <span>{cadenceLabel}</span>
        <span>·</span>
        <span>conf: {line.confidence}</span>
        {line.tags.length > 0 && (
          <>
            <span>·</span>
            <span>{line.tags.slice(0, 3).join(" / ")}</span>
          </>
        )}
      </div>
      {line.reason && (
        <p className="text-[12px] mt-1 text-ink-2">{line.reason}</p>
      )}
    </div>
  );
}

function InsightSection({
  title,
  description,
  lines,
  emptyHint,
}: {
  title: string;
  description?: string;
  lines: InsightLine[];
  emptyHint: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="label-caps">{title}</h3>
          {description && <p className="text-[12px] text-ink-2 mt-1">{description}</p>}
        </div>
        {lines.length > 0 && (
          <span className="mono text-[12px] text-ink-2" data-sensitive>
            {fmtHero(lines.reduce((s, l) => s + l.annual_usd, 0))}/yr · {lines.length} item{lines.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {lines.length === 0 ? (
        <Panel className="p-4">
          <p className="text-xs text-ink-3">{emptyHint}</p>
        </Panel>
      ) : (
        <div className="prob-grid">
          {lines.map((l, i) => (
            <InsightLineRow key={`${l.display}-${i}`} line={l} />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryBreakdown({ categories, total }: { categories: SpendInsights["by_category"]; total: number }) {
  if (categories.length === 0) return null;
  const max = Math.max(...categories.map(c => c.annual_usd), 1);
  const CATEGORY_LABEL: Record<string, string> = {
    taxes: "Taxes", payroll: "Payroll / Contractors",
    ai: "AI", infrastructure: "Infrastructure", saas: "SaaS / Subscriptions",
    food: "Food", transportation: "Transportation", utilities: "Utilities",
    entertainment: "Entertainment", health: "Health", news: "News", shopping: "Shopping",
    travel: "Travel", "business-services": "Business Services", debt: "Debt", advertising: "Advertising",
    other: "Other",
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="label-caps">Spending By Category</h3>
        <span className="mono text-[12px] text-ink-2" data-sensitive>{fmtHero(total)}/yr total observed</span>
      </div>
      <Panel className="p-4">
        <div className="flex flex-col gap-3">
          {categories.map((c) => {
            const pct = total > 0 ? Math.round((c.annual_usd / total) * 100) : 0;
            const barPct = (c.annual_usd / max) * 100;
            return (
              <div key={c.category} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-x-3 flex-wrap text-xs">
                  <span className="text-[13px] text-ink-1">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <span className="mono text-ink-2" data-sensitive>
                    {fmtHero(c.annual_usd)}/yr · {c.merchants} {c.merchants === 1 ? "merchant" : "merchants"} · {pct}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </section>
  );
}

function SpendInsightsSection({ insights }: { insights: SpendInsights }) {
  return (
    <div className="space-y-6 pt-4 border-t border-line-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="label-caps">Spending Analysis</h2>
          <p className="text-[12px] text-ink-2 mt-1">
            Derived from statement CSVs in <code className="mono text-ink-1">FINANCES/Statements/*</code>.
            Re-run with <code className="mono text-ink-1">bun ~/.claude/LIFEOS/USER/FINANCES/Tools/StatementAnalyzer.ts</code>.
          </p>
        </div>
        {insights.statement_spend.generated_at && (
          <span className="mono text-[12px] text-ink-3">
            {insights.statement_spend.record_count} merchants · generated{" "}
            {new Date(insights.statement_spend.generated_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </span>
        )}
      </div>

      <CategoryBreakdown categories={insights.by_category} total={insights.total_annualized} />

      <InsightSection
        title="Top Bills"
        description="Highest annualized spend across all sources (transfers excluded)."
        lines={insights.top_bills}
        emptyHint="No statement aggregate yet — run StatementAnalyzer.ts to populate."
      />

      <InsightSection
        title="Top AI Services"
        description="What the AI stack actually costs — sorted by annualized spend."
        lines={insights.top_ai_services}
        emptyHint="No AI services detected yet. Drop more CSV exports under FINANCES/Statements/."
      />

      <InsightSection
        title="Top Infrastructure Services"
        description="Cloud, hosting, dev, monitoring, networking."
        lines={insights.top_infrastructure_services}
        emptyHint="No infrastructure services detected yet."
      />

      <InsightSection
        title="Cut Candidates"
        description="Subscriptions flagged for review — single-use annuals, low-value recurring, overlapping tools."
        lines={insights.cut_candidates}
        emptyHint="No obvious cut candidates. Stack is lean (or analyzer needs more data)."
      />
    </div>
  );
}

function OutboundTab({ data }: { data: FinancesDataV2 }) {
  const outbound = data.outbound;
  const outboundFreshness = data.freshness_per_card?.outbound ?? data.freshness;
  if (!outbound) {
    return (
      <Panel>
        <p className="text-sm text-center text-ink-2">
          Expenses data unavailable. Check{" "}
          <code className="mono text-ink-1">
            ~/.claude/LIFEOS/USER/FINANCES/vendors.yaml
          </code>
          .
        </p>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      <OutboundHero data={outbound} freshness={outboundFreshness} />
      <OutboundSubgroup title="Vendors & Services" lines={outbound.vendors} />
      <OutboundSubgroup title="Personal Obligations" lines={outbound.obligations} />
      <OutboundSubgroup title="Other" lines={outbound.other} />
      {data.insights && <SpendInsightsSection insights={data.insights} />}
    </div>
  );
}

function OverallTab({
  data,
  periodView,
  onPeriodChange,
}: {
  data: FinancesDataV2;
  periodView: "monthly" | "annual";
  onPeriodChange: (v: "monthly" | "annual") => void;
}) {
  const overall = data.overall;
  const income = data.income;
  const outbound = data.outbound;
  if (!overall || !income || !outbound) {
    return (
      <Panel>
        <p className="text-sm text-center text-ink-2">Overall data unavailable.</p>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <TabBar tabs={PERIOD_TABS} active={periodView} onChange={onPeriodChange} />
      </div>
      <OverallHero
        data={overall}
        periodView={periodView}
        freshness={data.freshness_per_card?.overall ?? data.freshness}
      />
      <FinancesSankey
        incomeStreams={income.streams}
        outbound={outbound}
        net={overall.net_pre_tax_annual}
      />
      <TrendChart trend={overall.trend} />
      {data.accounts && data.accounts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="label-caps">Accounts</h2>
            <FreshnessIndicator freshness={data.freshness_per_card?.accounts} />
          </div>
          <div className="prob-grid">
            {data.accounts.map((item, i) => (
              <AccountCategory key={i} item={item} />
            ))}
          </div>
        </section>
      )}
      <SectionGroup
        title="Investments"
        items={data.investments}
        freshness={data.freshness_per_card?.investments}
      />
      <SectionGroup title="Goals" items={data.goals} />
      <SectionGroup
        title="Taxes"
        items={data.taxes}
        freshness={data.freshness_per_card?.taxes}
      />
    </div>
  );
}

// ─── Plan tab (forward financial model + flywheel) ───

// Minimal inline-markdown renderer: **bold**, `- bullets`, pipe-tables, and
// paragraphs. Presentation only — every string comes from PLAN.md via the API.
function boldify(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-ink-1">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function PlanBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      const tbl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tbl.push(lines[i].trim()); i++; }
      const cells = (l: string) => l.split("|").slice(1, -1).map((c) => c.replace(/\*\*/g, "").trim());
      const isSep = (l: string) => /^\|[\s|:-]+\|?$/.test(l);
      const rows = tbl.filter((l) => !isSep(l)).map(cells);
      if (rows.length) {
        const [head, ...rest] = rows;
        blocks.push(
          <div key={key++} className="overflow-x-auto my-2">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>{head.map((h, j) => (
                  <th key={j} className="label-caps text-left px-2 py-1.5 border-b border-line-2">{h}</th>
                ))}</tr>
              </thead>
              <tbody>{rest.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <td key={ci} className={`px-2 py-1.5 border-b border-line-1 ${ci === 0 ? "text-ink-1" : "text-ink-2"}`}>{c}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i++; }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1 my-2 text-ink-2">
          {items.map((it, j) => <li key={j}>{boldify(it)}</li>)}
        </ul>
      );
      continue;
    }
    if (line.trim()) {
      blocks.push(<p key={key++} className="my-2 text-ink-2">{boldify(line.trim())}</p>);
    }
    i++;
  }
  return <>{blocks}</>;
}

function FlywheelLoop({ stages }: { stages: { n: number; stage: string; text: string }[] }) {
  if (!stages.length) return null;
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h2 className="label-caps">The Flywheel</h2>
        <span className="text-[12px] text-ink-3">↻ each turn spins the next</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {stages.map((s, i) => (
          <div key={s.n} className="border border-line-3 rounded-[10px] p-5">
            <div className="flex items-baseline gap-2.5 mb-1.5">
              <span className="mono text-[11px] text-ink-3">{s.n}</span>
              <span className="text-ink-1">{s.stage}</span>
              <span className="ml-auto mono text-ink-3">
                {i === stages.length - 1 ? "↻" : "→"}
              </span>
            </div>
            <p className="text-sm text-ink-2">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanTab({ data }: { data: FinancesDataV2 }) {
  const plan = data.plan;
  if (!plan || !plan.present) {
    return (
      <Panel>
        <p className="text-sm text-center text-ink-2">
          No plan yet. Create <code className="mono text-ink-1">USER/FINANCES/PLAN.md</code> — the flywheel, targets, and product ladder render here.
        </p>
      </Panel>
    );
  }
  const special = /^(flywheel|targets)$/i;
  const about = plan.sections.find((s) => /^about/i.test(s.heading));
  const rest = plan.sections.filter((s) => !special.test(s.heading) && !/^about/i.test(s.heading));
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FreshnessIndicator freshness={data.freshness_per_card?.plan} />
      </div>

      {about && (
        <Panel>
          <PanelHeader title={about.heading} className="mb-2" />
          <PlanBody body={about.body} />
        </Panel>
      )}

      <FlywheelLoop stages={plan.flywheel} />

      {plan.targets && (
        <section>
          <h2 className="label-caps mb-4">Targets</h2>
          <Panel className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>{plan.targets.headers.map((h, j) => (
                  <th key={j} className="label-caps text-left px-2 py-2 border-b border-line-2">{h}</th>
                ))}</tr>
              </thead>
              <tbody>{plan.targets.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => (
                  <td key={ci} className={`px-2 py-2 border-b border-line-1 ${ci === 0 ? "text-ink-1" : "text-ink-2"}`}>{c}</td>
                ))}</tr>
              ))}</tbody>
            </table>
          </Panel>
        </section>
      )}

      {rest.map((s, i) => (
        <section key={i}>
          <h2 className="label-caps mb-3">{s.heading}</h2>
          <Panel>
            <PlanBody body={s.body} />
          </Panel>
        </section>
      ))}
    </div>
  );
}

// ─── Page ───

export default function FinancesPage() {
  const [data, setData] = useState<FinancesDataV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("income");
  const [periodView, setPeriodView] = useState<"monthly" | "annual">("monthly");

  // Load data
  useEffect(() => {
    fetch("/api/life/finances")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: FinancesDataV2) => {
        setCurrency(json.currency);
        setData(json);
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Hash-routed tab state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const valid = (k: string): k is TabKey =>
      k === "income" || k === "outbound" || k === "overall" || k === "plan";
    const hash = window.location.hash.replace("#", "");
    if (valid(hash)) setTab(hash);
    const onHashChange = () => {
      const h = window.location.hash.replace("#", "");
      if (valid(h)) setTab(h);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Keyboard 1/2/3 cycles tabs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") changeTab("income");
      else if (e.key === "2") changeTab("outbound");
      else if (e.key === "3") changeTab("overall");
      else if (e.key === "4") changeTab("plan");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const changeTab = (k: TabKey) => {
    setTab(k);
    if (typeof window !== "undefined") window.location.hash = k;
  };

  if (error) {
    return (
      <PageShell>
        <Panel>
          <h2 className="flex items-center gap-2 text-[15px] text-ink-1">
            <Marker dim="err" /> Failed to load finances
          </h2>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }
  if (!data) return <div className="p-8 text-sm text-ink-2">Loading Finances...</div>;

  const incomeAnnual = data.income?.annual ?? data.annualIncome ?? 0;
  const outboundAnnual = data.outbound?.annual ?? data.annualExpenses ?? 0;
  const incomeStreams = data.income?.streams ?? data.incomeStreams ?? [];
  const isFreshInstall =
    incomeAnnual === 0 &&
    outboundAnnual === 0 &&
    incomeStreams.length === 0 &&
    (!data.accounts || data.accounts.length === 0);

  return (
    <PageShell>
      <PageHeader
        title="Finances"
        subtitle="Income · Expenses · Overall · Flywheel · Press 1/2/3/4 to switch tabs"
      />
      <TabBar tabs={TABS} active={tab} onChange={changeTab} />

      {isFreshInstall && (
        <EmptyStateGuide
          section="Finances"
          description="Accounts, transactions, P&L, and revenue tracked over time."
          userDir="FINANCES"
          daPromptExample="help me wire up my financial data"
        />
      )}

      {tab === "income" && <IncomeTab data={data} />}
      {tab === "outbound" && <OutboundTab data={data} />}
      {tab === "overall" && (
        <OverallTab data={data} periodView={periodView} onPeriodChange={setPeriodView} />
      )}
      {tab === "plan" && <PlanTab data={data} />}
    </PageShell>
  );
}
