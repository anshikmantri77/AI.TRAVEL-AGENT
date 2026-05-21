/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "oklch(14% 0.025 255)",
          2: "oklch(18% 0.03 250)",
          3: "oklch(24% 0.035 245)",
        },
        ink: {
          DEFAULT: "oklch(95% 0.01 260)",
          2: "oklch(78% 0.02 260)",
          mute: "oklch(55% 0.03 260)",
        },
        accent: {
          DEFAULT: "oklch(78% 0.18 70)",
          2: "oklch(68% 0.14 70)",
          mute: "oklch(38% 0.09 70)",
        },
        focus: "oklch(68% 0.2 230)",
        rule: "oklch(30% 0.03 250)",
        hairline: "oklch(22% 0.025 250)",
      },
      fontFamily: {
        display: ['"DM Serif Display"', "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
      spacing: {
        "2xs": "4px",
      },
      animation: {
        "ticker-scroll": "ticker-scroll 30s linear infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
      keyframes: {
        "ticker-scroll": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
