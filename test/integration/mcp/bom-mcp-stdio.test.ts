import { afterEach, describe, expect, it } from "bun:test";
import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

interface JsonRpcResponse {
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

function createStdioClient(proc: ChildProcessWithoutNullStreams) {
  const pending = new Map<string | number, (response: JsonRpcResponse) => void>();
  let nextId = 1;
  let stdoutBuffer = "";

  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    while (stdoutBuffer.includes("\n")) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      const rawLine = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!rawLine) {
        continue;
      }
      const message = JSON.parse(rawLine) as JsonRpcResponse;
      if (message.id === undefined || message.id === null) {
        continue;
      }
      const resolve = pending.get(message.id);
      if (!resolve) {
        continue;
      }
      pending.delete(message.id);
      resolve(message);
    }
  });

  return {
    async request(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
      const id = nextId++;
      const responsePromise = new Promise<JsonRpcResponse>((resolve) => {
        pending.set(id, resolve);
      });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return await responsePromise;
    },
    notify(method: string, params?: Record<string, unknown>): void {
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
  };
}

const children = new Set<ChildProcessWithoutNullStreams>();

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }
  }
  children.clear();
});

describe("bom-mcp stdio server", () => {
  it("supports initialize, tools/list, and tools/call over stdio", async () => {
    const proc = spawn("bun", ["mcp/bom-mcp/src/index.ts", "serve", "--transport", "stdio"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.add(proc);

    const client = createStdioClient(proc);
    const stderrChunks: string[] = [];
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      stderrChunks.push(chunk);
    });

    const initialize = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "bom-mcp-stdio-test",
        version: "0.0.0",
      },
    });

    expect(initialize.error).toBeUndefined();
    expect((initialize.result as { serverInfo?: { name?: string } } | undefined)?.serverInfo?.name).toBe("bom-mcp");

    client.notify("notifications/initialized");

    const toolsList = await client.request("tools/list");
    expect(toolsList.error).toBeUndefined();
    const tools = ((toolsList.result as { tools?: Array<{ name?: string }> } | undefined)?.tools ?? []).map((tool) => tool.name);
    expect(tools).toContain("quote_customer_message");

    const toolCall = await client.request("tools/call", {
      name: "apply_nl_price_update",
      arguments: {
        partNumber: "stm32f103c8t6",
        unitPrice: 11.8,
        supplier: "LCSC",
      },
    });

    expect(toolCall.error).toBeUndefined();
    const content = (toolCall.result as { content?: Array<{ text?: string }> } | undefined)?.content ?? [];
    expect(content[0]?.text).toContain("STM32F103C8T6");
    expect(content[0]?.text).toContain("11.8");
    expect(stderrChunks.join("").trim()).toBe("");
  }, 15_000);
});
