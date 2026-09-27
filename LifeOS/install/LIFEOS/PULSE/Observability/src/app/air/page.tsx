"use client";

import { useEffect, useState } from "react";
import EmptyStateGuide from "@/components/EmptyStateGuide";
import { PageShell, PageHeader, Panel, PanelHeader, Pill, Marker, type Dim } from "@/components/ui/chrome";

interface AirMonitor {
  id: number;
  name: string;
  pm25: number | null;
  co2: number | null;
  temp: number | null;
  rh: number | null;
  tvoc: number | null;
  nox: number | null;
  aqi: number | null;
  aqiLabel: string | null;
  timestamp: string;
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

// Air quality is status: each US EPA band maps to a 7px ok / warn / err key beside
// neutral text. The band name carries the finer grade.
function aqiDim(aqi: number | null): Dim {
  if (aqi === null) return "neutral";
  if (aqi <= 50) return "ok";
  if (aqi <= 150) return "warn";
  return "err";
}

function co2Dim(co2: number | null): Dim {
  if (co2 === null) return "neutral";
  if (co2 < 800) return "ok";
  if (co2 < 2000) return "warn";
  return "err";
}

function co2Label(co2: number | null): string {
  if (co2 === null) return "";
  if (co2 < 800) return "fresh";
  if (co2 < 1200) return "elevated";
  if (co2 < 2000) return "stuffy";
  return "poor";
}

function freshness(iso: string | null): string {
  if (!iso) return "unknown";
  const age = Date.now() - new Date(iso).getTime();
  const m = Math.round(age / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function Banner({ air }: { air: AirData | null }) {
  const worstAqi = air?.worst_aqi ?? null;
  const worstLabel = air?.worst_label ?? null;
  const count = air?.count ?? 0;
  const fetched = freshness(air?.fetched_at ?? null);
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="label-caps">Air Quality</div>
        <div className="mono text-[11px] text-ink-3">cached {fetched}</div>
      </div>
      <p
        className="text-ink-1 mt-2"
        style={{ font: "500 clamp(22px, 2.5vw, 30px)/1.3 var(--font-display)", letterSpacing: "-0.01em" }}
      >
        Worst AQI across {count} monitor{count === 1 ? "" : "s"}:{" "}
        <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
          <span className="self-center inline-flex"><Marker dim={aqiDim(worstAqi)} /></span>
          <span className="mono" style={{ fontWeight: 400 }}>{worstAqi ?? "—"}</span>
        </span>
        {worstLabel && (
          <span className="ml-2 text-ink-2" style={{ fontSize: "0.7em" }}>
            ({worstLabel})
          </span>
        )}
      </p>
      <p className="mt-2 text-sm text-ink-2">
        Live from AirGradient · updated every 5 min by Pulse poller
      </p>
    </Panel>
  );
}

function Metric({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string | null;
  unit?: string;
  status?: Dim;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Marker dim={status} />
        <span className="label-caps">{label}</span>
      </div>
      <div className="mono text-[20px] text-ink-1">
        {value ?? "—"}
        {value !== null && unit && (
          <span className="text-xs ml-1 text-ink-3">{unit}</span>
        )}
      </div>
    </div>
  );
}

function MonitorCard({ m }: { m: AirMonitor }) {
  const aqi = m.aqi;
  const co2 = m.co2;
  const co2Lbl = co2Label(co2);
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-ink-1">{m.name}</h3>
        <div className="flex items-center gap-4 flex-wrap">
          {m.type && <Pill>{m.type}</Pill>}
          <Pill dim={aqiDim(aqi)}>
            AQI {aqi ?? "—"}
            {m.aqiLabel && ` · ${m.aqiLabel}`}
          </Pill>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Metric
          label="PM 2.5"
          value={m.pm25 !== null ? m.pm25.toFixed(1) : null}
          unit="µg/m³"
          status={aqiDim(aqi)}
        />
        <Metric
          label="CO₂"
          value={co2 !== null ? String(co2) : null}
          unit={co2Lbl ? `ppm · ${co2Lbl}` : "ppm"}
          status={co2Dim(co2)}
        />
        <Metric
          label="Temp"
          value={m.temp !== null ? m.temp.toFixed(1) : null}
          unit="°C"
        />
        <Metric
          label="Humidity"
          value={m.rh !== null ? String(m.rh) : null}
          unit="%"
        />
        <Metric
          label="TVOC"
          value={m.tvoc !== null ? String(m.tvoc) : null}
          unit="idx"
        />
        <Metric
          label="NOx"
          value={m.nox !== null ? String(m.nox) : null}
          unit="idx"
        />
      </div>
      <div className="mt-4 pt-3 flex items-center justify-between gap-2 flex-wrap mono text-[11px] text-ink-3 border-t border-line-1">
        <span>
          id {m.id}
          {m.type ? ` · ${m.type}` : ""}
        </span>
        <span>{freshness(m.timestamp)}</span>
      </div>
    </Panel>
  );
}

function Legend() {
  return (
    <Panel className="p-4">
      <PanelHeader title="US AQI (PM2.5) scale" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {([
          { dim: "ok", label: "0–50 Good" },
          { dim: "warn", label: "51–100 Moderate" },
          { dim: "warn", label: "101–150 USG" },
          { dim: "err", label: "151–200 Unhealthy" },
          { dim: "err", label: "201–300 Very Unhealthy" },
          { dim: "err", label: "300+ Hazardous" },
        ] as { dim: Dim; label: string }[]).map((band) => (
          <div key={band.label} className="flex items-center gap-2">
            <Marker dim={band.dim} />
            <span className="text-ink-2">{band.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-ink-3 border-t border-line-1">
        <span className="inline-flex items-center gap-2"><Marker dim="ok" />CO₂ &lt; 800 fresh</span>
        <span className="inline-flex items-center gap-2"><Marker dim="warn" />800–1200 elevated</span>
        <span className="inline-flex items-center gap-2"><Marker dim="warn" />1200–2000 stuffy</span>
        <span className="inline-flex items-center gap-2"><Marker dim="err" />&gt; 2000 poor</span>
      </div>
    </Panel>
  );
}

export default function AirPage() {
  const [air, setAir] = useState<AirData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/life/air")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setAir)
      .catch((err) => setError(String(err)));
    const interval = setInterval(() => {
      fetch("/api/life/air")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setAir(d))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <PageShell>
        <Panel>
          <div className="text-ink-1 text-sm flex items-center gap-2">
            <Marker dim="err" /> Air Quality unavailable: {error}
          </div>
        </Panel>
      </PageShell>
    );
  }

  const monitors = air?.monitors ?? [];
  const sorted = [...monitors].sort((a, b) => {
    const aOut = a.type === "outdoor" || a.name.toLowerCase().includes("backyard") ? 1 : 0;
    const bOut = b.type === "outdoor" || b.name.toLowerCase().includes("backyard") ? 1 : 0;
    return aOut - bOut || a.name.localeCompare(b.name);
  });

  return (
    <PageShell>
      <PageHeader title="Air" subtitle="Indoor and outdoor air quality across your AirGradient monitors." />
      <Banner air={air} />
      <Legend />
      {sorted.length === 0 ? (
        <>
          <EmptyStateGuide
            section="Air Quality"
            description="Indoor air monitoring data. Add an AirGradient (or compatible) device and wire its API key to populate."
            hideInterview
            daPromptExample="walk me through connecting an air quality sensor"
          />
          <Panel>
            <div className="p-4 text-center text-sm text-ink-2">
              No monitors in cache yet. Run{" "}
              <code className="mono text-ink-1 break-all">
                bun ~/.claude/LIFEOS/PULSE/checks/airgradient-poll.ts
              </code>{" "}
              to prime, or wait for the next 5-minute poll.
            </div>
          </Panel>
        </>
      ) : (
        <section className="flex flex-col gap-4">
          {sorted.map((m) => (
            <MonitorCard key={m.id} m={m} />
          ))}
        </section>
      )}
    </PageShell>
  );
}
