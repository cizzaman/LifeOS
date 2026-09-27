"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useObserverMode } from "@/contexts/ObserverModeContext";
import { observerScopeFor } from "@/lib/observer";

/**
 * Keeps <html data-observer-scope> in sync on client-side navigation (the
 * pre-paint script in layout.tsx handles the initial load) and shows the
 * full-page indicator chip when a wholly-personal page is blurred.
 */
export default function ObserverScope() {
  const pathname = usePathname();
  const { observerMode } = useObserverMode();
  const scope = observerScopeFor(pathname ?? "/");

  useEffect(() => {
    document.documentElement.setAttribute("data-observer-scope", scope);
  }, [scope]);

  if (!observerMode || scope !== "full") return null;

  return (
    <div className="fixed inset-x-0 top-24 z-50 flex justify-center pointer-events-none px-4">
      <div className="label-caps text-ink-1 flex items-center gap-2 px-4 py-2 rounded-[10px] bg-surface-1 border border-line-3">
        <span aria-hidden className="fig-key" style={{ color: "var(--ink-3)" }} />
        OBSERVER MODE — personal page hidden
      </div>
    </div>
  );
}
