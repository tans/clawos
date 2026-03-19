/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        board: {
          50: "#f8fafc",
          900: "#0f172a"
        },
        accent: {
          500: "#0ea5e9",
          600: "#0284c7"
        }
      }
    }
  }
};
