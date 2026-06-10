/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background:       "#0a0a12",
        "surface-1":      "#12121e",
        "surface-2":      "#16162a",
        border:           "#2a2a3e",
        primary:          "hsl(262 83% 58%)",
        "primary-muted":  "hsl(262 83% 20%)",
        foreground:       "hsl(0 0% 95%)",
        "muted-foreground": "hsl(240 5% 55%)",
        subtle:           "hsl(240 5% 63%)",
        destructive:      "hsl(0 62% 50%)",
        success:          "hsl(142 71% 45%)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem", md: "0.5rem", lg: "0.625rem",
        xl: "0.75rem", "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
