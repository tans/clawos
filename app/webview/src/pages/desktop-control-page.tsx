import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useTaskLogCenter } from "../components/task-log-center";
import { Switch } from "../components/ui/switch";
import {
  fetchDesktopMcpStatus,
  fetchTask,
  readUserErrorMessage,
  startDesktopMcp,
  stopDesktopMcp,
  type DesktopMcpStatus,
  type TaskRecord,
} from "../lib/api";

function readTaskStatus(task: TaskRecord): string {
  if (task.status === "running") return "运行中";
  if (task.status === "success") return "已完成";
  if (task.status === "failed") return "失败";
  return "等待中";
}

export function DesktopControlPage() {
  const logCenter = useTaskLogCenter();
  const [status, setStatus] = useState<DesktopMcpStatus>({});
  const [meta, setMeta] = useState("正在读取 MCP 状态...");
  const [taskMeta, setTaskMeta] = useState("等待启动");
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  function stopPolling() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function renderTask(task: TaskRecord) {
    const nextMeta = `任务状态 | ${readTaskStatus(task)}`;
    setTaskMeta(nextMeta);
    logCenter.reportTask("desktop-control", task, nextMeta);
  }

  function applyStatus(nextStatus: DesktopMcpStatus) {
    setStatus(nextStatus);
    const host = nextStatus.host || "0.0.0.0";
    const port = Number.isFinite(nextStatus.port) ? nextStatus.port : 8100;
    setMeta(nextStatus.running ? `MCP 已启动 | ${host}:${port}` : `MCP 未启动 | ${host}:${port}`);
  }

  function pollTask(taskId: string) {
    stopPolling();
    const tick = async () => {
      try {
        const task = await fetchTask(taskId);
        renderTask(task);
        if (task.status === "success" || task.status === "failed") {
          stopPolling();
        }
      } catch (error) {
        stopPolling();
        setTaskMeta(readUserErrorMessage(error, "MCP 日志刷新失败"));
      }
    };
    void tick();
    timerRef.current = window.setInterval(tick, 1000);
  }

  async function loadStatus() {
    try {
      const nextStatus = await fetchDesktopMcpStatus();
      applyStatus(nextStatus);
      if (nextStatus.taskId) {
        pollTask(nextStatus.taskId);
      } else {
        stopPolling();
      }
    } catch (error) {
      setMeta(readUserErrorMessage(error, "MCP 状态初始化失败"));
    }
  }

  useEffect(() => {
    void loadStatus();
    return () => {
      stopPolling();
    };
  }, []);

  async function handleToggle(nextRunning: boolean) {
    const previousStatus = status;
    setBusy(true);
    setStatus((current) => ({ ...current, running: nextRunning }));
    setMeta(nextRunning ? "正在启动 MCP..." : "正在关闭 MCP...");
    setTaskMeta(nextRunning ? "正在提交启动请求..." : "正在提交关闭请求...");
    try {
      const data = nextRunning ? await startDesktopMcp() : await stopDesktopMcp();
      applyStatus(data.status || {});
      if (data.task) {
        renderTask(data.task);
      }
      if (nextRunning && data.taskId) {
        logCenter.startTask("desktop-control", {
          taskId: data.taskId,
          title: "桌面 MCP 启动",
        });
        pollTask(data.taskId);
      } else {
        stopPolling();
      }
    } catch (error) {
      applyStatus(previousStatus);
      setMeta(readUserErrorMessage(error, nextRunning ? "MCP 启动失败" : "MCP 关闭失败"));
    } finally {
      setBusy(false);
    }
  }

  const host = status.host || "0.0.0.0";
  const port = Number.isFinite(status.port) ? status.port : 8100;
  const url = status.url?.trim() || `http://${host}:${port}/mcp`;

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>桌面控制</CardTitle>
          <CardDescription>{taskMeta}</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <label className="toggle-card">
            <div>
              <strong>桌面 MCP 服务</strong>
              <p>{meta}</p>
            </div>
            <Switch checked={Boolean(status.running)} onCheckedChange={(checked) => void handleToggle(checked)} disabled={busy} />
          </label>
          <div className="meta-banner">{`接口: ${url}`}</div>
        </CardContent>
      </Card>
    </div>
  );
}
