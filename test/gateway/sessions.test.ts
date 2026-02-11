import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { listGatewaySessionHistory, listGatewaySessions } from "../../src/gateway/sessions";
import { invalidateGatewayConnectionSettingsCache } from "../../src/gateway/settings";

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
    this.readyState = MockWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
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
  runReal: process.env.CLAWOS_REAL_GATEWAY_TEST,
  testUrl: process.env.CLAWOS_TEST_GATEWAY_URL,
  testToken: process.env.CLAWOS_TEST_GATEWAY_TOKEN,
  testOrigin: process.env.CLAWOS_TEST_GATEWAY_ORIGIN,
};

function restoreEnv(key: keyof typeof originalEnv, target: string): void {
  const value = originalEnv[key];
  if (value === undefined) {
    delete process.env[target];
    return;
  }
  process.env[target] = value;
}

describe("gateway sessions (unit)", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    invalidateGatewayConnectionSettingsCache();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    process.env.CLAWOS_GATEWAY_URL = "ws://127.0.0.1:18789";
    process.env.CLAWOS_GATEWAY_TOKEN = "test-token";
    process.env.CLAWOS_GATEWAY_ORIGIN = "http://127.0.0.1:8080";
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    MockWebSocket.reset();
    invalidateGatewayConnectionSettingsCache();
  });

  it("lists sessions and normalizes payload", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({ type: "event", event: "connect.challenge" });
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
              features: { methods: ["sessions.list"] },
            },
          });
          return;
        }

        if (frame.method === "sessions.list") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              sessions: [
                {
                  sessionKey: "s-older",
                  derivedTitle: "旧会话",
                  preview: "older preview",
                  updatedAtMs: 100,
                  status: "active",
                },
                {
                  id: "s-newer",
                  title: "新会话",
                  lastMessage: { text: "newer message" },
                  updatedAtMs: 300,
                  active: false,
                },
              ],
            },
          });
        }
      },
    });

    const sessions = await listGatewaySessions(5000);
    const socket = MockWebSocket.instances[0];
    const sessionReq = socket.sent.find((item) => item.method === "sessions.list");

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
    expect(sessionReq?.params).toEqual({
      limit: 1000,
      includeDerivedTitles: true,
      includeLastMessage: true,
      includeGlobal: true,
      includeUnknown: true,
    });
  });

  it("reads session history and normalizes mixed message shapes", async () => {
    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({ type: "event", event: "connect.challenge" });
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
              features: { methods: ["chat.history"] },
            },
          });
          return;
        }

        if (frame.method === "chat.history") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: {
              history: [
                { id: "m1", role: "user", message: "你好", createdAtMs: 123 },
                { authorRole: "assistant", content: [{ text: "收到" }], updatedAt: "2026-02-10T00:00:00.000Z" },
                "纯文本 fallback",
              ],
            },
          });
        }
      },
    });

    const history = await listGatewaySessionHistory("session-001", 0);
    const socket = MockWebSocket.instances[0];
    const historyReq = socket.sent.find((item) => item.method === "chat.history");

    expect(historyReq?.params).toEqual({
      sessionKey: "session-001",
      limit: 1,
    });

    expect(history.length).toBe(3);
    expect(history[0]).toEqual({ id: "m1", role: "user", text: "你好", ts: 123 });
    expect(history[1]?.role).toBe("assistant");
    expect(history[1]?.text).toContain("收到");
    expect(history[2]).toEqual({ id: "line-3", role: "unknown", text: "纯文本 fallback" });
  });

  it("uses provided gateway token and websocket url when requesting sessions", async () => {
    const providedToken = process.env.CLAWOS_TEST_GATEWAY_TOKEN || "test-token-from-env";
    process.env.CLAWOS_GATEWAY_URL = "ws://127.0.0.1:18789";
    process.env.CLAWOS_GATEWAY_TOKEN = providedToken;
    process.env.CLAWOS_GATEWAY_ORIGIN = "http://127.0.0.1:8080";
    invalidateGatewayConnectionSettingsCache();

    MockWebSocket.setScenario({
      onCreate(ws) {
        queueMicrotask(() => {
          ws.emitOpen();
          ws.emitFrame({ type: "event", event: "connect.challenge" });
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
              features: { methods: ["sessions.list"] },
            },
          });
          return;
        }

        if (frame.method === "sessions.list") {
          ws.emitFrame({
            type: "res",
            id: frame.id,
            ok: true,
            payload: { sessions: [] },
          });
        }
      },
    });

    await listGatewaySessions(10);
    const socket = MockWebSocket.instances[0];
    const connectReq = socket.sent.find((item) => item.method === "connect");
    const connectParams = (connectReq?.params || {}) as Record<string, unknown>;
    const auth = (connectParams.auth || {}) as Record<string, unknown>;

    expect(socket.url).toBe("ws://127.0.0.1:18789");
    expect(auth.token).toBe(providedToken);
  });
});

const runRealGatewayTest = process.env.CLAWOS_REAL_GATEWAY_TEST === "1";
const maybeIt = runRealGatewayTest ? it : it.skip;

describe("gateway sessions (real gateway)", () => {
  afterEach(() => {
    invalidateGatewayConnectionSettingsCache();
    restoreEnv("url", "CLAWOS_GATEWAY_URL");
    restoreEnv("token", "CLAWOS_GATEWAY_TOKEN");
    restoreEnv("origin", "CLAWOS_GATEWAY_ORIGIN");
    restoreEnv("runReal", "CLAWOS_REAL_GATEWAY_TEST");
    restoreEnv("testUrl", "CLAWOS_TEST_GATEWAY_URL");
    restoreEnv("testToken", "CLAWOS_TEST_GATEWAY_TOKEN");
    restoreEnv("testOrigin", "CLAWOS_TEST_GATEWAY_ORIGIN");
  });

  maybeIt("fetches sessions from gateway with provided token/url", async () => {
    const url = process.env.CLAWOS_TEST_GATEWAY_URL || "ws://127.0.0.1:18789";
    const token = process.env.CLAWOS_TEST_GATEWAY_TOKEN || "";
    const origin = process.env.CLAWOS_TEST_GATEWAY_ORIGIN || "http://127.0.0.1:8080";

    if (!token) {
      throw new Error("缺少 CLAWOS_TEST_GATEWAY_TOKEN，无法执行真实网关测试。");
    }

    process.env.CLAWOS_GATEWAY_URL = url;
    process.env.CLAWOS_GATEWAY_TOKEN = token;
    process.env.CLAWOS_GATEWAY_ORIGIN = origin;
    invalidateGatewayConnectionSettingsCache();

    let sessions: Awaited<ReturnType<typeof listGatewaySessions>>;
    try {
      sessions = await listGatewaySessions(100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("secure context")) {
        throw new Error(
          `真实网关拒绝连接（secure context）：请将 gateway 以 HTTPS / localhost 安全上下文方式开放 control UI，并检查 allowedOrigins。原始错误：${message}`
        );
      }
      throw error;
    }

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(typeof sessions[0]?.key).toBe("string");
  });
});
