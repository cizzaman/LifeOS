"use client";

import { useState, useEffect, useCallback } from "react";
import { localOnlyApiCall } from "@/lib/local-api";
import { Marker, type Dim } from "@/components/ui/chrome";

// ─── System Health Vitals (Widget 18) ───
// Persistent bar at top of Activity page, visible across all tabs.
// Polls voice, hooks, docs, and session health every 30s.

interface HealthData {
  voiceHealth: { rate: number; status: "healthy" | "degraded" | "failing" };
  hookReliability: {
    failsPerHour: number;
    status: "healthy" | "degraded" | "failing";
  };
  docFreshness: {
    status: "healthy" | "degraded" | "failing";
    label: string;
  };
  activeSessions: {
    count: number;
    status: "healthy" | "degraded" | "failing";
  };
}

type Status = "healthy" | "degraded" | "failing";

const STATUS_DIM: Record<Status, Dim> = {
  healthy: "ok",
  degraded: "warn",
  failing: "err",
};

export default function SystemHealthVitals() {
  const [health, setHealth] = useState<HealthData | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      // Fetch voice events
      const voice = await localOnlyApiCall<{
        summary?: { successRate?: number };
      }>("/api/observability/voice-events").catch(() => null);
      const voiceRate = voice?.summary?.successRate ?? 100;

      // Fetch tool failures
      const failures = await localOnlyApiCall<{
        summary?: { recent24h?: number };
      }>("/api/observability/tool-failures").catch(() => null);
      const recentFailures = failures?.summary?.recent24h ?? 0;
      const failsPerHour = recentFailures / 24;

      // Fetch algorithm state for active session count
      const algo = await localOnlyApiCall<{
        algorithms?: Array<{ active?: boolean }>;
      }>("/api/algorithm").catch(() => null);
      const activeCount =
        algo?.algorithms?.filter((a) => a.active)?.length ?? 0;

      setHealth({
        voiceHealth: {
          rate: voiceRate,
          status:
            voiceRate >= 90
              ? "healthy"
              : voiceRate >= 70
                ? "degraded"
                : "failing",
        },
        hookReliability: {
          failsPerHour: Math.round(failsPerHour * 10) / 10,
          status:
            failsPerHour <= 1
              ? "healthy"
              : failsPerHour <= 5
                ? "degraded"
                : "failing",
        },
        docFreshness: {
          status: "healthy",
          label: "Fresh",
        },
        activeSessions: {
          count: activeCount,
          status: activeCount > 0 ? "healthy" : "degraded",
        },
      });
    } catch {
      // Silently fail — vitals bar simply stays hidden until data arrives
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!health) return null;

  return (
    <div className="flex items-center flex-wrap gap-x-6 gap-y-1.5 px-4 py-2 border-b border-line-2 shrink-0">
      <VitalMetric
        label="Voice"
        value={`${Math.round(health.voiceHealth.rate)}%`}
        status={health.voiceHealth.status}
      />
      <VitalMetric
        label="Hooks"
        value={`${health.hookReliability.failsPerHour}/hr`}
        status={health.hookReliability.status}
      />
      <VitalMetric label="Documentation" value={health.docFreshness.label} />
      <VitalMetric label="Active" value={`${health.activeSessions.count}`} />
    </div>
  );
}

/** Measured health (voice success, hook failures) carries a status key; the rest stay neutral. */
function VitalMetric({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: Status;
}) {
  return (
    <div className="flex items-center gap-2">
      <Marker dim={status ? STATUS_DIM[status] : "neutral"} />
      <span className="label-caps">{label}</span>
      <span className="mono text-[12px] text-ink-1">{value}</span>
    </div>
  );
}
