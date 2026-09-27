"use client";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  Marker,
} from "@/components/ui/chrome";

interface BusinessData {
  latestRevenueReport?: string;
  revenueSummary?: string;
  revenueByProduct?: string;
  revenueAllSections?: Array<{ heading: string; body: string }>;
  businessOverview?: Array<{ heading: string; body: string }>;
  ulOverview?: Array<{ heading: string; body: string }>;
}

interface RevenueMetrics {
  total?: string;
  deals?: string;
  accounts?: string;
  avgDeal?: string;
  largest?: string;
  smallest?: string;
}

interface ProductRow {
  product: string;
  revenue: number;
  pct: string;
  deals: string;
  avgPrice: string;
}

function parseMetrics(md?: string): RevenueMetrics {
  if (!md) return {};
  const out: Record<string, string> = {};
  for (const line of md.split("\n")) {
    const m = line.match(/\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/);
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return {
    total: out["total revenue"],
    deals: out["deals closed"],
    accounts: out["unique accounts"],
    avgDeal: out["average deal (by line item)"],
    largest: out["largest single deal"],
    smallest: out["smallest single deal"],
  };
}

function parseProducts(md?: string): ProductRow[] {
  if (!md) return [];
  const out: ProductRow[] = [];
  const lines = md.split("\n").filter((l) => l.trim().startsWith("|") && l.includes("$"));
  for (const line of lines) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    const name = cells[0].replace(/\*\*/g, "");
    const revenue = parseInt(cells[1].replace(/[$,]/g, ""), 10);
    if (isNaN(revenue)) continue;
    out.push({
      product: name,
      revenue,
      pct: cells[2] || "",
      deals: cells[3] || "",
      avgPrice: cells[4] || "",
    });
  }
  return out.sort((a, b) => b.revenue - a.revenue);
}

const AXIS_TICK = { fill: "var(--ink-3)", fontSize: 10, fontFamily: "var(--font-mono)" };

function RevenueByProduct({ products }: { products: ProductRow[] }) {
  if (products.length === 0) return null;
  return (
    <Panel>
      <PanelHeader title="Revenue by Product" />
      <div data-sensitive style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={products} layout="vertical" margin={{ left: 20, right: 60 }}>
            <XAxis
              type="number"
              stroke="var(--line-3)"
              tick={AXIS_TICK}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              type="category"
              dataKey="product"
              stroke="var(--line-3)"
              tick={AXIS_TICK}
              tickLine={false}
              width={200}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-3)" }}
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--line-3)",
                borderRadius: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-1)",
              }}
              formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
            />
            <Bar
              dataKey="revenue"
              fill="var(--accent-blue)"
              fillOpacity={0.12}
              stroke="var(--accent-blue)"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-line-2"
        data-sensitive
      >
        {products.map((p) => (
          <div key={p.product} className="flex items-baseline gap-3 text-xs">
            <span className="flex-1 min-w-0 break-words text-ink-2">{p.product}</span>
            <span className="mono text-ink-1">{p.pct}</span>
            <span className="mono text-ink-3">{p.deals}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SectionGrid({ sections }: { sections?: Array<{ heading: string; body: string }> }) {
  if (!sections || sections.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {sections.map((s, i) => (
        <Panel key={i}>
          <PanelHeader title={s.heading} className="mb-2" />
          <div className="text-xs whitespace-pre-wrap text-ink-2" data-sensitive>
            {s.body}
          </div>
        </Panel>
      ))}
    </div>
  );
}

export default function BusinessPage() {
  const [data, setData] = useState<BusinessData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/life/business")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  if (error) {
    return (
      <PageShell>
        <Panel>
          <h2 className="flex items-center gap-2 text-[15px] text-ink-1">
            <Marker dim="err" /> Failed to load business
          </h2>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }
  if (!data) return <div className="p-8 text-sm text-ink-2">Loading Business...</div>;

  const metrics = parseMetrics(data.revenueSummary);
  const products = parseProducts(data.revenueByProduct);
  const isFreshInstall =
    !data.revenueSummary &&
    !data.revenueByProduct &&
    (!data.businessOverview || data.businessOverview.length === 0) &&
    (!data.ulOverview || data.ulOverview.length === 0) &&
    (!data.revenueAllSections || data.revenueAllSections.length === 0);

  return (
    <PageShell>
      <PageHeader
        title="Business"
        subtitle="Revenue streams, customers, deals, pipeline."
        actions={
          data.latestRevenueReport ? (
            <span className="text-[12px] text-ink-3 mono">Report: {data.latestRevenueReport}</span>
          ) : undefined
        }
      />

      {isFreshInstall && (
        <EmptyStateGuide
          section="Business Context"
          description="Your business operations data — revenue streams, customers, deals, pipeline."
          userDir="BUSINESS"
          daPromptExample="walk me through my business context"
        />
      )}

      {(metrics.total || metrics.deals) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" data-sensitive>
          {metrics.total && (
            <StatTile label="Latest Revenue" value={metrics.total} />
          )}
          {metrics.deals && <StatTile label="Deals Closed" value={metrics.deals} />}
          {metrics.accounts && <StatTile label="Accounts" value={metrics.accounts} />}
          {metrics.avgDeal && <StatTile label="Avg Deal" value={metrics.avgDeal} />}
          {metrics.largest && <StatTile label="Largest" value={metrics.largest} />}
        </div>
      )}

      <RevenueByProduct products={products} />

      {data.businessOverview && data.businessOverview.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="label-caps">Business Overview</h2>
          <SectionGrid sections={data.businessOverview} />
        </section>
      )}
      {data.ulOverview && data.ulOverview.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="label-caps">Company Overview</h2>
          <SectionGrid sections={data.ulOverview} />
        </section>
      )}
      {data.revenueAllSections && data.revenueAllSections.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="label-caps">Revenue Details</h2>
          <SectionGrid sections={data.revenueAllSections} />
        </section>
      )}
    </PageShell>
  );
}
