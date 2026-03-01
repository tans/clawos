import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { callGatewayMethod, gatewayTroubleshootingTips } from "../../src/gateway/sock";
import { invalidateGatewayConnectionSettingsCache } from "../../src/gateway/settings";
import { asObject, readNonEmptyString } from "../../src/lib/value";

type RequestFrame = {
  type: "req";
  id: string;
  method: string;
  params: unknown;
};

type Scenario = {
  onCreate?: (ws: MockWebSocket) => void;
  onSend?: (ws: MockWebSocket, frame: RequestFrame) => void;
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static scenario: Scenario | null = null;
  static instances: MockWebSocket[] = [];

  static setScenario(scenario: Scenario): void {
    MockWebSocket.scenario = scenario;
  }

  static reset(): void {
    MockWebSocket.scenario = null;
    MockWebSocket.instances = [];
  }

  readonly url: string;
  readonly options?: { headers?: Record<string, string> };
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: RequestFrame[] = [];
  closeCalls = 0;

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    this.url = url;
    this.options = options;
    MockWebSocket.instances.push(this);
    MockWebSocket.scenario?.onCreate?.(this);
  }

  send(raw: string): void {
    const parsed = JSON.parse(raw) as RequestFrame;
    this.sent.push(parsed);
    MockWebSocket.scenario?.onSend?.(this, parsed);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = MockWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  emitError(): void {
    this.onerror?.({} as Event);
  }

  emitClose(code: number, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  emitFrame(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }
}

const originalWebSocket = globalThis.WebSocket;
const originalEnv = {
  url: process.env.CLAWOS_GATEWAY_URL,
  token: process.env.CLAWOS_GATEWAY_TOKEN,
  origin: process.env.CLAWOS_GATEWAY_ORIGIN,
  deviceToken: process.env.CLAWOS_GATEWAY_DEVICE_TOKEN,
  statePath: process.env.CLAWOS_GATEWAY_STATE_PATH,
};
let testGatewayStatePath = "";

beforeEach(() => {
  MockWebSocket.reset();
  invalidateGatewayConnectionSettingsCache();
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  process.env.CLAWOS_GATEWAY_URL = "ws://127.0.0.1:18789";
  process.env.CLAWOS_GATEWAY_TOKEN = "test-token";
  process.env.CLAWOS_GATEWAY_ORIGIN = "http://127.0.0.1:8080";
  delete process.env.CLAWOS_GATEWAY_DEVICE_TOKEN;
  testGatewayStatePath = `/tmp/clawos-gateway-state-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.json`;
  process.env.CLAWOS_GATEWAY_STATE_PATH = testGatewayStatePath;
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  MockWebSocket.reset();
  invalidateGatewayConnectionSettingsCache();
  if (testGatewayStatePath) {
    rmSync(testGatewayStatePath, { force: true });
    rmSync(`${testGatewayStatePath}.tmp`, { force: true });
    testGatewayStatePath = "";
  }

  if (originalEnv.url === undefined) {
    delete process.env.CLAWOS_GATEWAY_URL;
  } else {
    process.env.CLAWOS_GATEWAY_URL = originalEnv.url;
  }

  if (originalEnv.token === undefined) {
    delete process.env.CLAWOS_GATEWAY_TOKEN;
  } else {
    process.env.CLAWOS_GATEWAY_TOKEN = originalEnv.token;
  }

  if (originalEnv.origin === undefined) {
    delete process.env.CLAWOS_GATEWAY_ORIGIN;
  } else {
    process.env.CLAWOS_GATEWAY_ORIGIN = originalEnv.origin;
  }

  if (originalEnv.deviceToken === undefined) {
    delete process.env.CLAWOS_GATEWAY_DEVICE_TOKEN;
  } else {
    process.env.CLAWOS_GATEWAY_DEVICE_TOKEN = originalEnv.deviceToken;
  }

  if (originalEnv.statePath === undefined) {
    delete process.env.CLAWOS_GATEWAY_STATE_PATH;
  } else {
    process.env.CLAWOS_GATEWAY_STATE_PATH = originalEnv.statePath;
  }
});

describe("gateway socket", () => {
  it("calls method successfully after connect.challenge", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-1" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              server: { version: "1.0.0" },
              features: { methods: ["status"] },
            },
          });
          return;
        }

        if (frame.method === "status") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { ok: true, service: "gateway" },
          });
        }
      },
    });

    const result = await callGatewayMethod("status", { probe: false }, { timeoutMs: 2000 });
    const socket = MockWebSocket.instances[0];

    expect(result.payload).toEqual({ ok: true, service: "gateway" });
    expect(result.events.map((item) => item.event)).toEqual(["connect.challenge"]);
    expect(result.hello.server?.version).toBe("1.0.0");
    expect(socket.sent.map((item) => item.method)).toEqual(["connect", "status"]);
    expect(socket.options?.headers?.origin).toBe("http://127.0.0.1:8080");
    const connectReq = socket.sent.find((item) => item.method === "connect");
    const connectParams = (connectReq?.params || {}) as Record<string, unknown>;
    const client = (connectParams.client || {}) as Record<string, unknown>;
    const scopes = Array.isArray(connectParams.scopes) ? connectParams.scopes : [];
    const device = asObject(connectParams.device);
    expect(client.id).toBe("cli");
    expect(client.mode).toBe("cli");
    expect(scopes).toContain("operator.read");
    expect(scopes).toContain("operator.write");
    expect(readNonEmptyString(device?.id)).toBeTruthy();
    expect(readNonEmptyString(device?.publicKey)).toBeTruthy();
    expect(readNonEmptyString(device?.signature)).toBeTruthy();
    expect(device?.nonce).toBe("nonce-1");
  });

  it("fails when socket emits error before connect", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => ws.emitError());
      },
    });

    await expect(callGatewayMethod("status", {}, { timeoutMs: 2000 })).rejects.toThrow(/gateway 连接异常/);
    const socket = MockWebSocket.instances[0];
    expect(socket.closeCalls).toBeGreaterThanOrEqual(1);
  });

  it("fails with abnormal closure 1006", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitClose(1006, "abnormal closure");
        });
      },
    });

    await expect(callGatewayMethod("status", {}, { timeoutMs: 2000 })).rejects.toThrow(
      /gateway closed \(1006 abnormal closure\): abnormal closure/
    );
  });

  it("fails when connect response is not hello-ok", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-2" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { type: "welcome" },
          });
        }
      },
    });

    await expect(callGatewayMethod("status", {}, { timeoutMs: 2000 })).rejects.toThrow(
      /gateway 握手失败：connect 返回不是 hello-ok/
    );
  });

  it("fails when method is unsupported by gateway", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-3" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              features: { methods: ["health"] },
            },
          });
        }
      },
    });

    await expect(callGatewayMethod("status", {}, { timeoutMs: 2000 })).rejects.toThrow(
      /当前网关不支持方法：status/
    );
  });

  it("waits for final response when expectFinal is true", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-4" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              features: { methods: ["update.run"] },
            },
          });
          return;
        }

        if (frame.method === "update.run") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { status: "accepted" },
          });
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { status: "done", mode: "inline" },
          });
        }
      },
    });

    const result = await callGatewayMethod("update.run", {}, { timeoutMs: 2000, expectFinal: true });
    expect(result.payload).toEqual({ status: "done", mode: "inline" });
  });

  it("normalizes ws origin to http origin header", async () => {
    process.env.CLAWOS_GATEWAY_ORIGIN = "ws://localhost:8080";

    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-5" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              features: { methods: ["status"] },
            },
          });
          return;
        }

        if (frame.method === "status") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { ok: true },
          });
        }
      },
    });

    await callGatewayMethod("status", {}, { timeoutMs: 2000 });
    const socket = MockWebSocket.instances[0];
    expect(socket.options?.headers?.origin).toBe("http://localhost:8080");
  });

  it("persists deviceToken from hello and reuses it on next connect", async () => {
    const connectAuths: Array<Record<string, unknown> | null> = [];

    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "nonce-token" },
          });
        });
      },
      onSend(ws, frame) {
        if (frame.method === "connect") {
          const params = asObject(frame.params);
          connectAuths.push(asObject(params?.auth));
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              type: "hello-ok",
              protocol: 3,
              auth: connectAuths.length === 1 ? { deviceToken: "device-token-1" } : {},
              features: { methods: ["status"] },
            },
          });
          return;
        }

        if (frame.method === "status") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { ok: true },
          });
        }
      },
    });

    await callGatewayMethod("status", {}, { timeoutMs: 2000 });
    await callGatewayMethod("status", {}, { timeoutMs: 2000 });

    expect(connectAuths.length).toBe(2);
    expect(connectAuths[0]?.deviceToken).toBeUndefined();
    expect(connectAuths[1]?.deviceToken).toBe("device-token-1");
  });
});

describe("gatewayTroubleshootingTips", () => {
  it("returns origin-specific hints for origin validation failures", () => {
    const tips = gatewayTroubleshootingTips("Origin not allowed by allowedOrigins policy");

    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.join("\n")).toContain("allowedOrigins");
    expect(tips.join("\n")).toContain("CLAWOS_GATEWAY_ORIGIN");
  });

  it("returns pairing hints for NOT_PAIRED errors", () => {
    const tips = gatewayTroubleshootingTips("gateway connect failed: NOT_PAIRED: pairing required");

    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.join("\n")).toContain("自动尝试执行设备批准");
    expect(tips.join("\n")).toContain("openclaw 命令可用");
  });
});
