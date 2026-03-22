import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "webview"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "webview/src"),
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "webview/app.html"),
      output: {
        entryFileNames: "assets/react-app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.includes("style.css")) {
            return "assets/react-app.css";
          }
          return "assets/[name][extname]";
        },
      },
    },
    outDir: path.resolve(__dirname, "webview-dist"),
    emptyOutDir: true,
  },
});
