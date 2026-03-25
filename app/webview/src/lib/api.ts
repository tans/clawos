import type { TaskRecord } from "../../../shared/types/api";

type ApiOptions = {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type ApiError = Error & { isApiError?: boolean };

export type LocalSettings = {
  openclawToken?: string;
  controllerAddress?: string;
  companyAddress?: string;
  companyBaseUrl?: string;
  farmAddress?: string;
  farmBaseUrl?: string;
};

export type AutoStartState = {
  supported?: boolean;
  enabled?: boolean;
};

export type QwGatewayStatus = {
  state?: "idle" | "running" | "success" | "failed" | "unsupported" | string;
  source?: "startup" | "manual" | null;
  taskId?: string | null;
  message?: string;
  updatedAt?: string | null;
};

export type WeixinLoginState = {
  sessionKey: string;
  loginUrl?: string | null;
  qrDataUrl?: string | null;
  phase?: "waiting" | "connected" | "failed" | string;
  message?: string;
  accountId?: string | null;
  restartedGateway?: boolean;
  startedAt?: string;
  updatedAt?: string;
};

export type AppUpdateStatus = {
  supported?: boolean;
  remoteVersion?: string | null;
  hasUpdate?: boolean;
  error?: string | null;
};


export type BrandProfile = {
  name?: string;
  domain?: string;
  logoUrl?: string;
};

export type BackupRecord = {
  path: string;
  fileName: string;
  modifiedAt?: number | null;
  size?: number | null;
};

export type EnvironmentToolStatus = {
  installed?: boolean;
  version?: string | null;
};

export type EnvironmentTargetStatus = {
  python?: EnvironmentToolStatus;
  uv?: EnvironmentToolStatus;
  bun?: EnvironmentToolStatus;
};

export type EnvironmentStatus = {
  windows?: EnvironmentTargetStatus;
  wsl?: EnvironmentTargetStatus;
};

export type McpTargetStatus = {
  name: string;
  scriptExists?: boolean;
  built?: boolean;
};

export type ChannelConfig = {
  enable?: boolean;
  enabled?: boolean;
  appId?: string;
  secret?: string;
  appSecret?: string;
};

export type SessionSummary = {
  key: string;
  title?: string;
  active?: boolean;
  updatedAtMs?: number;
};

export type SessionHistoryEntry = {
  role?: string;
  text?: string;
  ts?: number;
};

export type ClawhubSearchItem = {
  skill?: string;
  name?: string;
  title?: string;
  description?: string;
};

export type DesktopMcpStatus = {
  running?: boolean;
  host?: string;
  port?: number;
  url?: string;
  taskId?: string | null;
};

export type WalletSummary = {
  exists?: boolean;
  address?: string;
  createdAt?: string;
};

export type WalletBalances = {
  updatedAt?: string;
  chains?: Record<
    string,
    {
      nativeBalance?: string;
      usdtBalance?: string;
      nativeError?: string;
      usdtError?: string;
    }
  >;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs as number) > 0 ? Math.floor(options.timeoutMs as number) : 15_000;
  const timeoutId = setTimeout(() => controller.abort(new Error(`请求超时（${timeoutMs}ms）`)), timeoutMs);
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(options.signal?.reason), { once: true });
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `请求超时或已取消（${timeoutMs}ms）`
        : error instanceof Error
          ? error.message
          : "网络请求失败";
    const wrapped = new Error(message) as ApiError;
    wrapped.isApiError = true;
    throw wrapped;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || `请求失败: ${response.status}`) as ApiError;
    error.isApiError = true;
    throw error;
  }

  return data as T;
}

export function readUserErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && (error as ApiError).isApiError === true) {
    return fallback;
  }
  const message = error instanceof Error ? String(error.message || "").trim() : "";
  return message || fallback;
}

export async function fetchLocalSettings(): Promise<LocalSettings> {
  const data = await request<{ ok: true; settings: LocalSettings }>("/api/local/settings");
  return data.settings || {};
}

export async function saveLocalSettings(patch: {
  openclawToken: string;
  controllerAddress: string;
  companyAddress: string;
}): Promise<LocalSettings> {
  const data = await request<{ ok: true; settings: LocalSettings }>("/api/local/settings", {
    method: "PUT",
    body: patch,
  });
  return data.settings || {};
}

export async function fetchClawosAutoStart(): Promise<AutoStartState> {
  const data = await request<{ ok: true; state: AutoStartState }>("/api/system/autostart/clawos");
  return data.state || {};
}

export async function saveClawosAutoStart(enabled: boolean): Promise<AutoStartState> {
  const data = await request<{ ok: true; state: AutoStartState }>("/api/system/autostart/clawos", {
    method: "PUT",
    body: { enabled },
  });
  return data.state || {};
}

export async function fetchQwGatewayStatus(): Promise<QwGatewayStatus> {
  const data = await request<{ ok: true; status: QwGatewayStatus }>("/api/qw-gateway/status");
  return data.status || {};
}

export async function fetchWeixinLoginState(sessionKey?: string): Promise<WeixinLoginState | null> {
  const query = typeof sessionKey === "string" && sessionKey.trim() ? `?sessionKey=${encodeURIComponent(sessionKey.trim())}` : "";
  const data = await request<{ ok: true; state: WeixinLoginState | null }>(`/api/channels/weixin/login${query}`);
  return data.state || null;
}

export async function startWeixinLogin(force = false): Promise<WeixinLoginState> {
  const data = await request<{ ok: true; state: WeixinLoginState }>("/api/channels/weixin/login/start", {
    method: "POST",
    body: { force },
  });
  return data.state;
}

export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const data = await request<{ ok: true; task: TaskRecord }>(`/api/tasks/${taskId}`);
  return data.task;
}

export async function fetchRecentTasks(): Promise<TaskRecord[]> {
  const data = await request<{ ok: true; tasks: TaskRecord[] }>("/api/tasks");
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function startGatewayAction(action: "restart" | "restart-qw-gateway" | "status" | "start" | "stop") {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/gateway/action", {
    method: "POST",
    body: { action },
  });
}

export async function startGatewayUpdate() {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/gateway/update", {
    method: "POST",
    body: {},
  });
}


export async function fetchBrandProfile(): Promise<BrandProfile> {
  const data = await request<{ ok: true; brand: BrandProfile }>("/api/brand");
  return data.brand || {};
}

export async function fetchHealthVersion(): Promise<string | null> {
  const data = await request<{ ok: true; version?: string }>("/api/health");
  return typeof data.version === "string" ? data.version : null;
}

export async function fetchAppUpdateStatus(): Promise<AppUpdateStatus> {
  const data = await request<{ ok: true; status: AppUpdateStatus }>("/api/app/update/status");
  return data.status || {};
}

export async function startAppUpdate() {
  return await request<{ ok: true; taskId: string }>("/api/app/update/run", {
    method: "POST",
    body: {
      trigger: "manual",
      autoRestart: true,
    },
  });
}

export async function startBrowserAction(
  action: "detect" | "repair" | "open-cdp" | "restart" | "restart-browser" | "restart-cdp" | "reset" | "reset-config"
) {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/browser/action", {
    method: "POST",
    body: action === "detect" ? { action } : { action, confirmed: true },
  });
}

export async function fetchBackups(): Promise<{ backups: BackupRecord[]; command?: string | null }> {
  const data = await request<{ ok: true; backups: BackupRecord[]; command?: string | null }>("/api/gateway/config/backups");
  return {
    backups: Array.isArray(data.backups) ? data.backups : [],
    command: typeof data.command === "string" ? data.command : null,
  };
}

export async function startBackupRollback(backupPath: string) {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/gateway/config/rollback", {
    method: "POST",
    body: { backupPath },
  });
}

export async function fetchEnvironmentStatus(): Promise<EnvironmentStatus> {
  const data = await request<{ ok: true; status: EnvironmentStatus }>("/api/environment/status");
  return data.status || {};
}

export async function startEnvironmentInstall(target: "windows" | "wsl", tool: "python" | "uv" | "bun") {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/environment/install", {
    method: "POST",
    body: { target, tool },
  });
}

export async function fetchMcpStatus(): Promise<McpTargetStatus[]> {
  const data = await request<{ ok: true; targets: McpTargetStatus[] }>("/api/mcp/status");
  return Array.isArray(data.targets) ? data.targets : [];
}

export async function startMcpBuild(name: string) {
  return await request<{ ok: true; taskId: string; reused?: boolean; task?: TaskRecord }>("/api/mcp/build", {
    method: "POST",
    body: { name },
  });
}

export async function fetchConfigSection<T extends Record<string, unknown>>(section: string): Promise<T> {
  const data = await request<{ ok: true; section: string; data: T }>(`/api/config/${encodeURIComponent(section)}`);
  return (data.data || {}) as T;
}

export async function saveChannelConfig(channelKey: string, data: Record<string, unknown>) {
  return await request<{ ok: true; data?: Record<string, unknown> }>(
    `/api/config/channels/channel/${encodeURIComponent(channelKey)}`,
    {
      method: "PATCH",
      body: { data },
    }
  );
}

export async function saveConfigSection<T extends Record<string, unknown>>(section: string, data: T) {
  return await request<{ ok: true; section: string; data: T }>(`/api/config/${encodeURIComponent(section)}`, {
    method: "PUT",
    body: { data },
  });
}

export async function fetchSessions(limit = 200): Promise<SessionSummary[]> {
  const data = await request<{ ok: true; sessions: SessionSummary[] }>(`/api/sessions?limit=${limit}`);
  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function fetchSessionHistory(sessionKey: string, limit = 300): Promise<SessionHistoryEntry[]> {
  const data = await request<{ ok: true; history: SessionHistoryEntry[] }>(
    `/api/sessions/${encodeURIComponent(sessionKey)}/history?limit=${limit}`
  );
  return Array.isArray(data.history) ? data.history : [];
}

export async function searchClawhubSkills(query: string, limit = 30): Promise<ClawhubSearchItem[]> {
  const data = await request<{ ok: true; items: ClawhubSearchItem[] }>(
    `/api/skills/clawhub/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return Array.isArray(data.items) ? data.items : [];
}

export async function activateClawhubSkill(skill: string) {
  return await request<{ ok: true; data?: Record<string, unknown> }>("/api/skills/clawhub/activate", {
    method: "POST",
    body: { skill },
  });
}

export async function installClawhub() {
  return await request<{ ok: true; installed?: boolean }>("/api/skills/clawhub/install", {
    method: "POST",
    body: {},
  });
}

export async function fetchDesktopMcpStatus(): Promise<DesktopMcpStatus> {
  const data = await request<{ ok: true; status: DesktopMcpStatus }>("/api/desktop-control/mcp/status");
  return data.status || {};
}

export async function startDesktopMcp() {
  return await request<{ ok: true; status: DesktopMcpStatus; taskId?: string; task?: TaskRecord }>(
    "/api/desktop-control/mcp/start",
    {
      method: "POST",
      body: {},
    }
  );
}

export async function stopDesktopMcp() {
  return await request<{ ok: true; status: DesktopMcpStatus; taskId?: string; task?: TaskRecord }>(
    "/api/desktop-control/mcp/stop",
    {
      method: "POST",
      body: {},
    }
  );
}

export async function fetchLocalWallet(): Promise<WalletSummary> {
  const data = await request<{ ok: true; wallet: WalletSummary }>("/api/local/wallet");
  return data.wallet || {};
}

export async function generateLocalWallet() {
  return await request<{ ok: true; wallet: WalletSummary; privateKey?: string }>("/api/local/wallet/generate", {
    method: "POST",
    body: {},
  });
}

export async function fetchLocalWalletBalances(): Promise<WalletBalances | null> {
  const data = await request<{ ok: true; balances: WalletBalances | null }>("/api/local/wallet/balances");
  return data.balances || null;
}
