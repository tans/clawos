import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import {
  clearSelfUpdateStatusCache,
  downloadUpdateExecutable,
  getSelfUpdateStatus,
  resolveSelfExecutableOrThrow,
  scheduleWindowsExecutableReplacement,
} from "../system/self-update";

export function startSelfUpdateTask(trigger: "manual" | "force" = "manual"): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("self-update");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有更新任务正在执行，已复用当前任务。", "info");
    return { task: runningTask, reused: true };
  }

  const task = createTask("self-update", "更新 ClawOS", 4);
  task.status = "running";

  (async () => {
    try {
      task.step = 1;
      appendTaskLog(task, `步骤 1/4：拉取更新清单（触发方式：${trigger === "force" ? "强制" : "手动"}）`);
      const status = await getSelfUpdateStatus(true);

      if (!status.supported) {
        throw new Error(status.reason || "当前环境不支持自更新。");
      }
      if (status.error) {
        throw new Error(`拉取更新清单失败：${status.error}`);
      }
      if (!status.downloadUrl) {
        throw new Error("更新清单缺少下载地址。");
      }

      appendTaskLog(task, `当前版本：${status.currentVersion}`);
      appendTaskLog(task, `远端版本：${status.remoteVersion || "unknown"}`);

      if (!status.hasUpdate) {
        appendTaskLog(task, "版本一致，无需更新。");
        task.step = task.totalSteps;
        task.status = "success";
        task.endedAt = new Date().toISOString();
        return;
      }

      task.step = 2;
      appendTaskLog(task, "步骤 2/4：下载更新文件");
      const targetExecutablePath = resolveSelfExecutableOrThrow();
      const formatBytes = (bytes: number): string => {
        if (!Number.isFinite(bytes) || bytes <= 0) {
          return "0 B";
        }
        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
          value /= 1024;
          unitIndex += 1;
        }
        const precision = unitIndex === 0 ? 0 : 1;
        return `${value.toFixed(precision)} ${units[unitIndex]}`;
      };

      let lastLoggedPercent = -1;
      let lastLoggedBytes = 0;
      let lastLoggedAt = 0;
      const downloaded = await downloadUpdateExecutable(status.downloadUrl, targetExecutablePath, {
        onProgress(progress) {
          const now = Date.now();
          if (progress.totalBytes && progress.percent !== null) {
            const currentPercent = Math.max(0, Math.min(100, progress.percent));
            const shouldLog =
              currentPercent === 100 ||
              currentPercent >= lastLoggedPercent + 5 ||
              now - lastLoggedAt >= 1_500;
            if (!shouldLog || currentPercent === lastLoggedPercent) {
              return;
            }
            lastLoggedPercent = currentPercent;
            lastLoggedAt = now;
            appendTaskLog(
              task,
              `下载进度：${currentPercent}%（${formatBytes(progress.receivedBytes)} / ${formatBytes(progress.totalBytes)}）`
            );
            return;
          }

          const shouldLog = progress.receivedBytes - lastLoggedBytes >= 2 * 1024 * 1024 || now - lastLoggedAt >= 1_500;
          if (!shouldLog) {
            return;
          }
          lastLoggedBytes = progress.receivedBytes;
          lastLoggedAt = now;
          appendTaskLog(task, `下载进度：${formatBytes(progress.receivedBytes)}`);
        },
      });
      appendTaskLog(task, `下载完成：${downloaded.filePath} (${downloaded.sizeBytes} bytes)`);

      task.step = 3;
      appendTaskLog(task, "步骤 3/4：计划替换当前可执行文件（重命名旧文件后替换）");
      const replacementPlan = scheduleWindowsExecutableReplacement(downloaded.filePath, targetExecutablePath, process.pid);
      appendTaskLog(task, `目标文件：${replacementPlan.targetPath}`);
      appendTaskLog(task, `备份文件：${replacementPlan.backupPath}`);
      appendTaskLog(task, `替换日志：${replacementPlan.logPath}`);
      appendTaskLog(task, "更新脚本已启动：将在当前进程退出后执行替换。");

      task.step = 4;
      appendTaskLog(task, "步骤 4/4：等待手动重启");
      appendTaskLog(task, "请关闭并重新打开 ClawOS，更新将在退出后完成替换并在下次启动生效。");
      task.status = "success";
      task.endedAt = new Date().toISOString();
      clearSelfUpdateStatusCache();
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
