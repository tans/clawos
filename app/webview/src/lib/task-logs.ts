import type { TaskLogEntry, TaskRecord } from "./api";

function normalizeLevel(level?: string): string {
  const value = String(level || "info").trim();
  return value ? value.toUpperCase() : "INFO";
}

export function formatTaskLogs(logs?: TaskLogEntry[]): string {
  if (!Array.isArray(logs) || logs.length === 0) {
    return "暂无日志";
  }
  return logs
    .map((item) => `[${item.timestamp}] ${normalizeLevel(item.level)} ${item.message}`)
    .join("\n");
}

export function readTaskStatusLabel(status?: string): string {
  if (status === "running" || status === "pending") return "执行中";
  if (status === "success") return "已完成";
  if (status === "failed") return "失败";
  return "未知";
}

export function buildDefaultTaskMeta(task: TaskRecord): string {
  const statusText = readTaskStatusLabel(task.status);
  if (Number.isFinite(task.totalSteps) && task.totalSteps > 0) {
    return `${task.title} | ${statusText} | ${task.step}/${task.totalSteps}`;
  }
  return `${task.title} | ${statusText}`;
}
