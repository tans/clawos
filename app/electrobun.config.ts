import type { ElectrobunConfig } from "electrobun";
import { existsSync, readFileSync } from "node:fs";
import packageJson from "./package.json";

const appVersion =
  packageJson && typeof packageJson === "object" && "version" in packageJson
    ? String((packageJson as { version?: unknown }).version || "0.1.0")
    : "0.1.0";

const ciRaw = String(process.env.CI ?? "").trim().toLowerCase();
const isCi = ciRaw === "1" || ciRaw === "true";
const winIconFlag = String(process.env.CLAWOS_WIN_ICON ?? "").trim().toLowerCase();
const useWindowsIcon = winIconFlag ? winIconFlag !== "0" && winIconFlag !== "false" : !isCi;
const windowsIcoPath = "../web/public/logo.ico";
const windowsPngPath = "../web/public/logo.png";

function isValidIcoFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath);
    if (content.length < 6) {
      return false;
    }
    const reserved = content.readUInt16LE(0);
    const imageType = content.readUInt16LE(2);
    const imageCount = content.readUInt16LE(4);
    return reserved === 0 && imageType === 1 && imageCount > 0;
  } catch {
    return false;
  }
}

function resolveWindowsIconPath(): string | null {
  if (isValidIcoFile(windowsIcoPath)) {
    return windowsIcoPath;
  }
  if (existsSync(windowsPngPath)) {
    return windowsPngPath;
  }
  return null;
}

const resolvedWindowsIconPath = resolveWindowsIconPath();

function resolveReleaseBaseUrl(): string {
  const fromEnv =
    process.env.CLAWOS_RELEASE_BASE_URL?.trim() || process.env.CLAWOS_UPDATER_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  const publishBase = process.env.CLAWOS_PUBLISH_BASE_URL?.trim().replace(/\/+$/, "");
  if (publishBase) {
    return `${publishBase}/updates`;
  }

  return "https://clawos.minapp.xin/updates";
}

const releaseBaseUrl = resolveReleaseBaseUrl();

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
      "src/pages/pages-shell.css": "views/clawos/pages-shell.css",
      "../web/public/logo.png": "views/clawos/logo.png",
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
    win: useWindowsIcon && resolvedWindowsIconPath ? { icon: resolvedWindowsIconPath } : {},
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  release: {
    baseUrl: releaseBaseUrl,
  },
};

export default config;
