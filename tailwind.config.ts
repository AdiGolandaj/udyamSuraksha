import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── shadcn/ui CSS-variable tokens ──────────────────────────────
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Brand ─────────────────────────────────────────────────────
        "brand-primary":         "#1A6B4A",
        "brand-primary-light":   "#E8F5EF",
        "brand-primary-dark":    "#0F4530",
        "brand-secondary":       "#2563EB",
        "brand-secondary-light": "#EFF6FF",

        // ── Status / Semantic ──────────────────────────────────────────
        "status-safe":           "#16A34A",
        "status-safe-bg":        "#F0FDF4",
        "status-moderate":       "#D97706",
        "status-moderate-bg":    "#FFFBEB",
        "status-high":           "#EA580C",
        "status-high-bg":        "#FFF7ED",
        "status-critical":       "#DC2626",
        "status-critical-bg":    "#FEF2F2",
        "status-offline":        "#6B7280",
        "status-offline-bg":     "#F9FAFB",

        // ── Surface ───────────────────────────────────────────────────
        "surface-primary":       "#FFFFFF",
        "surface-secondary":     "#F8FAFC",
        "surface-tertiary":      "#F1F5F9",
        "border-default":        "#E2E8F0",
        "border-strong":         "#CBD5E1",

        // ── Text ──────────────────────────────────────────────────────
        "text-primary":          "#0F172A",
        "text-secondary":        "#475569",
        "text-tertiary":         "#94A3B8",
        "text-inverse":          "#FFFFFF",

        // ── Disaster Sensitivity Tags (Stock module) ───────────────────
        "sensitivity-water-bg":    "#EFF6FF",
        "sensitivity-water-text":  "#1D4ED8",
        "sensitivity-heat-bg":     "#FFF7ED",
        "sensitivity-heat-text":   "#C2410C",
        "sensitivity-fragile-bg":  "#FDF4FF",
        "sensitivity-fragile-text":"#7E22CE",
        "sensitivity-perishable-bg":  "#F0FDF4",
        "sensitivity-perishable-text": "#15803D",
        "sensitivity-flammable-bg":   "#FEF2F2",
        "sensitivity-flammable-text":  "#B91C1C",
        "sensitivity-theft-bg":    "#FEFCE8",
        "sensitivity-theft-text":  "#A16207",
        "sensitivity-humidity-bg":  "#F0F9FF",
        "sensitivity-humidity-text": "#0369A1",
      },

      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        marathi: ["Noto Sans Devanagari", "sans-serif"],
      },

      fontSize: {
        display:    ["30px", { fontWeight: "700", lineHeight: "1.2" }],
        h1:         ["24px", { fontWeight: "600", lineHeight: "1.3" }],
        h2:         ["20px", { fontWeight: "600", lineHeight: "1.35" }],
        h3:         ["16px", { fontWeight: "600", lineHeight: "1.4" }],
        "body-lg":  ["16px", { fontWeight: "400", lineHeight: "1.6" }],
        body:       ["14px", { fontWeight: "400", lineHeight: "1.6" }],
        "body-sm":  ["13px", { fontWeight: "400", lineHeight: "1.5" }],
        caption:    ["12px", { fontWeight: "400", lineHeight: "1.4" }],
        label:      ["12px", { fontWeight: "500", lineHeight: "1.2" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
