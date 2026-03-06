import { VERSION } from "../app.constants";

const STATUS_CACHE_TTL_MS = 20_000;

type UpdaterCheckResult = {
  version: string;
  hash: string;
  updateAvailable: boolean;
  updateReady: boolean;
  error: string;
};

export type ElectrobunUpdateStatusEntry = {
  status: string;
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
};

type UpdaterApi = {
  checkForUpdate: () => Promise<UpdaterCheckResult>;
  downloadUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  updateInfo: () => UpdaterCheckResult;
  getStatusHistory: () => ElectrobunUpdateStatusEntry[];
  clearStatusHistory?: () => void;
  onStatusChange?: ((callback: ((entry: ElectrobunUpdateStatusEntry) => void) | null) => void) | undefined;
  localInfo: {
    version: () => Promise<string>;
    hash: () => Promise<string>;
    channel: () => Promise<string>;
    baseUrl: () => Promise<string>;
  };
};

export type SelfUpdateStatus = {
  supported: boolean;
  reason: string | null;
  manifestUrl: string;
  currentVersion: string;
  remoteVersion: string | null;
  force: boolean;
  downloadUrl: string | null;
  hasUpdate: boolean;
  checkedAt: string;
  error: string | null;
  currentHash: string | null;
  remoteHash: string | null;
  updateReady: boolean;
  channel: string | null;
  phase: string | null;
  phaseMessage: string | null;
};

export type RunSelfUpdateOptions = {
  applyUpdate?: boolean;
  onStatus?: (entry: ElectrobunUpdateStatusEntry) => void;
  beforeApply?: () => void;
};

export type SelfUpdateRunResult = {
  updateAvailable: boolean;
  readyToApply: boolean;
  applied: boolean;
  check: UpdaterCheckResult;
};

let cachedStatus: { expiresAt: number; value: SelfUpdateStatus } | null = null;

function normalizeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  const text = String(error || "").trim();
  return text || "未知错误";
}

function readLastStatusEntry(updater: UpdaterApi): ElectrobunUpdateStatusEntry | null {
  const history = updater.getStatusHistory();
  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }
  return history[history.length - 1] || null;
}

function createBaseStatus(): SelfUpdateStatus {
  return {
    supported: true,
    reason: null,
    manifestUrl: "",
    currentVersion: VERSION,
    remoteVersion: null,
    force: false,
    downloadUrl: null,
    hasUpdate: false,
    checkedAt: new Date().toISOString(),
    error: null,
    currentHash: null,
    remoteHash: null,
    updateReady: false,
    channel: null,
    phase: null,
    phaseMessage: null,
  };
}

function asUpdaterApi(raw: unknown): UpdaterApi | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.checkForUpdate !== "function" ||
    typeof candidate.downloadUpdate !== "function" ||
    typeof candidate.applyUpdate !== "function" ||
    typeof candidate.updateInfo !== "function" ||
    typeof candidate.getStatusHistory !== "function"
  ) {
    return null;
  }

  const localInfo = candidate.localInfo;
  if (!localInfo || typeof localInfo !== "object") {
    return null;
  }

  const localInfoObj = localInfo as Record<string, unknown>;
  if (
    typeof localInfoObj.version !== "function" ||
    typeof localInfoObj.hash !== "function" ||
    typeof localInfoObj.channel !== "function" ||
    typeof localInfoObj.baseUrl !== "function"
  ) {
    return null;
  }

  return raw as UpdaterApi;
}

async function resolveUpdaterApi(): Promise<UpdaterApi | null> {
  try {
    const module = await import("electrobun");
    const maybeUpdater =
      ((module as unknown as { default?: { Updater?: unknown } }).default?.Updater as unknown) ||
      ((module as unknown as { Updater?: unknown }).Updater as unknown);
    return asUpdaterApi(maybeUpdater);
  } catch {
    return null;
  }
}

async function readLocalUpdaterInfo(updater: UpdaterApi): Promise<{
  version: string;
  hash: string;
  channel: string;
  baseUrl: string;
}> {
  const [version, hash, channel, baseUrl] = await Promise.all([
    updater.localInfo.version(),
    updater.localInfo.hash(),
    updater.localInfo.channel(),
    updater.localInfo.baseUrl(),
  ]);

  return {
    version: normalizeText(version, VERSION),
    hash: normalizeText(hash),
    channel: normalizeText(channel),
    baseUrl: normalizeText(baseUrl),
  };
}

export function clearSelfUpdateStatusCache(): void {
  cachedStatus = null;
}

export async function getSelfUpdateStatus(refresh = false): Promise<SelfUpdateStatus> {
  const now = Date.now();
  if (!refresh && cachedStatus && now < cachedStatus.expiresAt) {
    return cachedStatus.value;
  }

  const base = createBaseStatus();
  const updater = await resolveUpdaterApi();
  if (!updater) {
    const unsupported: SelfUpdateStatus = {
      ...base,
      supported: false,
      reason: "当前运行环境不支持 Electrobun Updater。",
      checkedAt: new Date().toISOString(),
    };
    cachedStatus = { expiresAt: now + STATUS_CACHE_TTL_MS, value: unsupported };
    return unsupported;
  }

  let localInfo: Awaited<ReturnType<typeof readLocalUpdaterInfo>>;
  try {
    localInfo = await readLocalUpdaterInfo(updater);
  } catch (error) {
    const unsupported: SelfUpdateStatus = {
      ...base,
      supported: false,
      reason: `读取本地更新信息失败：${getErrorMessage(error)}`,
      checkedAt: new Date().toISOString(),
    };
    cachedStatus = { expiresAt: now + STATUS_CACHE_TTL_MS, value: unsupported };
    return unsupported;
  }

  const checkedAt = new Date().toISOString();
  const manifestUrl = localInfo.baseUrl;

  try {
    const check = await updater.checkForUpdate();
    const lastStatus = readLastStatusEntry(updater);

    const status: SelfUpdateStatus = {
      ...base,
      supported: true,
      reason: null,
      manifestUrl,
      currentVersion: localInfo.version || VERSION,
      remoteVersion: normalizeText(check.version) || null,
      force: false,
      downloadUrl: null,
      hasUpdate: check.updateAvailable === true,
      checkedAt,
      error: normalizeText(check.error) || null,
      currentHash: localInfo.hash || null,
      remoteHash: normalizeText(check.hash) || null,
      updateReady: check.updateReady === true,
      channel: localInfo.channel || null,
      phase: normalizeText(lastStatus?.status) || null,
      phaseMessage: normalizeText(lastStatus?.message) || null,
    };

    cachedStatus = { expiresAt: now + STATUS_CACHE_TTL_MS, value: status };
    return status;
  } catch (error) {
    const message = getErrorMessage(error);
    const failed: SelfUpdateStatus = {
      ...base,
      supported: true,
      reason: null,
      manifestUrl,
      currentVersion: localInfo.version || VERSION,
      currentHash: localInfo.hash || null,
      channel: localInfo.channel || null,
      checkedAt,
      error: message,
    };
    cachedStatus = { expiresAt: now + 8_000, value: failed };
    return failed;
  }
}

export async function runSelfUpdate(options: RunSelfUpdateOptions = {}): Promise<SelfUpdateRunResult> {
  const updater = await resolveUpdaterApi();
  if (!updater) {
    throw new Error("当前运行环境不支持 Electrobun Updater。请使用 Electrobun 打包版本运行。");
  }

  if (typeof updater.clearStatusHistory === "function") {
    updater.clearStatusHistory();
  }

  const onStatus = options.onStatus;
  if (onStatus && typeof updater.onStatusChange === "function") {
    updater.onStatusChange((entry) => {
      try {
        onStatus(entry);
      } catch {
        // ignore callback errors
      }
    });
  }

  try {
    const check = await updater.checkForUpdate();
    if (normalizeText(check.error)) {
      throw new Error(check.error);
    }

    if (!check.updateAvailable) {
      clearSelfUpdateStatusCache();
      return {
        updateAvailable: false,
        readyToApply: check.updateReady === true,
        applied: false,
        check,
      };
    }

    await updater.downloadUpdate();
    const postDownload = updater.updateInfo();

    if (normalizeText(postDownload.error)) {
      throw new Error(postDownload.error);
    }

    const readyToApply = postDownload.updateReady === true;
    if (options.applyUpdate === false) {
      clearSelfUpdateStatusCache();
      return {
        updateAvailable: true,
        readyToApply,
        applied: false,
        check: postDownload,
      };
    }

    if (!readyToApply) {
      throw new Error("更新文件已下载，但尚未进入可应用状态。请稍后重试。");
    }

    try {
      options.beforeApply?.();
    } catch {
      // ignore pre-apply callback errors
    }

    await updater.applyUpdate();
    clearSelfUpdateStatusCache();
    return {
      updateAvailable: true,
      readyToApply: true,
      applied: true,
      check: postDownload,
    };
  } finally {
    if (typeof updater.onStatusChange === "function") {
      updater.onStatusChange(null);
    }
  }
}
