import { useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useTaskLogCenter } from "../components/task-log-center";
import { fetchBackups, fetchTask, readUserErrorMessage, startBackupRollback, type BackupRecord, type TaskRecord } from "../lib/api";

function formatBackupTime(value?: number | null): string {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return "未知";
  try {
    return new Date(ts).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "未知";
  }
}

function formatBackupSize(value?: number | null): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return "未知";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function taskStatusText(task: TaskRecord): string {
  if (task.status === "running" || task.status === "pending") return "执行中";
  if (task.status === "success") return "已完成";
  if (task.status === "failed") return "失败";
  return "未知";
}

export function BackupsPage() {
  const logCenter = useTaskLogCenter();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [command, setCommand] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [meta, setMeta] = useState("正在读取备份列表...");
  const [taskMeta, setTaskMeta] = useState("暂无任务");
  const [isRollingBack, setIsRollingBack] = useState(false);
  const taskTimerRef = useRef<number | null>(null);

  const selectedBackup = backups.find((item) => item.path === selectedPath) || backups[0] || null;

  function stopTaskPolling() {
    if (taskTimerRef.current !== null) {
      window.clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
  }

  function renderTask(task: TaskRecord) {
    const nextMeta = `${task.title} | ${taskStatusText(task)} | ${task.step}/${task.totalSteps}`;
    setTaskMeta(nextMeta);
    logCenter.reportTask("backups", task, nextMeta);
  }

  function startTaskPolling(taskId: string, selectedBackupPath: string) {
    stopTaskPolling();
    const tick = async () => {
      try {
        const task = await fetchTask(taskId);
        renderTask(task);
        if (task.status === "success" || task.status === "failed") {
          stopTaskPolling();
          if (task.status === "success") {
            await loadBackups(true, selectedBackupPath);
          }
        }
      } catch (error) {
        stopTaskPolling();
        setTaskMeta(readUserErrorMessage(error, "任务状态刷新失败"));
      }
    };
    void tick();
    taskTimerRef.current = window.setInterval(tick, 1000);
  }

  async function loadBackups(silent = false, preferredPath = "") {
    if (!silent) {
      setMeta("正在读取备份列表...");
    }
    try {
      const data = await fetchBackups();
      const nextBackups = data.backups.filter((item) => item && typeof item.path === "string");
      setBackups(nextBackups);
      setCommand(data.command || null);
      const nextSelected =
        [preferredPath, selectedPath].find((path) => path && nextBackups.some((item) => item.path === path)) ||
        nextBackups[0]?.path ||
        "";
      setSelectedPath(nextSelected);
      setMeta(nextBackups.length > 0 ? `已加载 ${nextBackups.length} 个备份` : "当前没有可用备份");
      if (nextBackups.length === 0) {
        setTaskMeta("未找到配置备份");
      }
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取备份失败"));
    }
  }

  useEffect(() => {
    void loadBackups(false);
    return () => {
      stopTaskPolling();
    };
  }, []);

  async function handleRollback() {
    if (!selectedBackup) {
      setMeta("请先选择一个备份");
      return;
    }
    if (!window.confirm(`将切换到备份 ${selectedBackup.fileName}\n这会覆盖当前配置并重启服务，是否继续？`)) {
      setMeta("已取消");
      return;
    }

    setIsRollingBack(true);
    setTaskMeta("任务启动中...");
    try {
      const data = await startBackupRollback(selectedBackup.path);
      logCenter.startTask("backups", {
        taskId: data.taskId,
        title: `回滚 ${selectedBackup.fileName}`,
      });
      setMeta(data.reused ? "已复用当前任务" : "回滚任务已启动");
      startTaskPolling(data.taskId, selectedBackup.path);
    } catch (error) {
      setMeta(readUserErrorMessage(error, "回滚失败"));
      setTaskMeta(readUserErrorMessage(error, "回滚失败"));
    } finally {
      setIsRollingBack(false);
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>openclaw 配置备份</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="field-card field-card-vertical">
            <div className="field-copy">
              <h3>当前备份</h3>
            </div>
            <div className="stack-compact">
              <label className="input-group">
                <span>备份文件</span>
                <select className="field-input" value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)}>
                  {backups.length > 0 ? (
                    backups.map((backup) => (
                      <option key={backup.path} value={backup.path}>
                        {backup.fileName} | {formatBackupTime(backup.modifiedAt)}
                      </option>
                    ))
                  ) : (
                    <option value="">未找到备份</option>
                  )}
                </select>
              </label>
              <div className="dual-column-grid">
                <div className="info-tile">
                  <span>时间</span>
                  <strong>{selectedBackup ? formatBackupTime(selectedBackup.modifiedAt) : "未知"}</strong>
                </div>
                <div className="info-tile">
                  <span>大小</span>
                  <strong>{selectedBackup ? formatBackupSize(selectedBackup.size) : "未知"}</strong>
                </div>
              </div>
              {command ? <div className="meta-banner">{`命令: ${command}`}</div> : null}
            </div>
          </section>
          <div className="settings-actions settings-actions-start">
            <Button variant="outline" onClick={() => void loadBackups(false)}>
              <RefreshCw size={14} />
              刷新列表
            </Button>
            <Button disabled={!selectedBackup || isRollingBack} onClick={() => void handleRollback()}>
              <RotateCcw size={14} />
              {isRollingBack ? "执行中..." : "切换到该备份"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
      <Card>
        <CardHeader>
          <CardTitle>任务日志</CardTitle>
          <CardDescription>{taskMeta}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => logCenter.openCenter()}>
            打开日志中心
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
