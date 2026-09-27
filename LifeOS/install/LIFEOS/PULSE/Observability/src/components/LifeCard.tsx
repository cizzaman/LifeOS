"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

interface LifeCardData {
  oneSentence: string;
  current: {
    focus: string;
    energy: string;
    mood: string;
    topIntent: string;
  };
  nextActions: string[];
  sparks: string[];
  timelineBlockCount: number;
  files: {
    sparks: boolean;
    timeline: boolean;
    current: boolean;
  };
}

export default function LifeCard() {
  const [data, setData] = useState<LifeCardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/observability/life-card")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-[10px] border border-line-3 p-6">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <span className="fig-key" style={{ color: "var(--err)" }} aria-hidden />
          Life Card unavailable: {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[10px] border border-line-3 p-6">
        <div className="skeleton h-6 w-3/4 mb-4" />
        <div className="skeleton h-4 w-1/2" />
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-line-3 p-6 space-y-5">
      <div>
        <p className="text-xl text-ink-1 leading-relaxed" style={{ fontFamily: "var(--font-display)" }}>
          {data.oneSentence}
        </p>
        <p className="text-xs text-ink-3 mt-1">
          Top intent: {data.current.topIntent}
        </p>
      </div>

      {data.nextActions.length > 0 && (
        <div>
          <h3 className="label-caps mb-2">
            Next Moves
          </h3>
          <ul className="space-y-1.5">
            {data.nextActions.map((action, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-ink-2"
              >
                <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-ink-3 shrink-0" strokeWidth={1.5} />
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-4 pt-2 border-t border-line-2">
        {data.sparks.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <span className="mono text-ink-1">{data.sparks.length}</span>
            <span>
              sparks:{" "}
              {data.sparks.slice(0, 3).join(", ")}
              {data.sparks.length > 3 && ` +${data.sparks.length - 3}`}
            </span>
          </div>
        )}
        {data.timelineBlockCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <span className="mono text-ink-1">{data.timelineBlockCount}</span>
            <span>2036 moments</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(data.files).map(([name, exists]) => (
          <span key={name} className="flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
            <span
              className="fig-key"
              style={{ color: exists ? "var(--ok)" : "var(--ink-3)" }}
              aria-hidden
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
