export const SCHEMA_VERSION = "1.0.0";

export const colors = {
  light: {
    bg: "#FAF9F5",
    bgElevated: "#FFF7ED",
    bgSubtle: "#F8ECDC",
    border: "#E7D8C8",
    borderStrong: "#CFB797",
    text: "#292524",
    textMuted: "#57534E",
    textFaint: "#6B625B",
    accent: "#9A5800",
    accentSoft: "rgba(154, 88, 0, 0.12)",
    success: "#15803D",
    warn: "#C27B26",
    error: "#991B1B",
    pillTemplate: "#C27B26",
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

// localStorage key the Pulse Next app (ThemeSwitch.tsx) writes to. Shared
// across every LifeOS surface on the same origin so one toggle covers both.
export const THEME_STORAGE_KEY = "pulse-theme";

// Pre-paint snippet — sets data-theme from localStorage before first paint so
// there's no dark→light flash. Kept verbatim identical to the Next app's
// theme-script.ts; do not reformat, the string is reused byte-for-byte.
export const THEME_PREPAINT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")==="light"?"light":"dark";var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}})()</script>`;

function cssVarsFor(mode: Mode): string {
  const c = colors[mode];
  return Object.entries(c).map(([k, v]) => `--c-${k}: ${v};`).join(" ");
}

// Emits both palettes: dark on :root (dark stays the default), light scoped
// under html[data-theme="light"]. One HTML file works in both themes — the
// caller's `mode` no longer picks a single inlined palette; it only seeds the
// initial data-theme attribute (see renderShell), which THEME_PREPAINT_SCRIPT
// corrects from localStorage before paint.
export function cssVars(): string {
  return `:root { ${cssVarsFor("dark")} } html[data-theme="light"] { ${cssVarsFor("light")} }`;
}
