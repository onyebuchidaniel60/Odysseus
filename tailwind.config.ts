import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0E17",
        surface: "#131A2A",
        foreground: "#E6EDF7",
        muted: "#8B98B8",
        accent: "#4F8CFF",
        success: "#2ED47A",
        danger: "#FF5C5C",
        warning: "#F5A623",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 24px 80px -40px rgba(0, 0, 0, 0.9)",
        accent: "0 0 28px -6px rgba(79, 140, 255, 0.45)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to right, rgba(139, 152, 184, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(139, 152, 184, 0.06) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
