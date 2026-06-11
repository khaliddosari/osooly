import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Liquid Glass remap ───────────────────────────────────────────────
        // The codebase uses Material-Design-3 token names everywhere. We re-point
        // those names to dark "liquid glass" values so the whole app inverts to
        // dark mode without renaming a single class. Glass *material* (blur +
        // hairline + bevel) lives in globals.css `.glass*`; these are flat colors.

        // Page / backgrounds (near-black over the ambient glow field)
        surface: "#0a0a0f",
        background: "#0a0a0f",
        "surface-bright": "#0a0a0f",
        "surface-dim": "#08080c",
        "inverse-on-surface": "#111118",
        "inverse-surface": "#e8e8ed",

        // Faint white "glass tint" surfaces (cards fall back to these w/o .glass)
        "surface-container-lowest": "rgba(255,255,255,0.03)",
        "surface-container-low": "rgba(255,255,255,0.04)",
        "surface-container": "rgba(255,255,255,0.05)",
        "surface-container-high": "rgba(255,255,255,0.07)",
        "surface-container-highest": "rgba(255,255,255,0.09)",
        "surface-variant": "rgba(255,255,255,0.06)",

        // Text
        "on-surface": "#e8e8ed",
        "on-background": "#e8e8ed",
        "on-surface-variant": "#9999a8",
        outline: "#9999a8",
        "outline-variant": "rgba(255,255,255,0.12)",

        // Accent — cyan → blue. `primary` is the cyan; `primary-container` the deep blue.
        primary: "#4fc3f7",
        "primary-container": "#0288d1",
        "surface-tint": "#4fc3f7",
        "inverse-primary": "#0288d1",
        "primary-fixed": "rgba(79,195,247,0.14)",
        "primary-fixed-dim": "rgba(79,195,247,0.22)",
        "on-primary": "#0a0a0f", // text that sits ON the cyan accent → near-black
        "on-primary-container": "#bfe9ff",
        "on-primary-fixed": "#bfe9ff",
        "on-primary-fixed-variant": "#4fc3f7",
        // Faint cyan wash (was the purple selection tint)
        "surface-purple-tint": "rgba(79,195,247,0.12)",
        "surface-green-tint": "rgba(128,216,130,0.14)",

        // Status colors (kept, tuned for dark)
        "success-green": "#5fd07f",
        error: "#ff6b6b",
        "error-container": "rgba(255,107,107,0.16)",
        "on-error": "#0a0a0f",
        "on-error-container": "#ffb4ab",
        "error-pink": "#ff8081",
        "info-blue": "#4fc3f7",
        "warning-orange": "#f4a664",

        // Secondary / tertiary (rarely used; map to neutral glass / cyan-dark)
        secondary: "#9999a8",
        "secondary-container": "rgba(255,255,255,0.07)",
        "on-secondary": "#0a0a0f",
        "on-secondary-container": "#e8e8ed",
        "secondary-fixed": "rgba(255,255,255,0.09)",
        "secondary-fixed-dim": "rgba(255,255,255,0.12)",
        "on-secondary-fixed": "#e8e8ed",
        "on-secondary-fixed-variant": "#9999a8",
        tertiary: "#0288d1",
        "tertiary-container": "rgba(2,136,209,0.18)",
        "on-tertiary": "#0a0a0f",
        "on-tertiary-container": "#bfe9ff",
        "tertiary-fixed": "rgba(2,136,209,0.18)",
        "tertiary-fixed-dim": "rgba(2,136,209,0.28)",
        "on-tertiary-fixed": "#bfe9ff",
        "on-tertiary-fixed-variant": "#4fc3f7",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "margin-desktop": "40px",
        "section-gap": "80px",
        "margin-mobile": "16px",
        base: "8px",
        gutter: "24px",
        "container-max": "1280px",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Inter", "sans-serif"],
        body: ["Inter", '"IBM Plex Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "Menlo", "monospace"],
        arabic: ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', "sans-serif"],
        display: ['"Thmanyah Serif Display"', '"IBM Plex Sans Arabic"', "serif"],
      },
      fontSize: {
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "headline-xl": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.05em", fontWeight: "600" }],
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "fade-up": "fadeUp 0.3s ease-out both",
        blink: "blink 1s step-end infinite",
        drift: "drift 18s ease-in-out infinite alternate",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        // Slow parallax-free drift for the ambient glow field
        drift: {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "100%": { transform: "translate3d(0,-2%,0) scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
