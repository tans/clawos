import react from "@vitejs/plugin-react";
import type { InlineConfig } from "vitest/node";
import { defineConfig } from "vite";

const config = {
  plugins: [react()],
  server: {
    port: 5186,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/vitest.setup.ts",
  } satisfies InlineConfig,
};

export default defineConfig(config);
