export const SCHEMA_VERSION = "1.0.0";

export const colors = {
  light: {
    bg: "#FAF9F5",
    bgElevated: "#FAF9F5",
    bgSubtle: "#F1EFE9",
    border: "#E4E1DA",
    borderStrong: "#CFCAC0",
    text: "#1C1B19",
    textMuted: "#57534E",
    textFaint: "#8A857D",
    accent: "#1F7F92",
    accentSoft: "rgba(31, 127, 146, 0.10)",
    success: "#15803D",
    warn: "#B45309",
    error: "#B91C1C",
    pillTemplate: "#B45309",
    pillCustomized: "#15803D",
  },
  dark: {
    bg: "#0A0A0A",
    bgElevated: "#0A0A0A",
    bgSubtle: "#141414",
    border: "#262626",
    borderStrong: "#3A3A3A",
    text: "#F0E8D8",
    textMuted: "#98A8B3",
    textFaint: "#6B7D89",
    accent: "#3FB2C9",
    accentSoft: "rgba(63, 178, 201, 0.12)",
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
  weight: { normal: 400, medium: 500 },
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
  none: "0",
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
