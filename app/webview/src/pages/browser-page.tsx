import { useRef, useState } from "react";
import { Activity, RefreshCw, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useTaskLogCenter } from "../components/task-log-center";
import { startBrowserAction, fetchTask, readUserErrorMessage, type TaskRecord } from "../lib/api";

const actionMap = [
  { key: "detect", title: "检测", icon: Activity, variant: "outline" as const },
  { key: "repair", title: "修复", icon: Wrench, variant: "outline" as const },
  { key: "open-cdp", title: "打开 CDP", icon: RefreshCw, variant: "default" as const },
] as const;

export function BrowserPage() {
  const logCenter = useTaskLogCenter();
  const [taskMeta, setTaskMeta] = useState("当前无任务");
  const [busyAction, setBusyAction] = useState("");
  const taskTimerRef = useRef<number | null>(null);

  function stopTaskPolling() {
    if (taskTimerRef.current !== null) {
      window.clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
  }

  function renderTask(task: TaskRecord) {
    const status =
      task.status === "running" || task.status === "pending"
        ? "执行中"
        : task.status === "success"
          ? "已完成"
          : task.status === "failed"
            ? "失败"
            : "未知";
    const nextMeta = `${task.title} | ${status}`;
    setTaskMeta(nextMeta);
    logCenter.reportTask("browser", task, nextMeta);
  }

  function startTaskPolling(taskId: string) {
    stopTaskPolling();
    const tick = async () => {
      try {
        const task = await fetchTask(taskId);
        renderTask(task);
        if (task.status === "success" || task.status === "failed") {
          stopTaskPolling();
        }
      } catch (error) {
        stopTaskPolling();
        setTaskMeta(readUserErrorMessage(error, "状态刷新失败"));
      }
    };

    void tick();
    taskTimerRef.current = window.setInterval(tick, 1000);
  }

  async function runAction(action: (typeof actionMap)[number]["key"]) {
    setBusyAction(action);
    setTaskMeta(`正在执行 ${action}`);
    try {
      const data = await startBrowserAction(action);
      if (!data.taskId) {
        throw new Error("服务端未返回任务 ID");
      }
      logCenter.startTask("browser", {
        taskId: data.taskId,
        title: `浏览器${action}`,
      });
      if (data.reused) {
        setTaskMeta("已复用当前任务");
      }
      startTaskPolling(data.taskId);
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "操作失败"));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>浏览器设置</CardTitle>
      </CardHeader>
      <CardContent className="settings-stack">
        <div className="browser-action-row">
          {actionMap.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.key}
                variant={action.variant}
                onClick={() => void runAction(action.key)}
                disabled={busyAction === action.key}
              >
                <Icon size={14} />
                {busyAction === action.key ? "执行中..." : action.title}
              </Button>
            );
          })}
        </div>

        <div className="meta-banner">{taskMeta}</div>
        <Button variant="outline" onClick={() => logCenter.openCenter()}>
          打开日志中心
        </Button>
      </CardContent>
    </Card>
  );
}
