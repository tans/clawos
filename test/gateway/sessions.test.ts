import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listGatewaySessionHistory, listGatewaySessions } from "../../src/gateway/sessions";

let tempDir = "";
let logPath = "";
let fakeOpenclawPath = "";
let originalExecMode = "";
let originalOpenclawBin = "";

function installFakeOpenclaw(): void {
  tempDir = mkdtempSync(path.join(os.tmpdir(), "clawos-openclaw-cli-test-"));
  logPath = path.join(tempDir, "openclaw-args.log");
  fakeOpenclawPath = path.join(tempDir, "openclaw");

  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");
if (args[0] === "gateway" && args[1] === "call" && args[2] === "sessions.list") {
  process.stdout.write(JSON.stringify({
    payload: {
      sessions: [
        {
          sessionKey: "s-older",
          derivedTitle: "旧会话",
          preview: "older preview",
          updatedAtMs: 100,
          status: "active"
        },
        {
          id: "s-newer",
          title: "新会话",
          lastMessage: { text: "newer message" },
          updatedAtMs: 300,
          active: false
        }
      ]
    }
  }) + "\\n");
  process.exit(0);
}
if (args[0] === "gateway" && args[1] === "call" && args[2] === "chat.history") {
  process.stdout.write(JSON.stringify({
    payload: {
      history: [
        { id: "m1", role: "user", message: "你好", createdAtMs: 123 },
        { authorRole: "assistant", content: [{ text: "收到" }], updatedAt: "2026-02-10T00:00:00.000Z" },
        "纯文本 fallback"
      ]
    }
  }) + "\\n");
  process.exit(0);
}
process.stderr.write("unexpected args: " + JSON.stringify(args));
process.exit(2);
`;

  writeFileSync(fakeOpenclawPath, script, "utf-8");
  chmodSync(fakeOpenclawPath, 0o755);
}

function readLoggedCommands(): string[][] {
  const raw = readFileSync(logPath, "utf-8");
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as string[]);
}

function readLoggedParams(commands: string[][], method: string): Record<string, unknown> {
  const command = commands.find((args) => args[0] === "gateway" && args[1] === "call" && args[2] === method);
  if (!command) {
    return {};
  }
  const paramsIndex = command.indexOf("--params");
  if (paramsIndex < 0 || !command[paramsIndex + 1]) {
    return {};
  }
  return JSON.parse(command[paramsIndex + 1]) as Record<string, unknown>;
}

describe("gateway sessions (cli)", () => {
  beforeEach(() => {
    installFakeOpenclaw();
    originalExecMode = process.env.CLAWOS_OPENCLAW_EXEC_MODE || "";
    originalOpenclawBin = process.env.CLAWOS_OPENCLAW_BIN || "";
    process.env.CLAWOS_OPENCLAW_BIN = fakeOpenclawPath;
    process.env.CLAWOS_OPENCLAW_EXEC_MODE = "direct";
  });

  afterEach(() => {
    if (originalExecMode) {
      process.env.CLAWOS_OPENCLAW_EXEC_MODE = originalExecMode;
    } else {
      delete process.env.CLAWOS_OPENCLAW_EXEC_MODE;
    }
    if (originalOpenclawBin) {
      process.env.CLAWOS_OPENCLAW_BIN = originalOpenclawBin;
    } else {
      delete process.env.CLAWOS_OPENCLAW_BIN;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = "";
    logPath = "";
  });

  it("lists sessions and normalizes payload", async () => {
    const sessions = await listGatewaySessions(5000);
    const commands = readLoggedCommands();
    const params = readLoggedParams(commands, "sessions.list");

    expect(sessions).toEqual([
      {
        key: "s-newer",
        title: "新会话",
        updatedAtMs: 300,
        active: false,
        lastMessage: "newer message",
      },
      {
        key: "s-older",
        title: "旧会话",
        updatedAtMs: 100,
        active: true,
        lastMessage: "older preview",
      },
    ]);
    expect(params).toEqual({
      limit: 1000,
      includeDerivedTitles: true,
      includeLastMessage: true,
      includeGlobal: true,
      includeUnknown: true,
    });
  });

  it("reads session history and normalizes mixed message shapes", async () => {
    const history = await listGatewaySessionHistory("session-001", 0);
    const commands = readLoggedCommands();
    const params = readLoggedParams(commands, "chat.history");

    expect(params).toEqual({
      sessionKey: "session-001",
      limit: 1,
    });

    expect(history.length).toBe(3);
    expect(history[0]).toEqual({ id: "m1", role: "user", text: "你好", ts: 123 });
    expect(history[1]?.role).toBe("assistant");
    expect(history[1]?.text).toContain("收到");
    expect(history[2]).toEqual({ id: "line-3", role: "unknown", text: "纯文本 fallback" });
  });
});
