import type { Config } from "tailwindcss";

// Tailwind v4 is CSS-first (see app/globals.css @theme). This file only
// scopes content detection; theme tokens live in globals.css.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
};

export default config;
