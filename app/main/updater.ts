import Electrobun from "electrobun";
import {
  getSelfUpdateStatus,
  runSelfUpdate,
  type ElectrobunUpdateStatusEntry,
  type SelfUpdateStatus,
} from "../server/system/self-update";
import { VERSION } from "../shared/constants/app";

const SHOULD_BACKGROUND_CHECK_UPDATES = !["0", "false", "no", "off"].includes(
  (process.env.CLAWOS_BACKGROUND_UPDATE_CHECK || "").trim().toLowerCase()
);
const SHOULD_BACKGROUND_DOWNLOAD_UPDATES = !["0", "false", "no", "off"].includes(
  (process.env.CLAWOS_BACKGROUND_UPDATE_DOWNLOAD || "").trim().toLowerCase()
);

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "ready" | "applying" | "error";
type UpdateState = {
  phase: UpdatePhase;
  hasUpdate: boolean;
  readyToApply: boolean;
  message: string;
  currentVersion: string;
  remoteVersion: string | null;
  checkedAt: string | null;
  error: string | null;
};

const updateState: UpdateState = {
  phase: "idle",
  hasUpdate: false,
  readyToApply: false,
  message: "尚未检查更新",
  currentVersion: VERSION,
  remoteVersion: null,
  checkedAt: null,
  error: null,
};

let updateActionPromise: Promise<void> | null = null;

function updateStatePatch(patch: Partial<UpdateState>): void {
  Object.assign(updateState, patch);
}

function showDesktopNotification(title: string, body: string): void {
  try {
    Electrobun.Utils.showNotification({ title, body, silent: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop] failed to show notification: ${message}`);
  }
}

function syncUpdateStateFromSelfUpdateStatus(status: SelfUpdateStatus): void {
  if (!status.supported) {
    updateStatePatch({
      phase: "error",
      hasUpdate: false,
      readyToApply: false,
      message: status.reason || "当前环境不支持自动更新",
      currentVersion: status.currentVersion || VERSION,
      remoteVersion: null,
      checkedAt: status.checkedAt || null,
      error: status.reason || null,
    });
    return;
  }

  if (status.error) {
    updateStatePatch({
      phase: "error",
      hasUpdate: Boolean(status.hasUpdate),
      readyToApply: Boolean(status.updateReady),
      message: status.error,
      currentVersion: status.currentVersion || VERSION,
      remoteVersion: status.remoteVersion,
      checkedAt: status.checkedAt || null,
      error: status.error,
    });
    return;
  }

  const phase: UpdatePhase = status.updateReady ? "ready" : status.hasUpdate ? "available" : "idle";
  const message = status.updateReady
    ? `更新已就绪：${status.remoteVersion || "新版本"}`
    : status.hasUpdate
      ? `发现新版本：${status.remoteVersion || "可更新"}`
      : "当前已是最新版本";

  updateStatePatch({
    phase,
    hasUpdate: Boolean(status.hasUpdate),
    readyToApply: Boolean(status.updateReady),
    message,
    currentVersion: status.currentVersion || VERSION,
    remoteVersion: status.remoteVersion,
    checkedAt: status.checkedAt || null,
    error: null,
  });
}

function syncUpdateStateFromUpdaterStatus(entry: ElectrobunUpdateStatusEntry): void {
  switch (entry.status) {
    case "checking":
      updateStatePatch({ phase: "checking", message: "正在检查更新...", error: null });
      break;
    case "update-available":
      updateStatePatch({
        phase: "available",
        hasUpdate: true,
        readyToApply: false,
        message: "发现新版本，正在后台下载...",
        error: null,
      });
      break;
    case "download-starting":
    case "checking-local-tar":
    case "local-tar-found":
    case "local-tar-missing":
    case "fetching-patch":
    case "patch-found":
    case "patch-not-found":
    case "downloading":
    case "downloading-patch":
    case "download-progress":
    case "downloading-full-bundle":
    case "decompressing":
    case "download-complete":
    case "patch-chain-complete":
    case "patch-applied":
    case "applying-patch":
      updateStatePatch({
        phase: "downloading",
        hasUpdate: true,
        readyToApply: false,
        message: "正在后台下载更新...",
        error: null,
      });
      break;
    case "applying":
    case "extracting":
    case "replacing-app":
    case "launching-new-version":
      updateStatePatch({
        phase: "applying",
        hasUpdate: true,
        readyToApply: true,
        message: "正在安装更新并重启...",
        error: null,
      });
      break;
    case "complete":
      updateStatePatch({
        phase: "ready",
        hasUpdate: true,
        readyToApply: true,
        message: "更新已准备完成，等待重启安装",
        checkedAt: new Date().toISOString(),
        error: null,
      });
      break;
    case "no-update":
      updateStatePatch({
        phase: "idle",
        hasUpdate: false,
        readyToApply: false,
        message: "当前已是最新版本",
        checkedAt: new Date().toISOString(),
        error: null,
      });
      break;
    case "error":
      updateStatePatch({
        phase: "error",
        message: entry.message || "检查更新失败",
        error: entry.message || "检查更新失败",
        checkedAt: new Date().toISOString(),
      });
      break;
    default:
      break;
  }
}

function handleUpdateAction(operation: () => Promise<void>): void {
  if (updateActionPromise) {
    return;
  }

  updateActionPromise = operation().finally(() => {
    updateActionPromise = null;
  });
}

async function checkForUpdates(options: { trigger: "startup"; downloadIfAvailable: boolean }): Promise<void> {
  updateStatePatch({ phase: "checking", message: "启动后检查更新...", error: null });

  try {
    const status = await getSelfUpdateStatus(true);
    syncUpdateStateFromSelfUpdateStatus(status);
    if (!status.hasUpdate) {
      return;
    }

    if (status.updateReady) {
      showDesktopNotification(
        "ClawOS 更新已就绪",
        status.remoteVersion ? `可重启安装 ${status.remoteVersion}` : "更新包已准备完成"
      );
      return;
    }

    if (!options.downloadIfAvailable) {
      showDesktopNotification(
        "ClawOS 发现新版本",
        status.remoteVersion ? `检测到 ${status.remoteVersion}` : "发现可用更新"
      );
      return;
    }

    updateStatePatch({
      phase: "downloading",
      hasUpdate: true,
      readyToApply: false,
      message: "发现新版本，正在后台下载...",
      error: null,
    });

    await runSelfUpdate({ applyUpdate: false, onStatus: syncUpdateStateFromUpdaterStatus });

    const refreshed = await getSelfUpdateStatus(true);
    syncUpdateStateFromSelfUpdateStatus(refreshed);
    if (refreshed.updateReady) {
      showDesktopNotification(
        "ClawOS 更新已下载",
        refreshed.remoteVersion ? `已准备安装 ${refreshed.remoteVersion}` : "更新包已准备完成"
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateStatePatch({
      phase: "error",
      message,
      error: message,
      checkedAt: new Date().toISOString(),
    });
    console.warn(`[desktop] background update check failed: ${message}`);
  }
}

export function startBackgroundUpdateCheck(): void {
  if (!SHOULD_BACKGROUND_CHECK_UPDATES) {
    return;
  }

  handleUpdateAction(async () => {
    await checkForUpdates({
      trigger: "startup",
      downloadIfAvailable: SHOULD_BACKGROUND_DOWNLOAD_UPDATES,
    });
  });
}
