import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Hau Hau Custom Palette
        hauhau: {
          surface: "var(--surface)",
          "surface-dim": "var(--surface-dim)",
          "surface-bright": "var(--surface-bright)",
          "surface-container": "var(--surface-container)",
          "surface-container-lowest": "var(--surface-container-lowest)",
          "surface-container-low": "var(--surface-container-low)",
          "surface-container-high": "var(--surface-container-high)",
          "surface-container-highest": "var(--surface-container-highest)",
          "on-surface": "var(--on-surface)",
          "on-surface-variant": "var(--on-surface-variant)",
          outline: "var(--outline)",
          "outline-variant": "var(--outline-variant)",
          earth: "var(--earth)",
          cream: "var(--cream)",
          gold: "var(--gold)",
          amber: "var(--amber)",
          bamboo: "var(--bamboo)",
          water: "var(--water)",
          canopy: "var(--canopy)",
        }
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        serif: ["'Fable Noir'", "var(--font-playfair)", "serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      spacing: {
        'container-desktop': '80px',
        'container-mobile': '24px',
        'section-gap': '120px',
      },
    },
  },
  plugins: [],
};
export default config;
