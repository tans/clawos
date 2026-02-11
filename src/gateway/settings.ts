import { tryReadOpenclawConfigFromWsl } from "../config/openclaw-wsl";
import { asObject, readNonEmptyString, toFiniteNumber } from "../lib/value";
import { readLocalClawosConfig } from "../config/local";
import { DEFAULT_GATEWAY_URL, type GatewayConnectionSettings } from "./schema";

const GATEWAY_SETTINGS_CACHE_TTL_MS = 5000;
let gatewaySettingsCache: { expiresAt: number; value: GatewayConnectionSettings } | null = null;

export function invalidateGatewayConnectionSettingsCache(): void {
  gatewaySettingsCache = null;
}

function normalizeGatewayUrl(rawUrl: string, defaultScheme: "ws" | "wss" = "ws"): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `ws://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("https://")) {
    return `wss://${trimmed.slice("https://".length)}`;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }
  return `${defaultScheme}://${trimmed}`;
}

function normalizeGatewayOrigin(rawOrigin: string): string | undefined {
  const trimmed = rawOrigin.trim();
  if (!trimmed) {
    return undefined;
  }

  const withScheme = (() => {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("ws://")) {
      return `http://${trimmed.slice("ws://".length)}`;
    }
    if (trimmed.startsWith("wss://")) {
      return `https://${trimmed.slice("wss://".length)}`;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
      return trimmed;
    }
    return `http://${trimmed}`;
  })();

  try {
    return new URL(withScheme).origin;
  } catch {
    return undefined;
  }
}

function inferOriginFromGatewayUrl(rawUrl: string): string | undefined {
  try {
    const parsed = new URL(normalizeGatewayUrl(rawUrl));
    if (parsed.protocol === "ws:") {
      return `http://${parsed.host}`;
    }
    if (parsed.protocol === "wss:") {
      return `https://${parsed.host}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function resolveGatewayUrlFromConfig(config: Record<string, unknown>): string | undefined {
  const gateway = asObject(config.gateway);
  if (!gateway) {
    return undefined;
  }

  const mode = readNonEmptyString(gateway.mode)?.toLowerCase();
  const remote = asObject(gateway.remote);
  const remoteUrl = readNonEmptyString(remote?.url);

  if (mode === "remote" && remoteUrl) {
    return normalizeGatewayUrl(remoteUrl);
  }

  const tls = asObject(gateway.tls);
  const tlsEnabled = tls?.enabled === true;
  const scheme: "ws" | "wss" = tlsEnabled ? "wss" : "ws";
  const port = toFiniteNumber(gateway.port);
  if (typeof port === "number" && port > 0) {
    return `${scheme}://127.0.0.1:${Math.floor(port)}`;
  }

  return undefined;
}

function resolveGatewayAuthFromConfig(config: Record<string, unknown>): {
  token?: string;
  password?: string;
} {
  const gateway = asObject(config.gateway);
  const auth = asObject(gateway?.auth);
  const remote = asObject(gateway?.remote);

  const token =
    readNonEmptyString(auth?.token) ||
    readNonEmptyString(remote?.token) ||
    readNonEmptyString(config.gatewayToken);

  const password =
    readNonEmptyString(auth?.password) ||
    readNonEmptyString(remote?.password) ||
    readNonEmptyString(config.gatewayPassword);

  return { token, password };
}

export async function resolveGatewayConnectionSettings(forceRefresh = false): Promise<GatewayConnectionSettings> {
  const now = Date.now();
  if (!forceRefresh && gatewaySettingsCache && gatewaySettingsCache.expiresAt > now) {
    return gatewaySettingsCache.value;
  }

  const resolvedFrom: string[] = [];

  let url =
    readNonEmptyString(process.env.CLAWOS_GATEWAY_URL) ||
    readNonEmptyString(process.env.OPENCLAW_GATEWAY_URL);

  let token =
    readNonEmptyString(process.env.CLAWOS_GATEWAY_TOKEN) ||
    readNonEmptyString(process.env.OPENCLAW_GATEWAY_TOKEN) ||
    readNonEmptyString(process.env.CLAWDBOT_GATEWAY_TOKEN);

  let password =
    readNonEmptyString(process.env.CLAWOS_GATEWAY_PASSWORD) ||
    readNonEmptyString(process.env.OPENCLAW_GATEWAY_PASSWORD) ||
    readNonEmptyString(process.env.CLAWDBOT_GATEWAY_PASSWORD);

  let origin =
    readNonEmptyString(process.env.CLAWOS_GATEWAY_ORIGIN) ||
    readNonEmptyString(process.env.OPENCLAW_GATEWAY_ORIGIN);

  if (url) {
    resolvedFrom.push("env:url");
  }
  if (token) {
    resolvedFrom.push("env:token");
  }
  if (password) {
    resolvedFrom.push("env:password");
  }
  if (origin) {
    resolvedFrom.push("env:origin");
  }

  const localConfig = readLocalClawosConfig();
  const localGateway = asObject(localConfig?.gateway);

  if (!url) {
    const localUrl = readNonEmptyString(localGateway?.url);
    if (localUrl) {
      url = localUrl;
      resolvedFrom.push("local-file:url");
    }
  }
  if (!token) {
    const localToken = readNonEmptyString(localGateway?.token);
    if (localToken) {
      token = localToken;
      resolvedFrom.push("local-file:token");
    }
  }
  if (!password) {
    const localPassword = readNonEmptyString(localGateway?.password);
    if (localPassword) {
      password = localPassword;
      resolvedFrom.push("local-file:password");
    }
  }
  if (!origin) {
    const localOrigin = readNonEmptyString(localGateway?.origin);
    if (localOrigin) {
      origin = localOrigin;
      resolvedFrom.push("local-file:origin");
    }
  }

  if (!url || (!token && !password)) {
    const wslConfig = await tryReadOpenclawConfigFromWsl();
    if (wslConfig) {
      if (!url) {
        const fromConfig = resolveGatewayUrlFromConfig(wslConfig);
        if (fromConfig) {
          url = fromConfig;
          resolvedFrom.push("wsl-config:url");
        }
      }

      if (!token || !password) {
        const authFromConfig = resolveGatewayAuthFromConfig(wslConfig);
        if (!token && authFromConfig.token) {
          token = authFromConfig.token;
          resolvedFrom.push("wsl-config:token");
        }
        if (!password && authFromConfig.password) {
          password = authFromConfig.password;
          resolvedFrom.push("wsl-config:password");
        }
      }
    }
  }

  const normalizedUrl = normalizeGatewayUrl(url || DEFAULT_GATEWAY_URL);
  const normalizedOrigin =
    normalizeGatewayOrigin(origin || "") || inferOriginFromGatewayUrl(normalizedUrl);
  if (!origin && normalizedOrigin) {
    resolvedFrom.push("derived:origin-from-url");
  }

  const value: GatewayConnectionSettings = {
    url: normalizedUrl,
    token,
    password,
    origin: normalizedOrigin,
    resolvedFrom: resolvedFrom.length > 0 ? resolvedFrom : ["default"],
  };

  gatewaySettingsCache = {
    expiresAt: now + GATEWAY_SETTINGS_CACHE_TTL_MS,
    value,
  };

  return value;
}
