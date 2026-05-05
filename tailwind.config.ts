import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem", lg: "2.5rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Brand — committed palette
        royal: {
          50:  "#EEF2FF",
          100: "#DCE3FF",
          200: "#B8C7FF",
          300: "#8BA3FF",
          400: "#5C7BFF",
          500: "#3354FF",
          600: "#1F3EE6",  // primary royal
          700: "#1631B5",
          800: "#11268C",
          900: "#0C1C66",
          950: "#070F3D",
        },
        ember: {
          50:  "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#DC2626",  // primary CTA red
          600: "#B91C1C",
          700: "#991B1B",
        },
        cream: {
          DEFAULT: "#F7F2E7",
          50: "#FDFBF6",
          100: "#F7F2E7",
          200: "#EFE6CF",
        },
        ink: { DEFAULT: "#0A0A0A", soft: "#1B1B1B", muted: "#3D3D3D" },
        // shadcn semantic tokens (mapped onto brand)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 6px)",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(10,10,10,1), 0 8px 0 -2px rgba(10,10,10,1)",
        "card-sm": "0 1px 0 0 rgba(10,10,10,1), 0 5px 0 -2px rgba(10,10,10,1)",
        cta: "0 1px 0 0 rgba(10,10,10,1), 0 6px 0 -1px rgba(10,10,10,1)",
        inset: "inset 0 0 0 2px rgba(10,10,10,1)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "tilt": {
          "0%, 100%": { transform: "rotate(-1deg)" },
          "50%": { transform: "rotate(1deg)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.7s cubic-bezier(.2,.8,.2,1) both",
        "tilt": "tilt 6s ease-in-out infinite",
      },
      backgroundImage: {
        "grain":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [animate],
};

export default config;
