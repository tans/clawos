import { asObject, readNonEmptyString } from "../lib/value";
import { resolveGatewayConnectionSettings } from "../gateway/settings";
import { callGatewayMethod } from "../gateway/sock";
import { runWslScript, troubleshootingTips } from "../tasks/shell";
import { gatewayTroubleshootingTips } from "../gateway/sock";
import { checkWslCommandRequirements } from "./wsl-requirements";
import type { GatewayHelloPayload } from "../gateway/schema";

type GatewayProbe =
  | {
      ok: true;
      payload: unknown;
      hello: GatewayHelloPayload;
      url: string;
    }
  | {
      ok: false;
      error: string;
      tips: string[];
    };

async function safeGatewayProbe(method: string, params: unknown, timeoutMs = 10000): Promise<GatewayProbe> {
  try {
    const result = await callGatewayMethod(method, params, { timeoutMs });
    return {
      ok: true,
      payload: result.payload,
      hello: result.hello,
      url: result.url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message,
      tips: gatewayTroubleshootingTips(message),
    };
  }
}

function supportsGatewayMethod(hello: GatewayHelloPayload | undefined, method: string): boolean {
  const methods = Array.isArray(hello?.features?.methods) ? hello.features?.methods : null;
  if (!methods) {
    return true;
  }
  return methods.includes(method);
}

type BrowserMode = "cdp" | "local";

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

function simplifyWslCommandForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const distroMatch = trimmed.match(/\bwsl(?:\.exe)?\b(?:\s+-d\s+([^\s]+))?/i);
  const distro = distroMatch?.[1] || "<distro>";

  if (trimmed.includes("set +e") && trimmed.includes("__CLAWOS_WSL_CMD_OK__")) {
    return `wsl.exe -d ${distro} -- bash -lic "<命令检测脚本: openclaw git pnpm nrm>"`;
  }
  if (trimmed.includes("echo WSL_OK")) {
    return `wsl.exe -d ${distro} -- bash -lic "<基础探测脚本: echo WSL_OK>"`;
  }
  return trimmed;
}

export async function checkEnvironment(): Promise<Record<string, unknown>> {
  const connection = await resolveGatewayConnectionSettings();

  const [wslProbe, statusProbe, healthProbe, channelsProbe, configProbe] = await Promise.all([
    runWslScript("set -euo pipefail\necho WSL_OK"),
    safeGatewayProbe("status", {}, 10000),
    safeGatewayProbe("health", { probe: false }, 10000),
    safeGatewayProbe("channels.status", { probe: false, timeoutMs: 3000 }, 12000),
    safeGatewayProbe("config.get", {}, 10000),
  ]);

  const wslCommandProbe = wslProbe.ok ? await checkWslCommandRequirements() : null;

  const gatewayReady = statusProbe.ok && healthProbe.ok;
  const openclawReady = statusProbe.ok;
  const wslReady = wslProbe.ok && (!wslCommandProbe || wslCommandProbe.ok);
  const browserConfig = readBrowserConfigFromConfigProbe(configProbe);
  const browserEnabled = isBrowserEnabled(browserConfig);
  const browserConfigured = isBrowserConfigured(browserConfig);
  const browserMode = resolveBrowserMode(browserConfig);
  const browserCdpUrl = readNonEmptyString(browserConfig?.cdpUrl) || null;

  const shouldProbeBrowser = gatewayReady && browserEnabled && browserConfigured;
  const supportsBrowserRequest = statusProbe.ok
    ? supportsGatewayMethod(statusProbe.hello, "browser.request")
    : healthProbe.ok
      ? supportsGatewayMethod(healthProbe.hello, "browser.request")
      : false;
  const browserProbe = shouldProbeBrowser && supportsBrowserRequest
    ? await safeGatewayProbe(
        "browser.request",
        {
          method: "GET",
          path: "/json/version",
          timeoutMs: 3000,
        },
        6000
      )
    : null;
  const browserReady = shouldProbeBrowser && browserProbe?.ok === true;

  const openclawVersion = statusProbe.ok
    ? readNonEmptyString(statusProbe.hello.server?.version) || null
    : healthProbe.ok
      ? readNonEmptyString(healthProbe.hello.server?.version) || null
      : null;

  const statusDetailBlocks: string[] = [];
  if (statusProbe.ok) {
    statusDetailBlocks.push(`status:\n${JSON.stringify(statusProbe.payload, null, 2)}`);
  }
  if (healthProbe.ok) {
    statusDetailBlocks.push(`health:\n${JSON.stringify(healthProbe.payload, null, 2)}`);
  }
  if (channelsProbe.ok) {
    statusDetailBlocks.push(`channels.status:\n${JSON.stringify(channelsProbe.payload, null, 2)}`);
  }
  if (configProbe.ok) {
    statusDetailBlocks.push(`config.get:\n${JSON.stringify(configProbe.payload, null, 2)}`);
  }
  if (browserProbe?.ok) {
    statusDetailBlocks.push(`browser.request:/json/version:\n${JSON.stringify(browserProbe.payload, null, 2)}`);
  }

  const warnings: string[] = [];
  if (!wslProbe.ok) {
    warnings.push(`WSL 检测失败：${wslProbe.stderr || `退出码 ${wslProbe.code}`}`);
    warnings.push(`WSL 执行命令：${simplifyWslCommandForDisplay(wslProbe.command)}`);
    warnings.push(...troubleshootingTips(wslProbe.stderr || ""));
  }
  if (wslProbe.ok && wslCommandProbe && !wslCommandProbe.ok) {
    if (wslCommandProbe.missing.length > 0) {
      warnings.push(`WSL 缺少命令：${wslCommandProbe.missing.join(", ")}`);
    }
    warnings.push(`WSL 命令探测执行：${simplifyWslCommandForDisplay(wslCommandProbe.command)}`);
    if (wslCommandProbe.stderr.trim().length > 0) {
      warnings.push(`WSL 命令检测异常：${wslCommandProbe.stderr.trim()}`);
    }
  }
  if (!statusProbe.ok) {
    warnings.push(`status 调用失败：${statusProbe.error}`);
    warnings.push(...statusProbe.tips);
  }
  if (!healthProbe.ok) {
    warnings.push(`health 调用失败：${healthProbe.error}`);
    warnings.push(...healthProbe.tips);
  }
  if (!channelsProbe.ok) {
    warnings.push(`channels.status 调用失败：${channelsProbe.error}`);
    warnings.push(...channelsProbe.tips);
  }
  if (!configProbe.ok && openclawReady) {
    warnings.push(`config.get 调用失败：${configProbe.error}`);
    warnings.push(...configProbe.tips);
  }
  if (browserEnabled && !browserConfigured) {
    warnings.push("浏览器已启用但未配置：请至少配置 browser.cdpUrl（推荐）或 browser.executablePath。");
  }
  if (browserMode === "cdp" && browserEnabled && browserConfigured && !browserCdpUrl) {
    warnings.push("当前为 CDP 模式，但 browser.cdpUrl 为空。");
  }
  if (browserProbe && !browserProbe.ok) {
    warnings.push(`browser.request 调用失败：${browserProbe.error}`);
    warnings.push(...browserProbe.tips);
  }

  return {
    os: process.platform,
    execution: `gateway-protocol (${connection.url})`,
    wslReady,
    wslCommands: wslCommandProbe?.commands || [],
    openclawReady,
    gatewayReady,
    browserReady,
    browserEnabled,
    browserConfigured,
    browserMode,
    browserCdpUrl,
    openclawVersion,
    gatewayStatus: statusDetailBlocks.join("\n\n") || null,
    warnings: Array.from(new Set(warnings)),
  };
}
