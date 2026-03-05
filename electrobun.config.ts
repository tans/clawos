import type { ElectrobunConfig } from "electrobun";
import packageJson from "./package.json";

const appVersion =
  packageJson && typeof packageJson === "object" && "version" in packageJson
    ? String((packageJson as { version?: unknown }).version || "0.1.0")
    : "0.1.0";

const ciRaw = String(process.env.CI ?? "").trim().toLowerCase();
const isCi = ciRaw === "1" || ciRaw === "true";
const winIconFlag = String(process.env.CLAWOS_WIN_ICON ?? "").trim().toLowerCase();
const useWindowsIcon = winIconFlag ? winIconFlag !== "0" && winIconFlag !== "false" : !isCi;

const config: ElectrobunConfig = {
  app: {
    name: "ClawOS",
    identifier: "cc.clawos.desktop",
    version: appVersion,
    description: "ClawOS desktop shell powered by Electrobun",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      clawos: {
        entrypoint: "src/desktop-ui/bridge.ts",
        format: "iife",
      },
    },
    copy: {
      "src/desktop-ui/shell.html": "views/clawos/shell.html",
      "src/pages/sidebar-update.js": "views/clawos/sidebar-update.js",
      "dist/output.css": "views/clawos/styles.css",
    },
    watch: ["src", "dist"],
    watchIgnore: [
      "build/**",
      "artifacts/**",
      "node_modules/**",
      "**/*.log",
      "**/.DS_Store",
      "**\\build\\**",
      "**\\artifacts\\**",
      "**\\node_modules\\**",
      "**\\*.log",
    ],
    win: useWindowsIcon ? { icon: "web/public/logo.ico" } : {},
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
};

export default config;
