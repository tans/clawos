import { Hono } from "hono";

export const remoteRoutes = new Hono();

type RemoteExecutor = "shell" | "powershell" | "wsl";

type RemoteIntent =
  | "gateway.restart"
  | "gateway.restart_qw"
  | "gateway.update"
  | "browser.detect"
  | "browser.repair"
  | "browser.open_cdp"
  | "environment.install"
  | "mcp.build"
  | "app.upgrade"
  | "app.restart"
  | "app.log_center.open";

const ALLOWED_EXECUTORS: RemoteExecutor[] = ["shell", "powershell", "wsl"];
const OPENCLAW_SOURCE_DIR = "/data/openclaw";

function parseIntent(value: unknown): RemoteIntent {
  const text = typeof value === "string" ? value.trim() : "";
  const allowed: RemoteIntent[] = [
    "gateway.restart",
    "gateway.restart_qw",
    "gateway.update",
    "browser.detect",
    "browser.repair",
    "browser.open_cdp",
    "environment.install",
    "mcp.build",
    "app.upgrade",
    "app.restart",
    "app.log_center.open",
  ];
  if (!allowed.includes(text as RemoteIntent)) {
    throw new Error(`unsupported actionIntent: ${text || "<empty>"}`);
  }
  return text as RemoteIntent;
}

function parsePayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function readEnvSnapshot(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildGatewayUpdateActions(): string[] {
  return [
    `cd ${OPENCLAW_SOURCE_DIR}`,
    `cd ${OPENCLAW_SOURCE_DIR} && git fetch origin main --prune && git reset --hard origin/main && git clean -fd`,
    `cd ${OPENCLAW_SOURCE_DIR} && npm i -g nrm`,
    `cd ${OPENCLAW_SOURCE_DIR} && nrm use tencent`,
    `cd ${OPENCLAW_SOURCE_DIR} && pnpm install`,
    `cd ${OPENCLAW_SOURCE_DIR} && pnpm run build`,
    `cd ${OPENCLAW_SOURCE_DIR} && pnpm run ui:build`,
    `cd ${OPENCLAW_SOURCE_DIR} && pnpm link --global`,
    `cd ${OPENCLAW_SOURCE_DIR} && openclaw gateway restart`,
  ];
}

function buildActions(
  actionIntent: RemoteIntent,
  payload: Record<string, unknown>,
  envSnapshot: Record<string, unknown>
): string[] {
  if (actionIntent === "gateway.update") {
    return buildGatewayUpdateActions();
  }
  if (actionIntent === "gateway.restart") {
    return ['POST /api/gateway/action {"action":"restart"}'];
  }
  if (actionIntent === "gateway.restart_qw") {
    return ['POST /api/gateway/action {"action":"restart-qw-gateway"}'];
  }
  if (actionIntent === "browser.detect") {
    return ['POST /api/browser/action {"action":"detect"}'];
  }
  if (actionIntent === "browser.repair") {
    return ['POST /api/browser/action {"action":"repair","confirmed":true}'];
  }
  if (actionIntent === "browser.open_cdp") {
    return ['POST /api/browser/action {"action":"open-cdp","confirmed":true}'];
  }
  if (actionIntent === "environment.install") {
    const target = readText(payload.target, "wsl");
    const tool = readText(payload.tool, "python");
    return [`POST /api/environment/install ${JSON.stringify({ target, tool })}`];
  }
  if (actionIntent === "mcp.build") {
    const name = readText(payload.name, "windows-mcp");
    return [`POST /api/mcp/build ${JSON.stringify({ name })}`];
  }
  if (actionIntent === "app.upgrade") {
    const autoRestart = envSnapshot.autoRestart !== false;
    return [`POST /api/app/update/run ${JSON.stringify({ trigger: "manual", autoRestart })}`];
  }
  if (actionIntent === "app.restart") {
    return ['POST /api/gateway/action {"action":"restart"}'];
  }
  return ["UI open-log-center"];
}

function buildCatalog() {
  return {
    executors: ALLOWED_EXECUTORS,
    purpose: "return-actions-for-app",
    actions: [
      { actionIntent: "gateway.restart", title: "重启 openclaw", payloadSchema: {} },
      { actionIntent: "gateway.restart_qw", title: "重启企微网关", payloadSchema: {} },
      { actionIntent: "gateway.update", title: "升级 openclaw", payloadSchema: {} },
      { actionIntent: "browser.detect", title: "浏览器检测", payloadSchema: {} },
      { actionIntent: "browser.repair", title: "浏览器修复", payloadSchema: {} },
      { actionIntent: "browser.open_cdp", title: "打开浏览器 CDP", payloadSchema: {} },
      { actionIntent: "environment.install", title: "环境安装", payloadSchema: { target: "windows|wsl", tool: "python|uv|bun" } },
      { actionIntent: "mcp.build", title: "构建 MCP", payloadSchema: { name: "windows-mcp|yingdao-mcp|wechat-mcp|crm-mcp" } },
      { actionIntent: "app.upgrade", title: "桌面升级", payloadSchema: { autoRestart: "boolean" } },
      { actionIntent: "app.restart", title: "桌面重启", payloadSchema: {} },
      { actionIntent: "app.log_center.open", title: "打开日志中心", payloadSchema: {} },
    ],
  };
}

remoteRoutes.get("/api/remote/catalog", (c) => {
  return c.json({ ok: true, ...buildCatalog() });
});

remoteRoutes.post("/api/remote/dispatch", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const actionIntent = parseIntent(body?.actionIntent);
    const payload = parsePayload(body?.payload);
    const envSnapshot = readEnvSnapshot(body?.envSnapshot);
    const actions = buildActions(actionIntent, payload, envSnapshot);

    return c.json({
      ok: true,
      executeOn: "app",
      purpose: "return-actions-for-app",
      actionIntent,
      allowedExecutors: ALLOWED_EXECUTORS,
      ACTIONS: actions,
    });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : "dispatch failed" }, 400);
  }
});
