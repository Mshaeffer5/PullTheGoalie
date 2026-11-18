import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        ink: "#0f172a",
        muted: "#475569",
        line: "#e2e8f0",
        ice: "#f1f5f9",
        brand: { DEFAULT: "#1d4ed8", light: "#dbeafe", dark: "#1e3a8a" },
        pull: { DEFAULT: "#dc2626", light: "#fee2e2" },
      },
    },
  },
  plugins: [],
} satisfies Config;
