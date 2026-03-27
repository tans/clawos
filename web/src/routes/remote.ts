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

type AppInstruction = {
  id: string;
  title: string;
  executor: RemoteExecutor;
  runOn: "app";
  type: "api-call" | "ui-command";
  request?: {
    method: "GET" | "POST" | "PUT" | "PATCH";
    path: string;
    body?: Record<string, unknown>;
  };
  command?: "open-log-center";
};

type RemotePlan = {
  version: "1.0";
  actionIntent: RemoteIntent;
  purpose: "return-instructions-for-app";
  constraints: {
    allowedExecutors: RemoteExecutor[];
  };
  instructions: AppInstruction[];
};

const ALLOWED_EXECUTORS: RemoteExecutor[] = ["shell", "powershell", "wsl"];

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

function buildPlan(actionIntent: RemoteIntent, payload: Record<string, unknown>, envSnapshot: Record<string, unknown>): RemotePlan {
  const constraints = { allowedExecutors: ALLOWED_EXECUTORS };

  if (actionIntent === "gateway.restart") {
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "gateway-restart",
          title: "重启 openclaw",
          executor: "powershell",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/gateway/action",
            body: { action: "restart" },
          },
        },
      ],
    };
  }

  if (actionIntent === "gateway.restart_qw") {
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "gateway-restart-qw",
          title: "重启企微网关",
          executor: "powershell",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/gateway/action",
            body: { action: "restart-qw-gateway" },
          },
        },
      ],
    };
  }

  if (actionIntent === "gateway.update") {
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "gateway-update",
          title: "升级 openclaw",
          executor: "wsl",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/gateway/update",
            body: {},
          },
        },
      ],
    };
  }

  if (actionIntent === "browser.detect" || actionIntent === "browser.repair" || actionIntent === "browser.open_cdp") {
    const action =
      actionIntent === "browser.open_cdp" ? "open-cdp" : actionIntent === "browser.repair" ? "repair" : "detect";

    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "browser-action",
          title: `浏览器动作: ${action}`,
          executor: "powershell",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/browser/action",
            body: action === "detect" ? { action } : { action, confirmed: true },
          },
        },
      ],
    };
  }

  if (actionIntent === "environment.install") {
    const target = readText(payload.target, "wsl");
    const tool = readText(payload.tool, "python");

    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "environment-install",
          title: `环境安装 ${target}/${tool}`,
          executor: target === "windows" ? "powershell" : "wsl",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/environment/install",
            body: { target, tool },
          },
        },
      ],
    };
  }

  if (actionIntent === "mcp.build") {
    const name = readText(payload.name, "windows-mcp");
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "mcp-build",
          title: `构建 MCP ${name}`,
          executor: "wsl",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/mcp/build",
            body: { name },
          },
        },
      ],
    };
  }

  if (actionIntent === "app.upgrade") {
    const autoRestart = envSnapshot.autoRestart !== false;
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "app-upgrade",
          title: "升级桌面客户端",
          executor: "shell",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/app/update/run",
            body: { trigger: "manual", autoRestart },
          },
        },
      ],
    };
  }

  if (actionIntent === "app.restart") {
    return {
      version: "1.0",
      actionIntent,
      purpose: "return-instructions-for-app",
      constraints,
      instructions: [
        {
          id: "app-restart",
          title: "重启 openclaw",
          executor: "shell",
          runOn: "app",
          type: "api-call",
          request: {
            method: "POST",
            path: "/api/gateway/action",
            body: { action: "restart" },
          },
        },
      ],
    };
  }

  return {
    version: "1.0",
    actionIntent,
    purpose: "return-instructions-for-app",
    constraints,
    instructions: [
      {
        id: "open-log-center",
        title: "打开日志中心",
        executor: "shell",
        runOn: "app",
        type: "ui-command",
        command: "open-log-center",
      },
    ],
  };
}

function buildCatalog() {
  return {
    executors: ALLOWED_EXECUTORS,
    purpose: "return-instructions-for-app",
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
    const plan = buildPlan(actionIntent, payload, envSnapshot);

    return c.json({
      ok: true,
      mode: "plan-only",
      executeOn: "app",
      plan,
    });
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : "dispatch failed" }, 400);
  }
});
