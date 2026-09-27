"use client";

/**
 * Pulse chrome kit — the ONE set of page-structure primitives.
 * Every route page renders inside PageShell; panels, stat tiles, tabs,
 * and pills come from here. Colors come exclusively from the design
 * tokens in globals.css (surface/line/ink/dim/status) — no component
 * in this file, and no consumer of it, hardcodes a palette.
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

/* ── Dimension + status tint tables (single source for pill/tab tinting) ── */

export type Dim =
  | "health" | "money" | "freedom" | "creative" | "relationships" | "rhythms"
  | "blue" | "ok" | "warn" | "err" | "neutral";

const DIM_COLOR: Record<Dim, string> = {
  health: "var(--health)",
  money: "var(--money)",
  freedom: "var(--freedom)",
  creative: "var(--creative)",
  relationships: "var(--relationships)",
  rhythms: "var(--rhythms)",
  blue: "var(--accent-blue)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  neutral: "var(--ink-2)",
};

export function dimStyle(dim: Dim, active = true): CSSProperties {
  const color = DIM_COLOR[dim];
  return active
    ? {
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 45%, var(--line-2))`,
      }
    : { background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line-2)" };
}

/** The figure marker from the Work illustrations: a 7px outlined square or circle. */
export function Marker({ dim = "blue", shape = "square", filled = true }: { dim?: Dim; shape?: "square" | "circle"; filled?: boolean }) {
  const color = DIM_COLOR[dim];
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: 7,
        height: 7,
        border: `1px solid ${color}`,
        background: filled ? color : "transparent",
        borderRadius: shape === "circle" ? "50%" : 0,
      }}
    />
  );
}

/* ── PageShell — the outer frame of every route page ── */

export function PageShell({
  children,
  fullBleed = false,
  className,
}: {
  children: ReactNode;
  /** Full-viewport dashboards (agents) — no padding, no max width. */
  fullBleed?: boolean;
  className?: string;
}) {
  if (fullBleed) {
    return <div className={cn("flex flex-col flex-1 min-h-0", className)}>{children}</div>;
  }
  return (
    <div className={cn("max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6", className)}>
      {children}
    </div>
  );
}

/* ── PageHeader — display title, muted subtitle, right-side actions ── */

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-ink-1">
          {Icon && <Icon className="w-5 h-5 text-ink-3 shrink-0" strokeWidth={1.5} />}
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Panel — the unified card ── */

export function Panel({
  children,
  className,
  hover = false,
  as: Tag = "div",
  style,
  onClick,
}: {
  children?: ReactNode;
  className?: string;
  /** Adds the standard hover raise (surface-3 + line-3). */
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
  style?: CSSProperties;
  onClick?: () => void;
}) {
  // Clickable panels stay keyboard-reachable: role/tabIndex + Enter/Space.
  const interactive = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <Tag
      className={cn(
        "bg-surface-2 border border-line-2 rounded-[10px] p-5",
        hover && "transition-colors duration-200 hover:border-line-3",
        onClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-blue)]",
        className
      )}
      style={style}
      onClick={onClick}
      {...interactive}
    >
      {children}
    </Tag>
  );
}

/* ── PanelHeader — uppercase label row inside a Panel ── */

export function PanelHeader({
  title,
  icon: Icon,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 mb-3", className)}>
      {Icon && <Icon className="w-4 h-4 text-ink-3 shrink-0" />}
      <span
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3"
        style={{ fontFamily: "'Albert Sans', 'Albert Sans', sans-serif" }}
      >
        {title}
      </span>
      {meta && <span className="text-[12px] text-ink-3 mono">{meta}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── StatTile — number + label ── */

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  dim,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  icon?: LucideIcon;
  /** Tints the value with a dimension/status color. */
  dim?: Dim;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-block w-[17px] shrink-0" style={{ borderTop: `3px solid ${DIM_COLOR[dim ?? "blue"]}` }} />
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-3 shrink-0" strokeWidth={1.5} />}
        <span className="label-caps">{label}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className="leading-none text-ink-1"
          style={{ font: "500 clamp(30px, 3vw, 40px)/1.1 var(--font-display)", letterSpacing: "-0.04em" }}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="text-[12px] text-ink-2 leading-relaxed">{sub}</div>}
    </Panel>
  );
}

/* ── TabBar — the pill tab row (agents-page pattern, generalized) ── */

export interface TabSpec<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: LucideIcon;
  dim?: Dim;
  /** Small hint rendered after the label (count, keyboard number). */
  hint?: ReactNode;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  right,
  className,
}: {
  tabs: TabSpec<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Extra content pinned to the right of the row. */
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {tabs.map(({ id, label, icon: Icon, dim = "blue", hint }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md mono text-[11px] uppercase tracking-[0.14em] cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-ink-1"
            style={
              isActive
                ? { color: "var(--ink-1)", background: "var(--primary-soft)", border: "1px solid color-mix(in srgb, var(--accent-blue) 55%, var(--line-2))" }
                : { color: "var(--ink-2)", background: "transparent", border: "1px solid transparent" }
            }
          >
            {isActive ? <Marker dim={dim} shape="circle" /> : Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />}
            {label}
            {hint != null && <span className="text-[10.5px] opacity-60">{hint}</span>}
          </button>
        );
      })}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/* ── Pill — inline status/dimension chip ── */

export function Pill({
  children,
  dim = "blue",
  className,
  title,
}: {
  children: ReactNode;
  dim?: Dim;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] mono text-[11px] leading-[1.4] whitespace-nowrap text-ink-1 border border-line-2", className)}
    >
      <Marker dim={dim} shape="circle" />
      {children}
    </span>
  );
}

/* ── EmptyState — consistent nothing-here placeholder ── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center gap-2 py-12", className)}>
      {Icon && <Icon className="w-6 h-6 text-ink-3" strokeWidth={1.25} />}
      <div className="label-caps">{title}</div>
      {hint && <div className="text-[13px] text-ink-2 max-w-md leading-relaxed">{hint}</div>}
    </div>
  );
}
