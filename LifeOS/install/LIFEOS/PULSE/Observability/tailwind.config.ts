import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";

const CHROMATIC = ["red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (pick: (shade: number) => string) => Object.fromEntries(SHADES.map((shade) => [shade, pick(shade)]));
type Palette = { [key: string]: string | Palette };
const fold = (pick: (shade: number) => string, tokens: Palette): Palette => ({
  ...Object.fromEntries(CHROMATIC.map((hue) => [hue, scale(pick)])),
  ...tokens,
});
/* Theme-aware colour from a token; keeps Tailwind opacity modifiers working on CSS variables. */
const tone = (token: string) => `color-mix(in srgb, var(${token}) calc(<alpha-value> * 100%), transparent)`;
/* Ink: light shades read as primary text, mid as muted, dark as faint. */
const neutralText = fold((shade) => tone(shade <= 400 ? "--ink-1" : shade <= 600 ? "--ink-2" : "--ink-3"), {
  ok: "var(--ink-1)", warn: "var(--ink-1)", err: "var(--ink-1)",
  primary: { DEFAULT: "var(--ink-1)", foreground: "var(--ground)" },
  accent: { DEFAULT: "var(--ink-1)", foreground: "var(--ink-1)" },
  destructive: { DEFAULT: "var(--ink-1)", foreground: "var(--ink-1)" },
  dim: { health: "var(--ink-1)", money: "var(--ink-1)", freedom: "var(--ink-1)", creative: "var(--ink-1)", relationships: "var(--ink-1)", rhythms: "var(--ink-1)" },
});
/* Lines: one mid grey, so opacity modifiers still land between hairline and figure line. */
const neutralLine = fold(() => tone("--n-750"), {
  ok: "var(--line-3)", warn: "var(--line-3)", err: "var(--line-3)",
  primary: { DEFAULT: "var(--line-3)" },
  accent: { DEFAULT: "var(--line-3)" },
  destructive: { DEFAULT: "var(--line-3)" },
  dim: { health: "var(--line-3)", money: "var(--line-3)", freedom: "var(--line-3)", creative: "var(--line-3)", relationships: "var(--line-3)", rhythms: "var(--line-3)" },
});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontSize: {
      'xs': ['0.75rem', { lineHeight: '1.125rem' }],    // 12px
      'sm': ['0.875rem', { lineHeight: '1.375rem' }],   // 14px
      'base': ['0.9375rem', { lineHeight: '1.5rem' }],  // 15px
      'lg': ['1.125rem', { lineHeight: '1.625rem' }],   // 18px
      'xl': ['1.25rem', { lineHeight: '1.75rem' }],     // 20px
      '2xl': ['1.5rem', { lineHeight: '2rem' }],        // 24px
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],   // 30px
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],     // 36px
      '5xl': ['3rem', { lineHeight: '1' }],             // 48px
    },
  	extend: {
  		/* Minimal rule: text, borders, rings and gradients never carry colour. Any chromatic
  		   Tailwind class resolves to ink or line greys for these utilities; backgrounds, fills
  		   and strokes keep colour for data marks (dots, tracks, chart series). */
  		textColor: neutralText,
  		borderColor: neutralLine,
  		ringColor: neutralLine,
  		divideColor: neutralLine,
  		outlineColor: neutralLine,
  		gradientColorStops: neutralLine,
  		colors: {
  			/* Tailwind palette folded onto the Pulse palette: every cool hue is the one teal,
  			   every neutral is charcoal, status hues stay distinct. */
  			...(() => {
  				/* Every neutral follows the theme's ramp and every cool hue is the theme accent,
  				   so a stray gray-900 or teal-500 reads right in both Dark and Light yellow. */
  				const ramp = Object.fromEntries(SHADES.map((shade) => [shade, tone(`--n-${shade}`)]));
  				const accent = Object.fromEntries(SHADES.map((shade) => [shade, tone(shade <= 300 ? "--accent-soft" : "--accent-blue")]));
  				const violet = Object.fromEntries(SHADES.map((shade) => [shade, tone("--data-violet")]));
  				return {
  					white: tone("--n-50"), black: tone("--n-950"),
  					blue: accent, sky: accent, cyan: accent, indigo: accent, teal: accent,
  					violet, purple: violet, fuchsia: violet,
  					slate: ramp, gray: ramp, zinc: ramp, neutral: ramp, stone: ramp,
  					emerald: defaultColors.green, rose: defaultColors.red, pink: defaultColors.red,
  				};
  			})(),
  			/* Pulse design tokens (globals.css :root) */
  			ground: 'var(--ground)',
  			surface: {
  				'1': 'var(--surface-1)',
  				'2': 'var(--surface-2)',
  				'3': 'var(--surface-3)'
  			},
  			line: {
  				'1': 'var(--line-1)',
  				'2': 'var(--line-2)',
  				'3': 'var(--line-3)'
  			},
  			ink: {
  				'1': 'var(--ink-1)',
  				'2': 'var(--ink-2)',
  				'3': 'var(--ink-3)'
  			},
  			ok: 'var(--ok)',
  			warn: 'var(--warn)',
  			err: 'var(--err)',
  			dim: {
  				health: 'var(--health)',
  				money: 'var(--money)',
  				freedom: 'var(--freedom)',
  				creative: 'var(--creative)',
  				relationships: 'var(--relationships)',
  				rhythms: 'var(--rhythms)'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			ring: 'hsl(var(--ring))',
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: ['Albert Sans', 'system-ui', 'sans-serif'],
  			display: ['Outfit', 'Albert Sans', 'system-ui', 'sans-serif'],
  			serif: ['Outfit', 'Albert Sans', 'system-ui', 'sans-serif'],
  			mono: ['Fira Code', 'ui-monospace', 'monospace']
  		},

  		keyframes: {
  			'pulse-glow': {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.5'
  				}
  			},
  			'slide-up': {
  				'0%': {
  					transform: 'translateY(10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			'number-tick': {
  				'0%': {
  					transform: 'translateY(-100%)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
  			'slide-up': 'slide-up 0.3s ease-out',
  			'number-tick': 'number-tick 0.3s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
