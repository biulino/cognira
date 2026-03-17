/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#2D6BEE",
          dark: "#1A52CC",
          light: "#5589F5",
          faint: "#F0F5FF",
          faint2: "#EAF0FE",
        },
        primary: {
          50: "#F0F5FF",
          100: "#DCE8FC",
          200: "#BACCF9",
          300: "#8AADF4",
          400: "#5589F5",
          500: "#2D6BEE",
          600: "#1A52CC",
          700: "#143DA8",
          800: "#0F2D82",
          900: "#0A1F5C",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
