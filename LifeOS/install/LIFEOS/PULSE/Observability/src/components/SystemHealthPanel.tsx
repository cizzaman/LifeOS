"use client";

/**
 * System Health (Doctor) — read-only diagnostic surface over the advisory
 * capability manifest + heartbeat written by LIFEOS/TOOLS/Doctor.ts, plus the
 * hook reconciler. DIAGNOSTIC REGISTER ONLY: no scores, no percentages, no
 * meters. Declined renders calm ("off (declined)"), never red. A dead checker
 * (heartbeat > 7 days) carries the error key, because a silent checker hides
 * every regression behind it.
 */

import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { Marker, Panel, PanelHeader, type Dim } from "@/components/ui/chrome";

type CapState = "live" | "broken" | "declined" | "stale";

interface Capability {
  id: string;
  title: string;
  state: CapState;
  detail: string;
  fixCmd: string | null;
  checkedAt: string;
  ttlHours: number;
  probeClass: string;
  stale: boolean;
}

interface DoctorData {
  manifest:
    | { present: true; updatedAt: string | null; capabilities: Capability[] }
    | { present: false; hint: string; capabilities: unknown[] };
  heartbeat:
    | { present: true; ranAt: string | null; network: boolean; ageMs: number | null; stale7d: boolean }
    | { present: false; hint: string };
  reconcile: { unwired: string[]; missing: string[]; note: string };
}

// state → { dim, hollow, label }. Stale (a live entry past its TTL) reads as a
// calm dashed key, not an error. Declined is calm and never red.
function stateFace(cap: Capability): { dim: Dim; hollow: boolean; label: string } {
  if (cap.state === "declined") return { dim: "neutral", hollow: false, label: "off (declined)" };
  if (cap.state === "broken") return { dim: "err", hollow: false, label: "broken" };
  if (cap.stale) return { dim: "neutral", hollow: true, label: "stale — re-run doctor" };
  if (cap.state === "live") return { dim: "ok", hollow: false, label: "live" };
  return { dim: "neutral", hollow: true, label: "stale — re-run doctor" };
}

function StateKey({ dim, hollow }: { dim: Dim; hollow: boolean }) {
  if (hollow) return <span aria-hidden className="fig-key is-plan" style={{ color: "var(--ink-3)" }} />;
  return <Marker dim={dim} />;
}

function humanizeAge(ms: number | null): string {
  if (ms == null) return "unknown";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SystemHealthPanel() {
  const { data, isError } = useQuery<DoctorData>({
    queryKey: ["doctor-state"],
    queryFn: async () => {
      const res = await fetch("/api/doctor");
      if (!res.ok) throw new Error("Failed to fetch doctor state");
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isError) {
    return (
      <Panel>
        <PanelHeader title="System Health" />
        <p className="text-[13px] text-ink-3">Doctor surface unavailable.</p>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel>
        <PanelHeader title="System Health" />
        <p className="text-[13px] text-ink-3">Loading…</p>
      </Panel>
    );
  }

  const { manifest, heartbeat, reconcile } = data;
  const hbAge = heartbeat.present ? humanizeAge(heartbeat.ageMs) : null;
  const hbRed = heartbeat.present && heartbeat.stale7d;

  return (
    <Panel>
      <PanelHeader
        title="System Health"
        meta={
          heartbeat.present ? (
            <span className={`inline-flex items-center gap-2 ${hbRed ? "text-ink-1" : "text-ink-3"}`}>
              {hbRed && <Marker dim="err" />}
              doctor last ran {hbAge}
              {heartbeat.network ? " · network" : ""}
              {hbRed ? " — checker may be dead" : ""}
            </span>
          ) : undefined
        }
      />

      {/* Heartbeat absent — no doctor run yet */}
      {!heartbeat.present && (
        <p className="mb-4 flex items-start gap-2 text-[13px] text-ink-2">
          <span className="mt-1.5 flex shrink-0"><Marker dim="warn" /></span>
          {heartbeat.hint}
        </p>
      )}

      {/* Capabilities */}
      {!manifest.present ? (
        <p className="text-[13px] text-ink-3">{manifest.hint}</p>
      ) : manifest.capabilities.length === 0 ? (
        <p className="text-[13px] text-ink-3">No capabilities probed yet — bun LIFEOS/TOOLS/Doctor.ts</p>
      ) : (
        <div className="flex flex-col gap-2">
          {manifest.capabilities.map((cap) => {
            const face = stateFace(cap);
            return (
              <div
                key={cap.id}
                className="flex items-start gap-3 rounded-[10px] px-3 py-2.5 border border-line-2"
              >
                <span className="mt-1.5 flex shrink-0">
                  <StateKey dim={face.dim} hollow={face.hollow} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-[13px] leading-snug text-ink-1 flex-1 min-w-0 break-words">
                      {cap.title}
                    </span>
                    <span className="mono text-[10px] uppercase tracking-[0.1em] leading-snug text-ink-2 shrink-0 ml-auto">
                      {face.label}
                    </span>
                  </div>
                  {cap.state !== "declined" && cap.detail && (
                    <div className="text-[12px] leading-snug text-ink-3 mt-1">
                      {cap.detail}
                    </div>
                  )}
                  {cap.state === "broken" && cap.fixCmd && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <Wrench className="w-3 h-3 shrink-0 mt-0.5 text-ink-3" strokeWidth={1.5} />
                      <code className="text-[12px] mono text-ink-2 break-all">{cap.fixCmd}</code>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hook reconciliation */}
      <div className="mt-4 pt-3 border-t border-line-2">
        <div className="label-caps mb-2">Hook reconciliation</div>
        {reconcile.unwired.length === 0 && reconcile.missing.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <Marker dim="ok" />
            hooks fully reconciled — every declared hook is registered
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {reconcile.unwired.length > 0 && (
              <div>
                <span className="flex items-center gap-2 text-[12px] text-ink-2">
                  <Marker dim="warn" />
                  declared on disk but not registered ({reconcile.unwired.length}):
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {reconcile.unwired.map((f) => (
                    <code key={f} className="text-[12px] mono text-ink-2 break-all">
                      {f}
                    </code>
                  ))}
                </div>
              </div>
            )}
            {reconcile.missing.length > 0 && (
              <div>
                <span className="flex items-center gap-2 text-[12px] text-ink-2">
                  <Marker dim="err" />
                  registered but missing from disk ({reconcile.missing.length}):
                </span>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {reconcile.missing.map((f) => (
                    <code key={f} className="text-[12px] mono text-ink-2 break-all">
                      {f}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
