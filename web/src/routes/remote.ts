import { Hono } from "hono";
import {
  listMcpReleaseVersions,
  listMcpReleases,
  listPublishedMcpShelf,
  listPublishedProducts,
  normalizeReleaseChannel,
  readLatestRelease,
} from "../lib/storage";
import { executeMcpPanelAction } from "../lib/mcp-panel";

export const remoteRoutes = new Hono();

type RemoteExecutor = "shell" | "powershell" | "wsl";

type RemoteIntent =
  | "release.latest"
  | "mcp.list"
  | "mcp.versions"
  | "mcp.shelf"
  | "products.list"
  | "mcp.panel.action";

type RemotePlanStep = {
  id: string;
  title: string;
  executor: RemoteExecutor;
  op: "release.latest" | "mcp.list" | "mcp.versions" | "mcp.shelf" | "products.list" | "mcp.panel.action";
  args: Record<string, unknown>;
};

type RemotePlan = {
  version: "1.0";
  actionIntent: RemoteIntent;
  constraints: {
    allowedExecutors: RemoteExecutor[];
  };
  steps: RemotePlanStep[];
};

const ALLOWED_EXECUTORS: RemoteExecutor[] = ["shell", "powershell", "wsl"];

function parseIntent(value: unknown): RemoteIntent {
  const text = typeof value === "string" ? value.trim() : "";
  const allowed: RemoteIntent[] = [
    "release.latest",
    "mcp.list",
    "mcp.versions",
    "mcp.shelf",
    "products.list",
    "mcp.panel.action",
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

function buildPlan(actionIntent: RemoteIntent, payload: Record<string, unknown>): RemotePlan {
  const constraints = { allowedExecutors: ALLOWED_EXECUTORS };

  if (actionIntent === "release.latest") {
    return {
      version: "1.0",
      actionIntent,
      constraints,
      steps: [{ id: "release-latest", title: "读取最新发布", executor: "wsl", op: "release.latest", args: { channel: payload.channel } }],
    };
  }

  if (actionIntent === "mcp.list") {
    return {
      version: "1.0",
      actionIntent,
      constraints,
      steps: [{ id: "mcp-list", title: "读取 MCP 列表", executor: "wsl", op: "mcp.list", args: { channel: payload.channel } }],
    };
  }

  if (actionIntent === "mcp.versions") {
    return {
      version: "1.0",
      actionIntent,
      constraints,
      steps: [
        {
          id: "mcp-versions",
          title: "读取 MCP 版本历史",
          executor: "wsl",
          op: "mcp.versions",
          args: { mcpId: payload.mcpId, channel: payload.channel },
        },
      ],
    };
  }

  if (actionIntent === "mcp.shelf") {
    return {
      version: "1.0",
      actionIntent,
      constraints,
      steps: [{ id: "mcp-shelf", title: "读取 MCP 上架列表", executor: "wsl", op: "mcp.shelf", args: { channel: payload.channel } }],
    };
  }

  if (actionIntent === "products.list") {
    return {
      version: "1.0",
      actionIntent,
      constraints,
      steps: [{ id: "products-list", title: "读取商品列表", executor: "wsl", op: "products.list", args: {} }],
    };
  }

  return {
    version: "1.0",
    actionIntent,
    constraints,
    steps: [
      {
        id: "mcp-panel-action",
        title: "执行 MCP Panel 动作",
        executor: "powershell",
        op: "mcp.panel.action",
        args: {
          mcpId: payload.mcpId,
          actionId: payload.actionId,
          payload: payload.payload,
        },
      },
    ],
  };
}

function readChannel(raw: unknown): "stable" | "beta" | "alpha" {
  return normalizeReleaseChannel(typeof raw === "string" ? raw : undefined) || "stable";
}

function readNonEmpty(raw: unknown, field: string): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

async function executePlan(plan: RemotePlan): Promise<Array<{ stepId: string; ok: boolean; data?: unknown; error?: string }>> {
  const results: Array<{ stepId: string; ok: boolean; data?: unknown; error?: string }> = [];

  for (const step of plan.steps) {
    try {
      if (step.op === "release.latest") {
        const latest = await readLatestRelease(readChannel(step.args.channel));
        results.push({ stepId: step.id, ok: true, data: latest || null });
        continue;
      }

      if (step.op === "mcp.list") {
        const items = await listMcpReleases(readChannel(step.args.channel));
        results.push({ stepId: step.id, ok: true, data: items });
        continue;
      }

      if (step.op === "mcp.versions") {
        const mcpId = readNonEmpty(step.args.mcpId, "mcpId");
        const versions = await listMcpReleaseVersions(mcpId, readChannel(step.args.channel));
        results.push({ stepId: step.id, ok: true, data: versions });
        continue;
      }

      if (step.op === "mcp.shelf") {
        const items = await listPublishedMcpShelf(readChannel(step.args.channel));
        results.push({ stepId: step.id, ok: true, data: items });
        continue;
      }

      if (step.op === "products.list") {
        const items = await listPublishedProducts();
        results.push({ stepId: step.id, ok: true, data: items });
        continue;
      }

      const mcpId = readNonEmpty(step.args.mcpId, "mcpId");
      const actionId = readNonEmpty(step.args.actionId, "actionId");
      const ret = await executeMcpPanelAction({
        mcpId,
        actionId,
        payload: step.args.payload,
      });
      results.push({ stepId: step.id, ok: ret.ok, data: ret.ok ? ret : undefined, error: ret.ok ? undefined : ret.error });
    } catch (error) {
      results.push({
        stepId: step.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

function buildCatalog() {
  return {
    executors: ALLOWED_EXECUTORS,
    actions: [
      { actionIntent: "release.latest", title: "查询最新发布", payloadSchema: { channel: "stable|beta|alpha" } },
      { actionIntent: "mcp.list", title: "查询 MCP 列表", payloadSchema: { channel: "stable|beta|alpha" } },
      { actionIntent: "mcp.versions", title: "查询 MCP 版本", payloadSchema: { mcpId: "string", channel: "stable|beta|alpha" } },
      { actionIntent: "mcp.shelf", title: "查询 MCP 上架列表", payloadSchema: { channel: "stable|beta|alpha" } },
      { actionIntent: "products.list", title: "查询商品列表", payloadSchema: {} },
      { actionIntent: "mcp.panel.action", title: "执行 MCP Panel 动作", payloadSchema: { mcpId: "string", actionId: "string", payload: "object" } },
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
    const dryRun = body?.dryRun === true;
    const plan = buildPlan(actionIntent, payload);

    if (dryRun) {
      return c.json({ ok: true, mode: "dry-run", plan, results: [] });
    }

    const results = await executePlan(plan);
    const success = results.every((item) => item.ok);
    return c.json({ ok: success, mode: "execute", plan, results }, success ? 200 : 400);
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : "dispatch failed" }, 400);
  }
});
