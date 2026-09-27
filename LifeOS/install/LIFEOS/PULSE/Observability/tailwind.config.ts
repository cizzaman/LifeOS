import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";

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
  		colors: {
  			/* Tailwind palette folded onto the Pulse palette: every cool hue is the one teal,
  			   every neutral is charcoal, status hues stay distinct. */
  			...(() => {
  				const teal = { 50: '#effafc', 100: '#cdeef5', 200: '#a8e2ee', 300: '#7cd5e6', 400: '#5cc4d8', 500: '#3fb2c9', 600: '#2f97ad', 700: '#1f6f80', 800: '#17525f', 900: '#103a43', 950: '#0a262c' };
  				const charcoal = { 50: '#f0e8d8', 100: '#e4ddcf', 200: '#d9d2c4', 300: '#b8b5ac', 400: '#98a8b3', 500: '#6b7d89', 600: '#55636d', 700: '#3a3a3a', 800: '#262626', 900: '#161616', 950: '#0a0a0a' };
  				const violet = { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#a78bfa', 600: '#8b6fe0', 700: '#6d28d9', 800: '#4c1d95', 900: '#2e1065', 950: '#1e0a45' };
  				return {
  					blue: teal, sky: teal, cyan: teal, indigo: teal, teal,
  					violet, purple: violet, fuchsia: violet,
  					slate: charcoal, gray: charcoal, zinc: charcoal, neutral: charcoal, stone: charcoal,
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
