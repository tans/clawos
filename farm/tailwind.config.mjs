import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,ts,tsx}",
    "./src/views/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["silk", "light", "dark"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};
