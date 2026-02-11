import { readNonEmptyString } from "../lib/value";
import { resolveGatewayConnectionSettings } from "../gateway/settings";
import { callGatewayMethod } from "../gateway/sock";
import { runWslScript, troubleshootingTips } from "../tasks/shell";
import { gatewayTroubleshootingTips } from "../gateway/sock";
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

export async function checkEnvironment(): Promise<Record<string, unknown>> {
  const connection = await resolveGatewayConnectionSettings();

  const [wslProbe, statusProbe, healthProbe, channelsProbe] = await Promise.all([
    runWslScript("set -euo pipefail\necho WSL_OK"),
    safeGatewayProbe("status", {}, 10000),
    safeGatewayProbe("health", { probe: false }, 10000),
    safeGatewayProbe("channels.status", { probe: false, timeoutMs: 3000 }, 12000),
  ]);

  const gatewayReady = statusProbe.ok && healthProbe.ok;
  const openclawReady = statusProbe.ok;

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

  const warnings: string[] = [];
  if (!wslProbe.ok) {
    warnings.push(`WSL 检测失败：${wslProbe.stderr || `退出码 ${wslProbe.code}`}`);
    warnings.push(...troubleshootingTips(wslProbe.stderr || ""));
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

  return {
    os: process.platform,
    execution: `gateway-protocol (${connection.url})`,
    wslReady: wslProbe.ok,
    openclawReady,
    gatewayReady,
    openclawVersion,
    gatewayStatus: statusDetailBlocks.join("\n\n") || null,
    warnings: Array.from(new Set(warnings)),
  };
}
