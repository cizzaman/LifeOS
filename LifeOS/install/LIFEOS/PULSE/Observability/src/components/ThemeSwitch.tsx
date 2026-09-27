"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { THEMES, setTheme, syncStoredTheme, useTheme } from "@/lib/theme";

/** Personal OS theme swatches: a circle split between the theme's ground and its accent. */
const SWATCH: Record<string, { ground: string; accent: string }> = {
  dark: { ground: "#0a0a0a", accent: "#3fb2c9" },
  light: { ground: "#faf9f5", accent: "#9a5800" },
};

export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useTheme();
  useEffect(syncStoredTheme, []);
  return (
    <div role="group" aria-label="Theme" className={cn("flex items-center gap-1", className)}>
      {THEMES.map(({ id, label }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              "grid place-items-center w-7 h-7 rounded-[10px] border transition-colors duration-200",
              active ? "border-[color:var(--accent-blue)] bg-[color:var(--primary-soft)]" : "border-transparent hover:border-line-2"
            )}
          >
            <i
              aria-hidden
              className="block w-3.5 h-3.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${SWATCH[id].ground} 50%, ${SWATCH[id].accent} 50%)`,
                border: "1px solid var(--line-3)",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
