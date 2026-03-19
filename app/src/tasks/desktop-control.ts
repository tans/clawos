import { VERSION } from "../app.constants";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import { startBrowserRestartTask } from "./browser";

export const DESKTOP_MCP_HOST = "0.0.0.0";
export const DESKTOP_MCP_PORT = 8100;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type DesktopMcpStatus = {
  running: boolean;
  host: string;
  port: number;
  url: string;
  taskId: string | null;
  taskStatus: string | null;
};

let desktopMcpServer: Bun.Server | null = null;
let desktopMcpTask: Task | null = null;

function buildJsonRpcResponse(id: JsonRpcId, result: unknown): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function buildJsonRpcError(id: JsonRpcId, code: number, message: string): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, accept");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    })
  );
}

function textResponse(text: string, status = 200): Response {
  return withCors(
    new Response(text, {
      status,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    })
  );
}

function readRemoteAddress(server: Bun.Server, req: Request): string {
  try {
    const remote = server.requestIP(req);
    if (!remote) {
      return "unknown";
    }
    return `${remote.address}:${remote.port}`;
  } catch {
    return "unknown";
  }
}

function parseJsonRpcPayload(raw: string): JsonRpcRequest[] | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is JsonRpcRequest => Boolean(item) && typeof item === "object");
  }

  if (parsed && typeof parsed === "object") {
    return [parsed as JsonRpcRequest];
  }

  return null;
}

function readTaskId(task: Task | null): string | null {
  return task?.id || null;
}

export function getDesktopMcpStatus(): DesktopMcpStatus {
  return {
    running: desktopMcpServer !== null,
    host: DESKTOP_MCP_HOST,
    port: DESKTOP_MCP_PORT,
    url: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`,
    taskId: readTaskId(desktopMcpTask),
    taskStatus: desktopMcpTask?.status || null,
  };
}

async function callDesktopTool(name: string, args: Record<string, unknown>, task: Task): Promise<unknown> {
  void args;

  if (name === "open_browser_cdp") {
    appendTaskLog(task, "MCP tool call: open_browser_cdp");
    const started = startBrowserRestartTask();
    return {
      ok: true,
      taskId: started.task.id,
      reused: started.reused,
      message: "浏览器 CDP 任务已提交。",
    };
  }

  if (name === "get_desktop_mcp_status") {
    appendTaskLog(task, "MCP tool call: get_desktop_mcp_status");
    return {
      ok: true,
      status: getDesktopMcpStatus(),
    };
  }

  appendTaskLog(task, `MCP tool call failed: unknown tool ${name}`, "error");
  throw new Error(`未知工具：${name}`);
}

async function handleJsonRpcRequest(
  request: JsonRpcRequest,
  task: Task,
  remote: string
): Promise<Record<string, unknown> | null> {
  const id = request.id ?? null;
  const method = typeof request.method === "string" ? request.method.trim() : "";
  const params =
    request.params && typeof request.params === "object" && !Array.isArray(request.params)
      ? (request.params as Record<string, unknown>)
      : {};

  if (!method) {
    appendTaskLog(task, `MCP request from ${remote}: invalid method`, "error");
    return buildJsonRpcError(id, -32600, "Invalid Request");
  }

  appendTaskLog(task, `MCP request from ${remote}: ${method}`);

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "ping") {
    return buildJsonRpcResponse(id, { pong: true });
  }

  if (method === "initialize") {
    return buildJsonRpcResponse(id, {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "clawos-desktop-control",
        version: VERSION,
      },
      instructions: "Use tools/list to inspect desktop tools, then tools/call to invoke them.",
    });
  }

  if (method === "tools/list") {
    return buildJsonRpcResponse(id, {
      tools: [
        {
          name: "open_browser_cdp",
          description: "启动桌面端浏览器 CDP 任务。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_desktop_mcp_status",
          description: "读取桌面控制 MCP 服务状态。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
      ],
    });
  }

  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name.trim() : "";
    const toolArgs =
      params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (!toolName) {
      appendTaskLog(task, `MCP tools/call from ${remote}: missing tool name`, "error");
      return buildJsonRpcError(id, -32602, "Missing tool name");
    }

    try {
      const result = await callDesktopTool(toolName, toolArgs, task);
      return buildJsonRpcResponse(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTaskLog(task, `MCP tools/call from ${remote} failed: ${toolName} (${message})`, "error");
      return buildJsonRpcError(id, -32000, message || "Tool call failed");
    }
  }

  appendTaskLog(task, `MCP request from ${remote}: unsupported method ${method}`, "error");
  return buildJsonRpcError(id, -32601, `Method not found: ${method}`);
}

function buildDesktopMcpTask(): Task {
  const task = createTask("desktop-mcp-server", "桌面控制 MCP", 1);
  task.status = "running";
  task.step = 1;
  appendTaskLog(task, `MCP server listening on http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`);
  appendTaskLog(task, "等待 MCP 客户端连接...");
  return task;
}

export function startDesktopMcpServerTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("desktop-mcp-server");
  if (desktopMcpServer && runningTask) {
    appendTaskLog(runningTask, "MCP server is already running. Reusing existing server.");
    desktopMcpTask = runningTask;
    return { task: runningTask, reused: true };
  }

  const task = buildDesktopMcpTask();

  try {
    const server = Bun.serve({
      hostname: DESKTOP_MCP_HOST,
      port: DESKTOP_MCP_PORT,
      fetch: async (req, serverRef) => {
        const url = new URL(req.url);
        const remote = readRemoteAddress(serverRef, req);

        if (req.method === "OPTIONS") {
          return withCors(new Response(null, { status: 204 }));
        }

        if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
          appendTaskLog(task, `MCP health check from ${remote}`);
          return jsonResponse({
            ok: true,
            name: "clawos-desktop-control",
            version: VERSION,
            transport: "streamable-http",
            mcpUrl: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`,
          });
        }

        if (req.method === "POST" && (url.pathname === "/" || url.pathname === "/mcp")) {
          const rawBody = await req.text();
          const payloads = parseJsonRpcPayload(rawBody);
          if (!payloads || payloads.length === 0) {
            appendTaskLog(task, `MCP request from ${remote}: invalid JSON body`, "error");
            return jsonResponse(buildJsonRpcError(null, -32700, "Parse error"), 400);
          }

          const responses = (
            await Promise.all(payloads.map((item) => handleJsonRpcRequest(item, task, remote)))
          ).filter((item): item is Record<string, unknown> => item !== null);

          if (responses.length === 0) {
            return withCors(new Response(null, { status: 202 }));
          }

          return jsonResponse(payloads.length === 1 ? responses[0] : responses);
        }

        appendTaskLog(task, `MCP request from ${remote}: unsupported route ${req.method} ${url.pathname}`, "error");
        return textResponse("Not Found", 404);
      },
      error(error) {
        const message = error instanceof Error ? error.message : String(error);
        if (desktopMcpTask) {
          appendTaskLog(desktopMcpTask, `MCP server error: ${message}`, "error");
        }
        return textResponse("Internal Server Error", 500);
      },
    });

    desktopMcpServer = server;
    desktopMcpTask = task;
    return { task, reused: false };
  } catch (error) {
    task.status = "failed";
    task.endedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    task.error = message;
    appendTaskLog(task, message, "error");
    desktopMcpTask = task;
    throw error;
  }
}
