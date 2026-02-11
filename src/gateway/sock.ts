import { VERSION } from "../app.constants";
import { asObject, readNonEmptyString } from "../lib/value";
import { resolveGatewayConnectionSettings } from "./settings";
import {
  PROTOCOL_VERSION,
  type GatewayCallResult,
  type GatewayConnectionSettings,
  type GatewayEventFrame,
  type GatewayHelloPayload,
  type GatewayResponseFrame,
} from "./schema";

function formatGatewayError(error: unknown): string {
  const err = asObject(error);
  if (!err) {
    return "未知网关错误";
  }

  const code = readNonEmptyString(err.code);
  const message = readNonEmptyString(err.message) || "未知网关错误";
  return code ? `${code}: ${message}` : message;
}

function formatGatewayClose(code: number, reason: string): string {
  const reasonText = reason.trim() || "no close reason";
  if (code === 1006) {
    return `gateway closed (1006 abnormal closure): ${reasonText}`;
  }
  return `gateway closed (${code}): ${reasonText}`;
}

async function eventDataToText(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof Blob) {
    return await data.text();
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  return String(data);
}

function buildConnectParams(settings: GatewayConnectionSettings): Record<string, unknown> {
  const auth: Record<string, string> = {};
  if (settings.token) {
    auth.token = settings.token;
  }
  if (settings.password) {
    auth.password = settings.password;
  }

  const params: Record<string, unknown> = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: "cli",
      version: VERSION,
      platform: process.platform,
      mode: "cli",
      displayName: "clawos",
      instanceId: `clawos-${Date.now().toString(36)}`,
    },
    role: "operator",
    scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
    locale: "zh-CN",
    userAgent: `clawos/${VERSION}`,
  };

  if (Object.keys(auth).length > 0) {
    params.auth = auth;
  }

  return params;
}

async function callGatewayMethodWithSettings<T>(
  settings: GatewayConnectionSettings,
  method: string,
  params: unknown,
  options: { timeoutMs?: number; expectFinal?: boolean }
): Promise<GatewayCallResult<T>> {
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(1000, Math.floor(options.timeoutMs))
      : 10000;
  const expectFinal = options.expectFinal === true;

  const connectRequestId = `connect-${crypto.randomUUID()}`;
  const methodRequestId = `method-${crypto.randomUUID()}`;

  return await new Promise<GatewayCallResult<T>>((resolve, reject) => {
    let ws: WebSocket;

    try {
      const wsOptions = settings.origin
        ? {
            headers: {
              origin: settings.origin,
            },
          }
        : undefined;
      ws = wsOptions ? new WebSocket(settings.url, wsOptions) : new WebSocket(settings.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reject(new Error(`gateway connect 失败：${message}`));
      return;
    }

    let settled = false;
    let connectSent = false;
    let methodSent = false;
    let hello: GatewayHelloPayload | null = null;
    const events: GatewayEventFrame[] = [];

    const timeoutHandle = setTimeout(() => {
      fail(`gateway timeout after ${timeoutMs}ms`);
    }, timeoutMs);

    let connectDelayHandle: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (connectDelayHandle) {
        clearTimeout(connectDelayHandle);
        connectDelayHandle = null;
      }
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
    };

    const closeSocket = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    const fail = (message: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      closeSocket();
      reject(
        new Error(
          `${message}\nGateway target: ${settings.url}\nGateway origin: ${settings.origin || "<auto/default>"}`
        )
      );
    };

    const done = (payload: T) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      closeSocket();
      if (!hello) {
        reject(new Error("gateway 握手失败：未收到 hello-ok"));
        return;
      }
      resolve({
        payload,
        hello,
        events,
        url: settings.url,
      });
    };

    const sendRequest = (id: string, reqMethod: string, reqParams: unknown) => {
      const frame = {
        type: "req",
        id,
        method: reqMethod,
        params: reqParams,
      };
      ws.send(JSON.stringify(frame));
    };

    const sendConnect = () => {
      if (connectSent) {
        return;
      }
      connectSent = true;
      sendRequest(connectRequestId, "connect", buildConnectParams(settings));
    };

    ws.onopen = () => {
      connectDelayHandle = setTimeout(() => {
        sendConnect();
      }, 600);
    };

    ws.onerror = () => {
      if (!settled && !connectSent) {
        fail("gateway 连接异常");
      }
    };

    ws.onclose = (event) => {
      if (settled) {
        return;
      }
      fail(formatGatewayClose(event.code, event.reason));
    };

    ws.onmessage = (event) => {
      void (async () => {
        try {
          const raw = await eventDataToText(event.data);
          const parsed = JSON.parse(raw) as unknown;
          const frameObj = asObject(parsed);
          if (!frameObj) {
            return;
          }

          const frameType = readNonEmptyString(frameObj.type);

          if (frameType === "event") {
            const eventName = readNonEmptyString(frameObj.event);
            if (!eventName) {
              return;
            }

            const eventFrame: GatewayEventFrame = {
              type: "event",
              event: eventName,
              payload: frameObj.payload,
              seq: typeof frameObj.seq === "number" ? frameObj.seq : undefined,
              stateVersion: frameObj.stateVersion,
            };

            events.push(eventFrame);

            if (eventName === "connect.challenge" && !connectSent) {
              sendConnect();
            }
            return;
          }

          if (frameType !== "res") {
            return;
          }

          const response = frameObj as unknown as GatewayResponseFrame;
          if (typeof response.id !== "string") {
            return;
          }

          if (response.id === connectRequestId) {
            if (!response.ok) {
              fail(`gateway connect 失败：${formatGatewayError(response.error)}`);
              return;
            }

            const payloadObj = asObject(response.payload);
            if (!payloadObj || payloadObj.type !== "hello-ok") {
              fail("gateway 握手失败：connect 返回不是 hello-ok");
              return;
            }

            hello = payloadObj as unknown as GatewayHelloPayload;
            const supportedMethods = Array.isArray(hello.features?.methods)
              ? hello.features?.methods
              : [];
            if (supportedMethods.length > 0 && !supportedMethods.includes(method)) {
              fail(`当前网关不支持方法：${method}`);
              return;
            }

            if (!methodSent) {
              methodSent = true;
              sendRequest(methodRequestId, method, params);
            }
            return;
          }

          if (response.id !== methodRequestId) {
            return;
          }

          if (expectFinal) {
            const payloadObj = asObject(response.payload);
            const status = readNonEmptyString(payloadObj?.status);
            if (status === "accepted") {
              return;
            }
          }

          if (!response.ok) {
            fail(`${method} 调用失败：${formatGatewayError(response.error)}`);
            return;
          }

          done(response.payload as T);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          fail(`gateway 响应解析失败：${message}`);
        }
      })();
    };
  });
}

export async function callGatewayMethod<T = unknown>(
  method: string,
  params: unknown = {},
  options: { timeoutMs?: number; expectFinal?: boolean } = {}
): Promise<GatewayCallResult<T>> {
  const firstSettings = await resolveGatewayConnectionSettings(false);

  try {
    return await callGatewayMethodWithSettings<T>(firstSettings, method, params, options);
  } catch (firstError) {
    const refreshedSettings = await resolveGatewayConnectionSettings(true);
    const changed =
      refreshedSettings.url !== firstSettings.url ||
      refreshedSettings.token !== firstSettings.token ||
      refreshedSettings.password !== firstSettings.password;

    if (!changed) {
      throw firstError;
    }

    return await callGatewayMethodWithSettings<T>(refreshedSettings, method, params, options);
  }
}

export function gatewayTroubleshootingTips(rawMessage: string): string[] {
  const text = rawMessage.toLowerCase();
  const tips: string[] = [];

  if (
    text.includes("unauthorized") ||
    text.includes("token") ||
    text.includes("password") ||
    text.includes("forbidden")
  ) {
    tips.push(
      "网关鉴权失败：请设置 CLAWOS_GATEWAY_TOKEN/CLAWOS_GATEWAY_PASSWORD，或检查 openclaw.json 中 gateway.auth 配置。"
    );
  }
  if (text.includes("econnrefused") || text.includes("gateway closed") || text.includes("1006")) {
    tips.push("网关连接失败：请确认 openclaw gateway 已启动，且 18789 端口可访问。");
  }
  if (text.includes("timeout")) {
    tips.push("网关调用超时：请检查 WSL 负载、网络代理、防火墙设置后重试。");
  }
  if (text.includes("origin not allowed") || text.includes("allowedorigins")) {
    tips.push(
      "网关 Origin 校验未通过：请在 openclaw 配置中设置 gateway.controlUi.allowedOrigins，至少包含 http://127.0.0.1:8080 和 http://localhost:8080。"
    );
    tips.push(
      "可在 clawos 中设置 CLAWOS_GATEWAY_ORIGIN 或 clawos.json 的 gateway.origin，强制 WebSocket 握手使用指定 Origin。"
    );
    tips.push("修改后执行 openclaw gateway restart，再回到 clawos 点击“检查环境”。");
  }
  if (text.includes("invalid request") || text.includes("not supported") || text.includes("not found")) {
    tips.push("方法调用失败：请确认当前 openclaw 版本支持该 Gateway Protocol 方法。");
  }

  return tips;
}
