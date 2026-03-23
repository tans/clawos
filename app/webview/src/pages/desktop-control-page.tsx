import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useTaskLogCenter } from "../components/task-log-center";
import { fetchDesktopMcpStatus, fetchTask, readUserErrorMessage, startDesktopMcp, type DesktopMcpStatus, type TaskRecord } from "../lib/api";

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
      setStatus(nextStatus);
      const host = nextStatus.host || "0.0.0.0";
      const port = Number.isFinite(nextStatus.port) ? nextStatus.port : 8100;
      setMeta(nextStatus.running ? `MCP 已启动 | ${host}:${port}` : `MCP 未启动 | ${host}:${port}`);
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

  async function handleStart() {
    setBusy(true);
    setMeta("正在启动 MCP...");
    setTaskMeta("正在提交启动请求...");
    try {
      const data = await startDesktopMcp();
      setStatus(data.status || {});
      if (data.task) {
        renderTask(data.task);
      }
      if (data.taskId) {
        logCenter.startTask("desktop-control", {
          taskId: data.taskId,
          title: "桌面 MCP 启动",
        });
        pollTask(data.taskId);
      }
      setMeta("MCP 启动请求已提交");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "MCP 启动失败"));
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
          <div className="metric-row">
            <div>
              <strong>MCP 状态</strong>
              <p>{meta}</p>
            </div>
            <Button disabled={busy} onClick={() => void handleStart()}>
              <Play size={14} />
              {busy ? "启动中..." : "打开 MCP"}
            </Button>
          </div>
          <div className="meta-banner">{`接口: ${url}`}</div>
          <Button variant="outline" onClick={() => logCenter.openCenter()}>
            打开日志中心
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
