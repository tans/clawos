import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

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
let stdioStateDir: string | undefined;

afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit").catch(() => undefined);
    }
  }
  children.clear();
  if (stdioStateDir) {
    await rm(stdioStateDir, { recursive: true, force: true });
    stdioStateDir = undefined;
  }
});

describe("bom-mcp stdio server", () => {
  it("supports initialize, tools/list, and tools/call over stdio", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "bom-mcp-stdio-"));
    const stateDir = resolve(rootDir, "state");
    const exportDir = resolve(rootDir, "exports");
    const cacheDir = resolve(rootDir, "cache");
    const dbPath = resolve(stateDir, "bom-mcp.sqlite");
    stdioStateDir = rootDir;
    await mkdir(stateDir, { recursive: true });
    await mkdir(exportDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    const db = new Database(dbPath, { create: true });
    db.exec("CREATE TABLE IF NOT EXISTS doctor_probe (id INTEGER PRIMARY KEY);");
    db.close();

    const previousPublicBaseUrl = process.env.BOM_MCP_PUBLIC_BASE_URL;
    delete process.env.BOM_MCP_PUBLIC_BASE_URL;
    try {
      const proc = spawn("bun", ["mcp/bom-mcp/src/index.ts", "serve", "--transport", "stdio"], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          BOM_MCP_STATE_DIR: stateDir,
          BOM_MCP_EXPORT_DIR: exportDir,
          BOM_MCP_CACHE_DIR: cacheDir,
          BOM_MCP_DB_PATH: dbPath,
        },
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
      expect(tools).toContain("doctor");

      const doctorCall = await client.request("tools/call", {
        name: "doctor",
        arguments: {},
      });
      expect(doctorCall.error).toBeUndefined();
      const doctorContent = (doctorCall.result as { content?: Array<{ text?: string }> } | undefined)?.content ?? [];
      const doctorText = doctorContent[0]?.text ?? "{}";
      const doctorResult = JSON.parse(doctorText) as { ok?: boolean; warnings?: string[] };
      expect(doctorResult.ok).toBe(true);
      expect(doctorResult.warnings?.some((item) => item.includes("publicBaseUrl"))).toBe(true);

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
    } finally {
      if (previousPublicBaseUrl === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = previousPublicBaseUrl;
      }
    }
  }, 15_000);
});
