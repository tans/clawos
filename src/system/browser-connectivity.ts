import { callGatewayMethodViaCli } from "../openclaw/gateway-cli";
import { openclawCliTroubleshootingTips } from "../openclaw/cli";
import { asObject, readNonEmptyString } from "../lib/value";
import { runWslScript } from "../tasks/shell";
import { BROWSER_CDP_PORT } from "../tasks/browser";

type GatewayProbe =
  | {
      ok: true;
      payload: unknown;
    }
  | {
      ok: false;
      error: string;
      tips: string[];
    };

type BrowserMode = "cdp" | "local";
type BrowserConnectivityStatus =
  | "ok"
  | "disabled"
  | "not-configured"
  | "gateway-error"
  | "probe-error"
  | "local-only"
  | "cdp-only";

type HttpProbe =
  | {
      ok: true;
      url: string;
      status: number;
      payload: unknown;
    }
  | {
      ok: false;
      url: string;
      error: string;
    };

type WslProbe =
  | {
      ok: true;
      url: string;
      command: string;
    }
  | {
      ok: false;
      url: string;
      command: string;
      error: string;
    };

type CdpProbeClassification = {
  status: BrowserConnectivityStatus;
  ready: boolean;
};

async function safeGatewayProbe(method: string, params: unknown, timeoutMs = 10000): Promise<GatewayProbe> {
  void timeoutMs;
  try {
    const result = await callGatewayMethodViaCli(method, params);
    return {
      ok: true,
      payload: result.payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
      tips: openclawCliTroubleshootingTips(message),
    };
  }
}

function readBrowserConfigFromConfigProbe(probe: GatewayProbe): Record<string, unknown> | null {
  if (!probe.ok) {
    return null;
  }
  const payloadObj = asObject(probe.payload);
  const configObj = asObject(payloadObj?.config);
  return asObject(configObj?.browser);
}

function hasAnyBrowserProfile(config: Record<string, unknown> | null): boolean {
  if (!config) {
    return false;
  }
  const profiles = asObject(config.profiles);
  return Boolean(profiles && Object.keys(profiles).length > 0);
}

function resolveBrowserMode(config: Record<string, unknown> | null): BrowserMode {
  if (!config) {
    return "cdp";
  }
  const cdpUrl = readNonEmptyString(config.cdpUrl);
  if (cdpUrl) {
    return "cdp";
  }
  const executablePath = readNonEmptyString(config.executablePath);
  if (executablePath) {
    return "local";
  }
  if (config.attachOnly === true) {
    return "cdp";
  }
  return "cdp";
}

function isBrowserEnabled(config: Record<string, unknown> | null): boolean {
  if (!config) {
    return false;
  }
  if (typeof config.enabled === "boolean") {
    return config.enabled;
  }
  return true;
}

function isBrowserConfigured(config: Record<string, unknown> | null): boolean {
  if (!config) {
    return false;
  }
  const cdpUrl = readNonEmptyString(config.cdpUrl);
  const executablePath = readNonEmptyString(config.executablePath);
  return Boolean(cdpUrl || executablePath || hasAnyBrowserProfile(config));
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function escapeBashSingleQuoted(raw: string): string {
  return raw.replaceAll("'", "'\"'\"'");
}

export function normalizeCdpJsonVersionEndpoint(cdpUrl: string): { cdpUrl: string; jsonVersionUrl: string; port: number } | null {
  const trimmed = cdpUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const protocol = parsed.protocol === "wss:" || parsed.protocol === "https:" ? "https:" : "http:";
  const port = parsed.port
    ? Number(parsed.port)
    : protocol === "https:"
      ? 443
      : 80;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  const jsonVersionUrl = `${protocol}//${parsed.hostname}:${port}/json/version`;
  return {
    cdpUrl: trimmed,
    jsonVersionUrl,
    port,
  };
}

export function classifyCdpProbeConnectivity(direct127Ok: boolean, wslCdpOk: boolean): CdpProbeClassification {
  if (direct127Ok && wslCdpOk) {
    return {
      status: "ok",
      ready: true,
    };
  }
  if (direct127Ok && !wslCdpOk) {
    return {
      status: "local-only",
      ready: false,
    };
  }
  if (!direct127Ok && wslCdpOk) {
    return {
      status: "cdp-only",
      ready: true,
    };
  }
  return {
    status: "probe-error",
    ready: false,
  };
}

async function probeHttpUrl(url: string, timeoutMs = 4000): Promise<HttpProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      return {
        ok: false,
        url,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      url,
      status: response.status,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      url,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeWslHttpUrl(url: string): Promise<WslProbe> {
  const escapedUrl = escapeBashSingleQuoted(url);
  const script = [
    "set -euo pipefail",
    `URL='${escapedUrl}'`,
    'URL="$(printf \'%s\' "$URL" | tr -d \'\\r\\n\')"',
    "OK=0",
    "ERR=''",
    'if command -v curl >/dev/null 2>&1; then',
    '  if command curl -fsS --globoff --max-time 4 "$URL" >/dev/null 2>&1; then',
    "    OK=1",
    "  else",
    '    ERR="$(command curl -fsS --globoff --max-time 4 "$URL" 2>&1 >/dev/null || true)"',
    "  fi",
    "fi",
    'if [ "$OK" -ne 1 ] && command -v wget >/dev/null 2>&1; then',
    '  if command wget -q -T 4 -O - "$URL" >/dev/null 2>&1; then',
    "    OK=1",
    "  else",
    '    ERR="$ERR${ERR:+; }$(command wget -q -T 4 -O - "$URL" 2>&1 >/dev/null || true)"',
    "  fi",
    "fi",
    'if [ "$OK" -ne 1 ]; then',
    '  if [ -n "$ERR" ]; then',
    '    echo "$ERR" >&2',
    "  fi",
    '  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then',
    '  echo "WSL 缺少 curl/wget，无法执行 cdpUrl 连通性测试" >&2',
    "    exit 127",
    "  fi",
    "  exit 1",
    "fi",
    'echo "__CLAWOS_WSL_CDP_OK__"',
  ].join("\n");

  const result = await runWslScript(script, { loginShell: false });
  if (result.ok && result.stdout.includes("__CLAWOS_WSL_CDP_OK__")) {
    return {
      ok: true,
      url,
      command: result.command,
    };
  }

  const error = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`;
  return {
    ok: false,
    url,
    command: result.command,
    error,
  };
}

export async function checkBrowserConnectivity(): Promise<Record<string, unknown>> {
  const configProbe = await safeGatewayProbe("config.get", {}, 10000);
  const browserConfig = readBrowserConfigFromConfigProbe(configProbe);
  const browserEnabled = isBrowserEnabled(browserConfig);
  const browserConfigured = isBrowserConfigured(browserConfig);
  const browserMode = resolveBrowserMode(browserConfig);
  const browserCdpUrl = readNonEmptyString(browserConfig?.cdpUrl) || null;
  const cdpEndpoint = browserCdpUrl ? normalizeCdpJsonVersionEndpoint(browserCdpUrl) : null;

  const shouldProbe = configProbe.ok && browserEnabled && browserConfigured && browserMode === "cdp" && Boolean(cdpEndpoint);
  const direct127Url = cdpEndpoint ? `http://127.0.0.1:${cdpEndpoint.port}/json/version` : null;
  const direct127Probe = shouldProbe && direct127Url ? await probeHttpUrl(direct127Url) : null;
  const wslCdpProbe = shouldProbe && cdpEndpoint ? await probeWslHttpUrl(cdpEndpoint.jsonVersionUrl) : null;

  const direct127Ok = direct127Probe?.ok === true;
  const wslCdpOk = wslCdpProbe?.ok === true;
  const cdpClassification = classifyCdpProbeConnectivity(direct127Ok, wslCdpOk);
  let browserReady = shouldProbe ? cdpClassification.ready : false;
  const portProxyCommand = null;
  const recommendPortProxy = false;

  const warnings: string[] = [];
  if (!configProbe.ok) {
    warnings.push(`config.get 调用失败：${configProbe.error}`);
    warnings.push(...configProbe.tips);
  }
  if (browserEnabled && !browserConfigured) {
    warnings.push("浏览器已启用但未配置：请填写 browser.cdpUrl（推荐）或 browser.executablePath。");
  }
  if (browserMode === "cdp" && browserEnabled && browserConfigured && !browserCdpUrl) {
    warnings.push("当前为 CDP 模式，但 browser.cdpUrl 为空。");
  }
  if (browserMode === "cdp" && browserEnabled && browserConfigured && browserCdpUrl && !cdpEndpoint) {
    warnings.push("browser.cdpUrl 解析失败，请检查地址格式。");
  }
  if (direct127Probe && !direct127Probe.ok && !wslCdpOk) {
    warnings.push(`127.0.0.1 端口测试失败：${direct127Probe.error}`);
  }
  if (wslCdpProbe && !wslCdpProbe.ok) {
    warnings.push(`WSL cdpUrl 测试失败：${wslCdpProbe.error}`);
  }
  if (recommendPortProxy && portProxyCommand) {
    warnings.push("检测到 127.0.0.1 直连可用，但 WSL 无法访问 cdpUrl，建议配置端口转发：");
    warnings.push(portProxyCommand);
  }
  let status: BrowserConnectivityStatus = "probe-error";
  if (!configProbe.ok) {
    status = "gateway-error";
  } else if (!browserEnabled) {
    status = "disabled";
  } else if (!browserConfigured) {
    status = "not-configured";
  } else if (browserMode !== "cdp") {
    status = "ok";
    browserReady = true;
  } else {
    status = cdpClassification.status;
    browserReady = cdpClassification.ready;
  }

  return {
    checkedAt: new Date().toISOString(),
    status,
    ready: browserReady,
    enabled: browserEnabled,
    configured: browserConfigured,
    mode: browserMode,
    cdpUrl: browserCdpUrl,
    direct127: direct127Probe
      ? {
          url: direct127Probe.url,
          ok: direct127Probe.ok,
          error: direct127Probe.ok ? null : direct127Probe.error,
        }
      : null,
    wslCdp: wslCdpProbe
      ? {
          url: wslCdpProbe.url,
          ok: wslCdpProbe.ok,
          command: wslCdpProbe.command,
          error: wslCdpProbe.ok ? null : wslCdpProbe.error,
        }
      : null,
    warnings: dedupe(warnings),
    configPayload: configProbe.ok ? configProbe.payload : null,
    probePayload: null,
  };
}
