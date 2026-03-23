import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

type PanelViewBlock =
  | { type: "key_value"; source: string }
  | { type: "markdown"; source: "static"; content: string }
  | { type: "table"; source: string; columns: Array<{ key: string; label: string }> }
  | {
      type: "form";
      submitAction: string;
      fields: Array<{
        name: string;
        label: string;
        component: "input" | "number" | "select" | "switch" | "textarea" | "json_editor";
        required?: boolean;
        default?: unknown;
        rules?: Array<{ type: "url" | "min" | "max" | "regex"; value?: number | string }>;
      }>;
    };

export type McpPanelSchema = {
  apiVersion: "clawos/v1";
  kind: "MCPPanel";
  metadata: {
    name: string;
    title: string;
    icon?: string;
    category?: string;
    order?: number;
    tags?: string[];
  };
  spec: {
    visibility: {
      enabled: boolean;
      environments: Array<"dev" | "staging" | "prod">;
    };
    status: {
      source: "health_endpoint" | "runtime_registry" | "static";
      endpoint?: string;
      fields: Array<{ key: string; label: string; type: "text" | "badge" | "datetime" | "number" | "boolean" }>;
    };
    views: Array<{
      id: string;
      title: string;
      blocks: PanelViewBlock[];
    }>;
    actions: Array<{
      id: string;
      label: string;
      type: "lifecycle" | "config" | "observe" | "custom";
      executor: "mcp_runtime.start" | "mcp_runtime.stop" | "mcp_runtime.reload" | "mcp_config.update" | "mcp_observe.healthcheck";
      confirm?: boolean;
      payloadSchemaRef?: string;
    }>;
    components?: {
      schemas?: Record<string, unknown>;
    };
  };
};

type McpManifest = {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
};

type PanelListItem = {
  id: string;
  title: string;
  icon: string;
  category: string;
  order: number;
  tags: string[];
  version: string;
  status: "ready" | "unknown";
  source: "lowcode" | "manifest-fallback";
};

type ActionExecutionResult =
  | { ok: true; traceId: string; result: Record<string, unknown> }
  | {
      ok: false;
      code:
        | "MCP_PANEL_NOT_FOUND"
        | "MCP_ACTION_NOT_FOUND"
        | "MCP_ACTION_PAYLOAD_INVALID";
      error: string;
      details?: string[];
    };

const PHASE1_PANEL_MAP: Record<string, McpPanelSchema> = {
  "crm-mcp": {
    apiVersion: "clawos/v1",
    kind: "MCPPanel",
    metadata: {
      name: "crm-mcp",
      title: "CRM Connector",
      icon: "plug",
      category: "business",
      order: 20,
      tags: ["crm", "production"],
    },
    spec: {
      visibility: {
        enabled: true,
        environments: ["dev", "staging", "prod"],
      },
      status: {
        source: "health_endpoint",
        endpoint: "/internal/mcp/crm/health",
        fields: [
          { key: "status", label: "运行状态", type: "badge" },
          { key: "version", label: "版本", type: "text" },
          { key: "lastHeartbeatAt", label: "最近心跳", type: "datetime" },
        ],
      },
      views: [
        {
          id: "overview",
          title: "概览",
          blocks: [
            { type: "key_value", source: "status" },
            {
              type: "markdown",
              source: "static",
              content: "CRM MCP 提供客户查询、线索更新、商机同步能力。",
            },
          ],
        },
        {
          id: "config",
          title: "配置",
          blocks: [
            {
              type: "form",
              submitAction: "update_config",
              fields: [
                {
                  name: "baseUrl",
                  label: "CRM 地址",
                  component: "input",
                  required: true,
                  rules: [{ type: "url" }],
                },
                {
                  name: "timeoutMs",
                  label: "超时时间(ms)",
                  component: "number",
                  default: 5000,
                  rules: [
                    { type: "min", value: 100 },
                    { type: "max", value: 30000 },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "logs",
          title: "日志",
          blocks: [
            {
              type: "table",
              source: "recent_logs",
              columns: [
                { key: "timestamp", label: "时间" },
                { key: "level", label: "级别" },
                { key: "message", label: "消息" },
              ],
            },
          ],
        },
      ],
      actions: [
        {
          id: "start",
          label: "启动",
          type: "lifecycle",
          executor: "mcp_runtime.start",
          confirm: true,
        },
        {
          id: "stop",
          label: "停止",
          type: "lifecycle",
          executor: "mcp_runtime.stop",
          confirm: true,
        },
        {
          id: "reload",
          label: "重载配置",
          type: "lifecycle",
          executor: "mcp_runtime.reload",
        },
        {
          id: "update_config",
          label: "保存配置",
          type: "config",
          executor: "mcp_config.update",
          payloadSchemaRef: "#/components/schemas/ConfigUpdate",
        },
        {
          id: "healthcheck",
          label: "健康检查",
          type: "observe",
          executor: "mcp_observe.healthcheck",
        },
      ],
      components: {
        schemas: {
          ConfigUpdate: {
            type: "object",
            properties: {
              baseUrl: { type: "string", format: "uri" },
              timeoutMs: { type: "integer", minimum: 100, maximum: 30000 },
            },
            required: ["baseUrl"],
          },
        },
      },
    },
  },
};

function findRepoRoot(): string {
  const cwd = process.cwd();
  if (cwd.endsWith("/web") || cwd.endsWith("\\web")) {
    return resolve(cwd, "..");
  }
  return cwd;
}

async function readManifestMcpList(): Promise<McpManifest[]> {
  const root = findRepoRoot();
  const mcpDir = resolve(root, "mcp");
  const entries = await readdir(mcpDir, { withFileTypes: true });
  const manifests = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const path = resolve(mcpDir, entry.name, "manifest.json");
        const file = Bun.file(path);
        if (!(await file.exists())) return null;
        const manifest = (await file.json()) as McpManifest;
        if (!manifest?.id) return null;
        return manifest;
      }),
  );

  return manifests.filter((item): item is McpManifest => item !== null);
}

async function readLowCodePanelFromFile(mcpId: string): Promise<McpPanelSchema | null> {
  const root = findRepoRoot();
  const path = resolve(root, "mcp", mcpId, "lowcode.config.json");
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return (await file.json()) as McpPanelSchema;
}

function toFallbackPanel(manifest: McpManifest): McpPanelSchema {
  return {
    apiVersion: "clawos/v1",
    kind: "MCPPanel",
    metadata: {
      name: manifest.id,
      title: manifest.displayName || manifest.name || manifest.id,
      icon: "box",
      category: "default",
      order: 999,
      tags: ["fallback"],
    },
    spec: {
      visibility: {
        enabled: true,
        environments: ["dev", "staging", "prod"],
      },
      status: {
        source: "static",
        fields: [
          { key: "status", label: "运行状态", type: "badge" },
          { key: "version", label: "版本", type: "text" },
          { key: "description", label: "描述", type: "text" },
        ],
      },
      views: [
        {
          id: "overview",
          title: "概览",
          blocks: [{ type: "key_value", source: "status" }],
        },
      ],
      actions: [],
    },
  };
}

export async function listMcpPanels(): Promise<PanelListItem[]> {
  const manifests = await readManifestMcpList();
  const items = await Promise.all(manifests.map(async (manifest) => {
    const filePanel = await readLowCodePanelFromFile(manifest.id);
    const mapPanel = PHASE1_PANEL_MAP[manifest.id];
    const panel = filePanel || mapPanel || toFallbackPanel(manifest);
    const source: "lowcode" | "manifest-fallback" = filePanel || mapPanel ? "lowcode" : "manifest-fallback";
    return {
      id: manifest.id,
      title: panel.metadata.title,
      icon: panel.metadata.icon || "box",
      category: panel.metadata.category || "default",
      order: panel.metadata.order ?? 999,
      tags: panel.metadata.tags || [],
      version: manifest.version || "unknown",
      status: "ready" as const,
      source,
    };
  }));

  return items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export async function readMcpPanelSchema(mcpId: string): Promise<McpPanelSchema | null> {
  const manifests = await readManifestMcpList();
  const manifest = manifests.find((item) => item.id === mcpId);
  if (!manifest) return null;
  return (await readLowCodePanelFromFile(mcpId)) || PHASE1_PANEL_MAP[mcpId] || toFallbackPanel(manifest);
}

export async function readMcpPanelData(mcpId: string): Promise<Record<string, unknown> | null> {
  const manifests = await readManifestMcpList();
  const manifest = manifests.find((item) => item.id === mcpId);
  if (!manifest) return null;

  const now = new Date().toISOString();
  return {
    status: {
      status: "unknown",
      version: manifest.version || "unknown",
      description: manifest.description || "",
      lastHeartbeatAt: now,
    },
    recent_logs: [],
  };
}

type ActionExecutorContext = {
  mcpId: string;
  actionId: string;
  payload: Record<string, unknown>;
  traceId: string;
  executor: string;
};

type ActionExecutor = (ctx: ActionExecutorContext) => Promise<Record<string, unknown>>;

const BUILTIN_EXECUTORS: Record<string, ActionExecutor> = {
  "mcp_runtime.start": async (ctx) => ({
    state: "started",
    message: `MCP ${ctx.mcpId} 已启动（phase-2 mock）`,
  }),
  "mcp_runtime.stop": async (ctx) => ({
    state: "stopped",
    message: `MCP ${ctx.mcpId} 已停止（phase-2 mock）`,
  }),
  "mcp_runtime.reload": async (ctx) => ({
    state: "reloaded",
    message: `MCP ${ctx.mcpId} 已重载配置（phase-2 mock）`,
  }),
  "mcp_config.update": async (ctx) => ({
    state: "updated",
    message: `MCP ${ctx.mcpId} 配置更新成功（phase-2 mock）`,
    payload: ctx.payload,
  }),
  "mcp_observe.healthcheck": async (ctx) => ({
    state: "healthy",
    checkedAt: new Date().toISOString(),
    message: `MCP ${ctx.mcpId} 健康检查成功（phase-2 mock）`,
  }),
};

const genericExecutor: ActionExecutor = async (ctx) => ({
  state: "accepted",
  message: `已接收动作 ${ctx.executor}（phase-2 generic mock）`,
  payload: ctx.payload,
});

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function validatePayloadByComponentSchema(payload: unknown, schema: unknown): string[] {
  if (!isRecord(schema)) return [];
  if (!isRecord(payload)) return ["payload 必须是 object"];

  const errors: string[] = [];
  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  for (const key of required) {
    if (typeof key === "string" && !(key in payload)) {
      errors.push(`缺少必填字段: ${key}`);
    }
  }

  for (const [field, value] of Object.entries(payload)) {
    const fieldSchema = properties[field];
    if (!isRecord(fieldSchema)) continue;

    const expectedType = fieldSchema.type;
    if (expectedType === "string" && typeof value !== "string") {
      errors.push(`${field} 必须是 string`);
      continue;
    }
    if (expectedType === "integer" && (!Number.isInteger(value) || typeof value !== "number")) {
      errors.push(`${field} 必须是 integer`);
      continue;
    }

    if (fieldSchema.format === "uri" && typeof value === "string") {
      try {
        new URL(value);
      } catch {
        errors.push(`${field} 必须是合法 URI`);
      }
    }

    if (typeof value === "number") {
      if (typeof fieldSchema.minimum === "number" && value < fieldSchema.minimum) {
        errors.push(`${field} 必须 >= ${fieldSchema.minimum}`);
      }
      if (typeof fieldSchema.maximum === "number" && value > fieldSchema.maximum) {
        errors.push(`${field} 必须 <= ${fieldSchema.maximum}`);
      }
    }
  }

  return errors;
}

export async function executeMcpPanelAction(params: {
  mcpId: string;
  actionId: string;
  payload?: unknown;
}): Promise<ActionExecutionResult> {
  const schema = await readMcpPanelSchema(params.mcpId);
  if (!schema) {
    return { ok: false, code: "MCP_PANEL_NOT_FOUND", error: "MCP Panel 不存在" };
  }

  const action = schema.spec.actions.find((item) => item.id === params.actionId);
  if (!action) {
    return { ok: false, code: "MCP_ACTION_NOT_FOUND", error: "动作不存在" };
  }

  const payload = isRecord(params.payload) ? params.payload : {};
  if (action.payloadSchemaRef) {
    const schemaName = action.payloadSchemaRef.replace("#/components/schemas/", "");
    const componentSchema = schema.spec.components?.schemas?.[schemaName];
    const payloadErrors = validatePayloadByComponentSchema(payload, componentSchema);
    if (payloadErrors.length > 0) {
      return {
        ok: false,
        code: "MCP_ACTION_PAYLOAD_INVALID",
        error: "动作参数校验失败",
        details: payloadErrors,
      };
    }
  }

  const executor = BUILTIN_EXECUTORS[action.executor] || genericExecutor;

  const traceId = crypto.randomUUID();
  const result = await executor({
    mcpId: params.mcpId,
    actionId: params.actionId,
    payload,
    traceId,
    executor: action.executor,
  });

  console.log("[mcp-panel.action]", {
    traceId,
    mcpId: params.mcpId,
    actionId: params.actionId,
    executor: action.executor,
    payloadKeys: Object.keys(payload),
    result,
  });

  return { ok: true, traceId, result };
}
