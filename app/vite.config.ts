import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(appDir, "webview"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(appDir, "webview/src"),
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(appDir, "webview/app.html"),
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
    outDir: path.resolve(appDir, "webview-dist"),
    emptyOutDir: true,
  },
});
