"use client";

/**
 * Pulse chrome kit — the ONE set of page-structure primitives.
 * Every route page renders inside PageShell; panels, stat tiles, tabs,
 * and pills come from here. They follow the Work-modal rules: hairline
 * panels on the ground, Fira Code caps labels, mono numbers, 7px keys.
 * Colour belongs to data only (chart series, status keys) — never to
 * text, borders or chrome.
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

/** Status dims keep their colour on a 7px marker; every other dim is identity only and stays grey. */
const STATUS: ReadonlySet<Dim> = new Set(["ok", "warn", "err"]);
export const isStatusDim = (dim?: Dim) => dim != null && STATUS.has(dim);

/** Chips and toggles: never coloured by dim. Active is the one selection style (teal line on primary-soft); inactive is muted on a hairline. */
export function dimStyle(_dim: Dim, active = true): CSSProperties {
  return active
    ? { background: "var(--primary-soft)", color: "var(--ink-1)", border: "1px solid var(--accent-blue)" }
    : { background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line-2)" };
}

/** The data colour behind a dim, for chart series and markers only — never text or borders. */
export const dimColor = (dim: Dim) => DIM_COLOR[dim];

/**
 * The 7px figure key from the Work illustrations: an outlined square (or circle) with a faint
 * tint of its own colour. Neutral grey unless `colored` or a status dim asks for its colour.
 */
export function Marker({
  dim = "neutral",
  shape = "square",
  filled = false,
  colored = false,
}: {
  dim?: Dim;
  shape?: "square" | "circle";
  filled?: boolean;
  colored?: boolean;
}) {
  const color = colored || isStatusDim(dim) ? DIM_COLOR[dim] : "var(--ink-3)";
  return (
    <span
      aria-hidden
      className={cn("fig-key", shape === "circle" && "is-round")}
      style={{ color, ...(filled ? { background: color } : {}) }}
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
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-3 pb-2", className)}>
      <div className="min-w-0">
        <h1 className="text-ink-1" style={{ font: "500 clamp(24px, 3vw, 38px)/1.15 var(--font-display)", letterSpacing: "-0.025em" }}>
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-w-full">{actions}</div>}
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
        "bg-transparent border border-line-3 rounded-[10px] p-6 max-sm:p-4",
        hover && "transition-colors duration-200 hover:border-[color:var(--accent-blue)] hover:bg-[color:var(--primary-soft)]",
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
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 mb-5", className)}>
      <span className="label-caps">{title}</span>
      {meta && <span className="label-caps text-ink-3" style={{ letterSpacing: "0.1em" }}>{meta}</span>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── StatTile — number + label ── */

export function StatTile({
  label,
  value,
  unit,
  dim,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  icon?: LucideIcon;
  /** Status dims (ok/warn/err) colour the 7px key; other dims stay grey. */
  dim?: Dim;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("p-5 flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className="text-ink-1"
          style={{ font: "400 clamp(28px, 3.4vw, 40px)/1.2 var(--font-mono)", letterSpacing: "-0.03em" }}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] text-ink-2">{unit}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Marker dim={dim} />
        <span className="label-caps text-ink-1">{label}</span>
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
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {tabs.map(({ id, label, hint }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] mono text-[10px] uppercase tracking-[0.16em] cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-ink-1"
            style={
              isActive
                ? { color: "var(--ink-1)", background: "var(--primary-soft)", border: "1px solid var(--accent-blue)" }
                : { color: "var(--ink-2)", background: "transparent", border: "1px solid transparent" }
            }
          >
            {label}
            {hint != null && <span className="text-ink-3">{hint}</span>}
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
  dim = "neutral",
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
      className={cn("inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] leading-[1.5] whitespace-nowrap text-ink-2", className)}
    >
      {isStatusDim(dim) && <Marker dim={dim} />}
      {children}
    </span>
  );
}

/* ── EmptyState — consistent nothing-here placeholder ── */

export function EmptyState({
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
      <div className="label-caps">{title}</div>
      {hint && <div className="text-[13px] text-ink-2 max-w-md leading-relaxed">{hint}</div>}
    </div>
  );
}
