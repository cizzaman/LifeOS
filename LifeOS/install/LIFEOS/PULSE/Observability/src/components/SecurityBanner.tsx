"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Marker } from "@/components/ui/chrome";

// Global critical/high security banner. Reads the user's security system via
// /api/bunker/critical. It renders ONLY when that system exists AND reports a
// critical or high finding. A user with no security system configured
// (`configured: false`) never sees it — the banner is generic system code that
// stays dark unless a real security source lights it up.

interface CritItem { target: string; check: string; severity: string; evidence: string }
interface CritData {
  configured: boolean;
  reachable?: boolean;
  count: number;
  critical?: number;
  high?: number;
  items?: CritItem[];
}

export default function SecurityBanner() {
  const [d, setD] = useState<CritData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/bunker/critical", { cache: "no-store" });
        if (!r.ok) return;
        setD(await r.json());
      } catch { /* leave hidden on any error */ }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Hidden unless a configured security system reports at least one crit/high.
  if (!d || !d.configured || d.count === 0) return null;

  const hasCrit = (d.critical ?? 0) > 0;
  const label = [
    d.critical ? `${d.critical} CRITICAL` : "",
    d.high ? `${d.high} HIGH` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="border-b border-line-1">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-2.5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-start gap-4 text-left cursor-pointer group"
        >
          <span className="label-caps flex items-center gap-2 shrink-0 pt-0.5">
            <Marker dim={hasCrit ? "err" : "warn"} />
            Security
          </span>
          <span className="flex-1 min-w-0 text-[13px] leading-relaxed text-ink-1">
            {label} finding{d.count === 1 ? "" : "s"} on your infrastructure
          </span>
          <span className="shrink-0 flex items-center gap-1.5 pt-0.5 label-caps text-ink-3 group-hover:text-ink-1 transition-colors">
            {open ? "hide" : "details"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.5} />
          </span>
        </button>
        {open && d.items && (
          <div className="mt-2 flex flex-col gap-1">
            {d.items.map((it, i) => (
              <div key={it.target + it.check + i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-2 shrink-0 w-16">[{it.severity.toUpperCase().slice(0, 4)}]</span>
                <span className="mono text-ink-1 break-all">{it.target}</span>
                <span className="text-ink-2 break-words">{it.check} — {it.evidence}</span>
              </div>
            ))}
            <a href="/bunker" className="mt-1 text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink-1 transition-colors">
              Open Bunker →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
