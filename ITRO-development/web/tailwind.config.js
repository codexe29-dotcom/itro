/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Enterprise design tokens — TEAL primary, with ORANGE as the CTA accent.
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        // Accent hues. `orange` is the primary CTA/highlight; cyan supports the teal.
        accent: {
          orange: "#F97316",
          cyan: "#06B6D4",
          violet: "#7C3AED",
          amber: "#F59E0B",
        },
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          muted: "#64748b",
          faint: "#94a3b8",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f8fafc",
          muted: "#f1f5f9",
          border: "#e2e8f0",
        },
        // Teal-forward status colours; warning/danger stay neutral slate.
        success: { DEFAULT: "#0d9488", soft: "#f0fdfa" },
        warning: { DEFAULT: "#475569", soft: "#f1f5f9" },
        danger: { DEFAULT: "#334155", soft: "#e2e8f0" },
        info: { DEFAULT: "#0d9488", soft: "#f0fdfa" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        pop: "0 10px 30px -10px rgb(15 23 42 / 0.15)",
        focus: "0 0 0 3px rgb(99 102 241 / 0.25)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
      keyframes: {
        "fade-in": { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
