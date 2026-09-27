"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface OnboardingState {
  templateMode: boolean;
  daName: string;
  interviewCommand: string;
}

const DISMISSED_KEY = "pai:template-onboarding:dismissed";

export default function TemplateOnboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage.getItem(DISMISSED_KEY) === "1") {
      setDismissed(true);
    }
    fetch("/api/onboarding/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setState(d))
      .catch(() => setState(null));
  }, []);

  if (!state || !state.templateMode || dismissed) return null;

  const handleDismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const daName = state.daName || "your DA";
  const cmd = state.interviewCommand || "/interview";

  return (
    <div className="border-b border-line-1">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex items-start gap-4">
          <span className="label-caps flex items-center gap-2 shrink-0 pt-0.5">
            <span className="fig-key" style={{ color: "var(--ink-3)" }} aria-hidden />
            Template
          </span>
          <p className="flex-1 min-w-0 text-[13px] leading-relaxed text-ink-2">
            Pulse shows sample content until you make it yours. Run{" "}
            <code className="mono text-[12px] text-ink-1">{cmd}</code> with {daName}, or edit{" "}
            <code className="mono text-[12px] text-ink-1">~/.claude/LIFEOS/USER/</code>.
          </p>
          <button
            onClick={handleDismiss}
            aria-label="Hide for this session"
            className="shrink-0 rounded-[10px] text-ink-3 hover:text-ink-1 p-1 transition-colors"
            title="Hide for this session — banner returns until you customize your USER/ files"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
