import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import {
  clearSelfUpdateStatusCache,
  runSelfUpdate,
  getSelfUpdateStatus,
  type ElectrobunUpdateStatusEntry,
} from "../system/self-update";

type SelfUpdateTaskOptions = {
  autoRestart?: boolean;
};

const DOWNLOAD_PHASE_STATUSES = new Set([
  "download-starting",
  "checking-local-tar",
  "local-tar-found",
  "local-tar-missing",
  "fetching-patch",
  "patch-found",
  "patch-not-found",
  "downloading",
  "downloading-patch",
  "download-progress",
  "downloading-full-bundle",
  "decompressing",
  "download-complete",
  "patch-chain-complete",
  "patch-applied",
  "applying-patch",
]);

const APPLY_PHASE_STATUSES = new Set([
  "applying",
  "extracting",
  "replacing-app",
  "launching-new-version",
  "complete",
]);

function formatProgressText(entry: ElectrobunUpdateStatusEntry): string | null {
  const details = entry.details;
  if (!details || typeof details !== "object") {
    return null;
  }

  const progress = (details as Record<string, unknown>).progress;
  if (typeof progress === "number" && Number.isFinite(progress)) {
    const percent = Math.max(0, Math.min(100, Math.round(progress)));
    return `${percent}%`;
  }

  const bytesDownloaded = (details as Record<string, unknown>).bytesDownloaded;
  const totalBytes = (details as Record<string, unknown>).totalBytes;
  if (typeof bytesDownloaded === "number" && Number.isFinite(bytesDownloaded) && bytesDownloaded >= 0) {
    if (typeof totalBytes === "number" && Number.isFinite(totalBytes) && totalBytes > 0) {
      return `${Math.round((bytesDownloaded / totalBytes) * 100)}%`;
    }
    return `${Math.round(bytesDownloaded / 1024 / 1024)}MB`;
  }

  return null;
}

function mapUpdaterStatusToLog(entry: ElectrobunUpdateStatusEntry): string {
  const message = typeof entry.message === "string" ? entry.message.trim() : "";

  switch (entry.status) {
    case "checking":
      return "正在检查更新...";
    case "update-available":
      return message ? `发现新版本：${message}` : "发现新版本。";
    case "no-update":
      return "当前已是最新版本。";
    case "download-starting":
      return "开始下载更新包...";
    case "download-progress": {
      const progress = formatProgressText(entry);
      return progress ? `下载进度：${progress}` : message || "正在下载更新包...";
    }
    case "decompressing":
      return "正在解压更新包...";
    case "download-complete":
      return "更新包下载完成。";
    case "applying":
      return "正在应用更新...";
    case "extracting":
      return "正在展开新版本文件...";
    case "replacing-app":
      return "正在替换应用文件...";
    case "launching-new-version":
      return "正在启动新版本...";
    case "complete":
      return "更新完成，应用将自动重启。";
    case "error":
      return message ? `更新失败：${message}` : "更新失败。";
    default:
      return message || `更新状态：${entry.status}`;
  }
}

function attachUpdaterLogs(task: Task): {
  onStatus: (entry: ElectrobunUpdateStatusEntry) => void;
} {
  let lastStatusKey = "";
  let lastProgressBucket = -1;

  return {
    onStatus(entry) {
      const rawMessage = typeof entry.message === "string" ? entry.message.trim() : "";

      if (entry.status === "download-progress") {
        const details = entry.details;
        const progress =
          details && typeof details === "object" ? (details as Record<string, unknown>).progress : undefined;
        if (typeof progress === "number" && Number.isFinite(progress)) {
          const bucket = Math.floor(Math.max(0, Math.min(100, progress)) / 5);
          if (bucket <= lastProgressBucket && bucket < 20) {
            return;
          }
          lastProgressBucket = bucket;
        }
      }

      const statusKey = `${entry.status}|${rawMessage}`;
      if (statusKey === lastStatusKey && entry.status !== "download-progress") {
        return;
      }
      lastStatusKey = statusKey;

      if (DOWNLOAD_PHASE_STATUSES.has(entry.status)) {
        task.step = Math.max(task.step, 2);
      }
      if (APPLY_PHASE_STATUSES.has(entry.status)) {
        task.step = Math.max(task.step, 3);
      }

      appendTaskLog(task, mapUpdaterStatusToLog(entry), entry.status === "error" ? "error" : "info");
    },
  };
}

export function startSelfUpdateTask(
  trigger: "manual" | "force" = "manual",
  options: SelfUpdateTaskOptions = {}
): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("self-update");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有更新任务正在执行，已复用当前任务。", "info");
    return { task: runningTask, reused: true };
  }

  const task = createTask("self-update", "更新 ClawOS", 3);
  task.status = "running";

  (async () => {
    try {
      task.step = 1;
      appendTaskLog(task, `步骤 1/3：检查更新（触发方式：${trigger === "force" ? "强制" : "手动"}）`);

      const status = await getSelfUpdateStatus(true);
      if (!status.supported) {
        throw new Error(status.reason || "当前环境不支持自动更新。");
      }
      if (status.error) {
        throw new Error(status.error);
      }

      appendTaskLog(task, `当前版本：${status.currentVersion || "unknown"}`);
      if (status.channel) {
        appendTaskLog(task, `更新通道：${status.channel}`);
      }
      if (status.currentHash) {
        appendTaskLog(task, `当前构建哈希：${status.currentHash.slice(0, 12)}...`);
      }
      if (status.remoteVersion) {
        appendTaskLog(task, `远端版本：${status.remoteVersion}`);
      }
      if (status.remoteHash) {
        appendTaskLog(task, `远端构建哈希：${status.remoteHash.slice(0, 12)}...`);
      }

      if (!status.hasUpdate) {
        appendTaskLog(task, "版本一致，无需更新。");
        task.step = task.totalSteps;
        task.status = "success";
        task.endedAt = new Date().toISOString();
        clearSelfUpdateStatusCache();
        return;
      }

      task.step = 2;
      appendTaskLog(task, "步骤 2/3：下载更新包");

      const autoRestart = options.autoRestart !== false;
      const { onStatus } = attachUpdaterLogs(task);

      const result = await runSelfUpdate({
        applyUpdate: autoRestart,
        onStatus,
        beforeApply: autoRestart
          ? () => {
              task.step = 3;
              appendTaskLog(task, "步骤 3/3：应用更新并重启");
              appendTaskLog(task, "更新包已就绪，正在应用更新并重启 ClawOS。");
              task.status = "success";
              task.endedAt = new Date().toISOString();
              clearSelfUpdateStatusCache();
            }
          : undefined,
      });

      if (!result.updateAvailable) {
        appendTaskLog(task, "检查完成：当前已是最新版本。");
        task.step = task.totalSteps;
        task.status = "success";
        task.endedAt = new Date().toISOString();
        clearSelfUpdateStatusCache();
        return;
      }

      if (!autoRestart) {
        task.step = 3;
        appendTaskLog(task, "步骤 3/3：下载完成（未自动重启）");
        if (result.readyToApply) {
          appendTaskLog(task, "更新包已下载并就绪。下次执行“更新并重启”将应用新版本。");
        } else {
          appendTaskLog(task, "更新包已下载，但尚未就绪，请稍后再次执行更新。");
        }
        task.status = "success";
        task.endedAt = new Date().toISOString();
        clearSelfUpdateStatusCache();
        return;
      }

      if (task.status !== "success") {
        task.step = task.totalSteps;
        appendTaskLog(task, "更新已完成，应用将自动重启。");
        task.status = "success";
        task.endedAt = new Date().toISOString();
        clearSelfUpdateStatusCache();
      }
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
    }
  })();

  return { task, reused: false };
}
