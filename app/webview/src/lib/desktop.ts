import { fetchLocalSettings } from "./api";

declare global {
  interface Window {
    __clawosDesktop?: {
      openExternalUrl?: (url: string) => Promise<void>;
    };
  }
}

const DEFAULT_OPENCLAW_CONSOLE_URL = "http://127.0.0.1:18789";
const DEFAULT_OPENCLAW_TOKEN = "xiake";

function withOpenclawToken(rawUrl: string, token: string): string {
  const finalToken = token.trim() || DEFAULT_OPENCLAW_TOKEN;
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.set("token", finalToken);
    return parsed.toString();
  } catch {
    return `${DEFAULT_OPENCLAW_CONSOLE_URL}?token=${encodeURIComponent(finalToken)}`;
  }
}

function normalizeOpenclawConsoleUrl(rawUrl: string, token: string): string {
  if (!rawUrl.trim()) {
    return withOpenclawToken(DEFAULT_OPENCLAW_CONSOLE_URL, token);
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    } else if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    }
    return withOpenclawToken(parsed.toString(), token);
  } catch {
    return withOpenclawToken(DEFAULT_OPENCLAW_CONSOLE_URL, token);
  }
}

async function fetchGatewayUrl(): Promise<string> {
  const response = await fetch("/api/local/gateway");
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `请求失败: ${response.status}`);
  }
  return typeof data.gateway?.url === "string" ? data.gateway.url : "";
}

export async function openExternalUrl(url: string): Promise<void> {
  const nativeOpen = window.__clawosDesktop?.openExternalUrl;
  if (typeof nativeOpen === "function") {
    await nativeOpen(url);
    return;
  }

  window.open(url, "_blank", "noopener");
}

export async function openOpenclawConsole(): Promise<void> {
  await openOpenclawPath("");
}

export async function openOpenclawSkillsConfig(): Promise<void> {
  await openOpenclawPath("/config/skills");
}

async function openOpenclawPath(pathname: string): Promise<void> {
  let token = DEFAULT_OPENCLAW_TOKEN;
  try {
    const settings = await fetchLocalSettings();
    if (typeof settings.openclawToken === "string" && settings.openclawToken.trim()) {
      token = settings.openclawToken.trim();
    }
  } catch {
    token = DEFAULT_OPENCLAW_TOKEN;
  }

  let gatewayUrl = "";
  try {
    gatewayUrl = await fetchGatewayUrl();
  } catch {
    gatewayUrl = "";
  }

  const baseUrl = normalizeOpenclawConsoleUrl(gatewayUrl, token);
  if (!pathname.trim()) {
    await openExternalUrl(baseUrl);
    return;
  }

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = pathname;
    await openExternalUrl(parsed.toString());
  } catch {
    await openExternalUrl(baseUrl);
  }
}
