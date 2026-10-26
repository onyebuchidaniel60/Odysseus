import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
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
        mockup: {
          bg: "#050505",
          panel: "#0A0A0A",
          raised: "#0F0F0F",
          line: "#1B1B1B",
          "line-strong": "#2A2A2A",
          text: "#F4F4F5",
          muted: "#8B8B8F",
          dim: "#5C5C61",
          amber: "#F5A623",
          "amber-soft": "#FFC857",
          green: "#2ED47A",
          red: "#FF4D6D",
          lime: "#D7F25C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
        mockup: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        "mockup-mono": [
          "var(--font-ibm-plex-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        panel: "0 24px 80px -40px rgba(0, 0, 0, 0.9)",
        accent: "0 0 28px -6px rgba(79, 140, 255, 0.45)",
        "mockup-glow": "0 0 42px -16px rgba(245, 166, 35, 0.55)",
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
