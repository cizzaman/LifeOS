"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { FreshnessIndicator, type FreshnessData } from "@/components/FreshnessIndicator";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  Pill,
  TabBar,
  type TabSpec,
} from "@/components/ui/chrome";

interface HealthFile {
  name: string;
  sections: string[];
}

interface Section {
  heading: string;
  body: string;
}

interface HealthData {
  files?: HealthFile[];
  supplements?: Section[];
  freshness?: FreshnessData;
}

interface FileMeta {
  label: string;
  priority: number;
}

const FILE_META: Record<string, FileMeta> = {
  METRICS: { label: "Metrics", priority: 1 },
  FITNESS: { label: "Fitness", priority: 2 },
  NUTRITION: { label: "Nutrition", priority: 3 },
  CONDITIONS: { label: "Conditions", priority: 4 },
  MEDICATIONS: { label: "Medications", priority: 5 },
  PROVIDERS: { label: "Providers", priority: 6 },
  HISTORY: { label: "History", priority: 7 },
  SUPPLEMENTS: { label: "Supplements", priority: 5 },
};

function fileMeta(name: string): FileMeta {
  if (name.startsWith("lab_results")) {
    return {
      label: name.replace(/^lab_results_/, "Labs — "),
      priority: 0,
    };
  }
  return FILE_META[name.toUpperCase()] || { label: name, priority: 99 };
}

function FileCard({ file }: { file: HealthFile }) {
  const meta = fileMeta(file.name);
  return (
    <Panel hover dim="health">
      <PanelHeader
        title={meta.label}
        actions={
          <Pill>
            {file.sections.length} section{file.sections.length === 1 ? "" : "s"}
          </Pill>
        }
      />
      <div className="space-y-1.5" data-sensitive>
        {file.sections.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-ink-2">
            <span
              className="w-[3px] h-[3px] mt-[7px] shrink-0"
              style={{ backgroundColor: "var(--ink-3)" }}
              aria-hidden
            />
            <span>{s}</span>
          </div>
        ))}
        {file.sections.length > 8 && (
          <div className="text-[12px] pt-1 text-ink-3">
            + {file.sections.length - 8} more
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Supplements ──

interface Supplement {
  name: string;
  dose?: string;
  purpose?: string;
  cadence?: string;
  category?: string;
  status?: string;
}

const CATEGORY_ORDER = ["Foundational", "Longevity", "Nootropic", "Allergy", "Rx"];

function field(body: string, name: string): string | undefined {
  const m = body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`));
  return m ? m[1].trim() : undefined;
}

function parseSupplements(sections: Section[]): { items: Supplement[]; notes?: string } {
  const items: Supplement[] = [];
  let notes: string | undefined;
  for (const s of sections) {
    if (s.heading.toLowerCase() === "notes") {
      notes = s.body;
      continue;
    }
    const dose = field(s.body, "Dose");
    const category = field(s.body, "Category");
    if (!dose && !category) continue; // not a supplement entry
    items.push({
      name: s.heading,
      dose,
      purpose: field(s.body, "Purpose"),
      cadence: field(s.body, "Cadence"),
      category,
      status: field(s.body, "Status"),
    });
  }
  return { items, notes };
}

function SupplementCard({ s }: { s: Supplement }) {
  const inactive = s.status && !/^active/i.test(s.status);
  return (
    <Panel hover dim="health">
      <PanelHeader
        title={s.name}
        actions={
          s.category ? (
            <Pill>{s.category}</Pill>
          ) : undefined
        }
      />
      <div className="space-y-1.5" data-sensitive>
        {s.dose && (
          <div className="text-sm font-medium text-ink-1">{s.dose}</div>
        )}
        {s.cadence && (
          <div className="label-caps text-ink-3">{s.cadence}</div>
        )}
        {s.purpose && <div className="text-xs text-ink-2">{s.purpose}</div>}
        {s.status && (
          <div className={`flex items-center gap-2 text-[12px] pt-1 ${inactive ? "text-ink-3" : "text-ink-2"}`}>
            {!inactive && <span className="fig-key" style={{ color: "var(--ok)" }} aria-hidden />}
            {s.status}
          </div>
        )}
      </div>
    </Panel>
  );
}

function SupplementsTab({ sections }: { sections: Section[] }) {
  const { items, notes } = parseSupplements(sections);

  if (items.length === 0) {
    return (
      <EmptyStateGuide
        section="Supplements"
        description="Your daily and as-needed supplement stack — dose, purpose, and cadence per item."
        userDir="HEALTH"
        daPromptExample="add my supplements to the health page"
      />
    );
  }

  const daily = items.filter((s) => /daily/i.test(s.cadence || "")).length;
  const categories = Array.from(
    new Set(items.map((s) => s.category).filter(Boolean) as string[]),
  ).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <StatTile
          dim="health"
          label="Tracked"
          value={<span data-sensitive>{items.length}</span>}
        />
        <StatTile
          dim="health"
          label="Daily"
          value={<span data-sensitive>{daily}</span>}
        />
        <StatTile
          dim="health"
          label="Categories"
          value={<span data-sensitive>{categories.length}</span>}
        />
      </div>

      <p className="text-sm flex items-center gap-2 text-ink-3">
        <Lock className="w-3.5 h-3.5" strokeWidth={1.5} /> Fully private. Observer mode blurs all data below.
      </p>

      {categories.map((cat) => {
        const group = items.filter((s) => s.category === cat);
        return (
          <section key={cat}>
            <h2 className="label-caps mb-4">
              {cat}
            </h2>
            <div className="prob-grid">
              {group.map((s) => (
                <SupplementCard key={s.name} s={s} />
              ))}
            </div>
          </section>
        );
      })}

      {notes && (
        <Panel>
          <PanelHeader title="Notes" />
          <div className="text-xs text-ink-2 whitespace-pre-line" data-sensitive>
            {notes.replace(/^- /gm, "• ")}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Page ──

type TabKey = "overview" | "supplements";
const TABS: TabSpec<TabKey>[] = [
  { id: "overview", label: "Overview", hint: "1" },
  { id: "supplements", label: "Supplements", hint: "2" },
];

function OverviewTab({ files }: { files: HealthFile[] }) {
  const labs = files.filter((f) => f.name.startsWith("lab_results"));
  const nonLabs = files.filter((f) => !f.name.startsWith("lab_results"));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <StatTile
          dim="health"
          label="Tracked Sources"
          value={<span data-sensitive>{files.length}</span>}
        />
        <StatTile
          dim="health"
          label="Lab Panels"
          value={<span data-sensitive>{labs.length}</span>}
        />
      </div>

      <p className="text-sm flex items-center gap-2 text-ink-3">
        <Lock className="w-3.5 h-3.5" strokeWidth={1.5} /> Fully private. Observer mode blurs all data below.
      </p>

      {labs.length > 0 && (
        <section>
          <h2 className="label-caps mb-4">
            Lab Panels
          </h2>
          <div className="prob-grid">
            {labs.map((f) => (
              <FileCard key={f.name} file={f} />
            ))}
          </div>
        </section>
      )}
      {nonLabs.length > 0 && (
        <section>
          <h2 className="label-caps mb-4">
            Core Files
          </h2>
          <div className="prob-grid">
            {nonLabs.map((f) => (
              <FileCard key={f.name} file={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  useEffect(() => {
    fetch("/api/life/health")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  // Hash-routed tab state (matches finances/agents pattern).
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h === "overview" || h === "supplements") setTab(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") changeTab("overview");
      if (e.key === "2") changeTab("supplements");
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
          <h2 className="flex items-center gap-2 label-caps text-ink-1 mb-2">
            <span className="fig-key" style={{ color: "var(--err)" }} aria-hidden />
            Failed to load health
          </h2>
          <p className="text-sm text-ink-2">{error}</p>
        </Panel>
      </PageShell>
    );
  }
  if (!data) return <div className="p-8 text-sm text-ink-3">Loading Health...</div>;

  const files = (data.files || [])
    .slice()
    .sort((a, b) => fileMeta(a.name).priority - fileMeta(b.name).priority);
  const isFreshInstall = files.length === 0;

  return (
    <PageShell>
      <PageHeader
        title="Health"
        subtitle="Labs, fitness, nutrition, and supplements — fully private. Press 1/2 to switch tabs."
        actions={<FreshnessIndicator freshness={data.freshness} />}
      />

      {isFreshInstall && (
        <EmptyStateGuide
          section="Health Snapshots"
          description="Lab results, fitness data, nutrition tracking, and trends over time."
          userDir="HEALTH"
          daPromptExample="help me set up where my health data lives"
        />
      )}

      <TabBar tabs={TABS} active={tab} onChange={changeTab} />

      {tab === "overview" && <OverviewTab files={files} />}
      {tab === "supplements" && <SupplementsTab sections={data.supplements || []} />}
    </PageShell>
  );
}
