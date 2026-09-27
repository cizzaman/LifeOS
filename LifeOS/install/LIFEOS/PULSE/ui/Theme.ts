export const SCHEMA_VERSION = "1.0.0";

export const colors = {
  light: {
    bg: "#FAF9F5",
    bgElevated: "#FFF7ED",
    bgSubtle: "#F8ECDC",
    border: "#E7D8C8",
    text: "#292524",
    textMuted: "#57534E",
    accent: "#9A5800",
    accentHover: "#754200",
    success: "#15803D",
    warn: "#B45309",
    error: "#991B1B",
    pillTemplate: "#B45309",
    pillCustomized: "#15803D",
  },
  dark: {
    bg: "#0A0A0A",
    bgElevated: "#111111",
    bgSubtle: "#181818",
    border: "#262626",
    text: "#F0E8D8",
    textMuted: "#98A8B3",
    accent: "#3FB2C9",
    accentHover: "#5CC4D8",
    success: "#22C55E",
    warn: "#F5C451",
    error: "#F87171",
    pillTemplate: "#F5C451",
    pillCustomized: "#22C55E",
  },
} as const;

export const type = {
  fontSans: '"Albert Sans", system-ui, sans-serif',
  fontMono: '"Fira Code", ui-monospace, monospace',
  fontSerif: '"Outfit", "Albert Sans", system-ui, sans-serif',
  scale: {
    xs: "12px",
    sm: "14px",
    base: "16px",
    md: "18px",
    lg: "22px",
    xl: "28px",
    xxl: "36px",
    display: "48px",
  },
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  lineHeight: { tight: 1.2, snug: 1.35, normal: 1.55, loose: 1.75 },
} as const;

export const space = {
  px: "1px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  xxxl: "48px",
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "10px",
  pill: "999px",
} as const;

export const motion = {
  fast: "120ms cubic-bezier(0.22, 1, 0.36, 1)",
  base: "220ms cubic-bezier(0.22, 1, 0.36, 1)",
  slow: "550ms cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const layout = {
  sidebarWidth: "240px",
  headerHeight: "56px",
  contentMaxWidth: "880px",
} as const;

export type Mode = "light" | "dark";

export function cssVars(mode: Mode): string {
  const c = colors[mode];
  return Object.entries(c).map(([k, v]) => `--c-${k}: ${v};`).join(" ");
}
