import { createInterface } from "node:readline";
import { TOOL_DEFINITIONS, isToolName, type ToolName } from "./tool-spec";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcError {
  code: number;
  message: string;
}

type ToolExecutor = (request: { tool: ToolName; args: Record<string, unknown> }) => Promise<unknown>;

function writeMessage(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResponse(id: string | number | null, result: Record<string, unknown>): void {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function writeError(id: string | number | null, error: JsonRpcError): void {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error,
  });
}

function parseRequest(line: string): JsonRpcRequest {
  return JSON.parse(line) as JsonRpcRequest;
}

export async function serveStdio(executeTool: ToolExecutor): Promise<void> {
  const reader = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let request: JsonRpcRequest;
    try {
      request = parseRequest(line);
    } catch {
      writeError(null, {
        code: -32700,
        message: "Parse error",
      });
      continue;
    }

    const id = request.id ?? null;
    const method = String(request.method || "");
    const params = request.params && typeof request.params === "object" ? request.params : {};

    if (!method) {
      writeError(id, {
        code: -32600,
        message: "Invalid Request",
      });
      continue;
    }

    if (method === "notifications/initialized") {
      continue;
    }

    if (method === "initialize") {
      writeResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "bom-mcp",
          version: "0.1.3",
        },
      });
      continue;
    }

    if (method === "tools/list") {
      writeResponse(id, {
        tools: TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
      continue;
    }

    if (method === "tools/call") {
      const toolName = String(params.name || "");
      const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
      if (!isToolName(toolName)) {
        writeError(id, {
          code: -32602,
          message: `Unknown tool: ${toolName}`,
        });
        continue;
      }

      try {
        const result = await executeTool({
          tool: toolName,
          args: args as Record<string, unknown>,
        });
        writeResponse(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        });
      } catch (error) {
        writeResponse(id, {
          content: [
            {
              type: "text",
              text: (error as Error).message,
            },
          ],
          isError: true,
        });
      }
      continue;
    }

    writeError(id, {
      code: -32601,
      message: `Method not found: ${method}`,
    });
  }
}
