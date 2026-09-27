"use client";

import { useMemo } from "react";

// ─── Hook ───

export function useHeatLevel(eventsPerMinute: number, activeAgentCount: number) {
  return useMemo(() => {
    // Events contribution (logarithmic)
    const eventsContribution =
      eventsPerMinute <= 0 ? 0 : eventsPerMinute >= 128 ? 1 : Math.log2(Math.max(1, eventsPerMinute)) / Math.log2(128);

    // Agents contribution (linear, 1-5 range)
    const agentsContribution =
      activeAgentCount <= 1 ? 0 : activeAgentCount >= 5 ? 1 : (activeAgentCount - 1) / 4;

    // Combined (85% events, 15% agents)
    const intensity = Math.min(1, Math.max(0, eventsContribution * 0.85 + agentsContribution * 0.15));

    // Label
    let label: string;
    if (eventsPerMinute < 4) label = "Cold";
    else if (eventsPerMinute < 8) label = "Cool";
    else if (eventsPerMinute < 16) label = "Warm";
    else if (eventsPerMinute < 32) label = "Hot";
    else if (eventsPerMinute < 64) label = "Fire";
    else label = "Inferno";

    return { intensity, label };
  }, [eventsPerMinute, activeAgentCount]);
}
