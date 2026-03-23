import { useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useTaskLogCenter } from "../components/task-log-center";
import {
  fetchQwGatewayStatus,
  fetchRecentTasks,
  fetchTask,
  readUserErrorMessage,
  startGatewayAction,
  startGatewayUpdate,
  type QwGatewayStatus,
  type TaskRecord,
} from "../lib/api";
import { openOpenclawConsole } from "../lib/desktop";

const STATUS_TEXT: Record<string, string> = {
  pending: "等待中",
  running: "执行中",
  success: "已完成",
  failed: "失败",
  idle: "空闲",
  unsupported: "不支持",
};

export function DashboardPage() {
  const logCenter = useTaskLogCenter();
  const [gatewayStatus, setGatewayStatus] = useState<QwGatewayStatus>({});
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [taskMeta, setTaskMeta] = useState("暂无任务");
  const [busyAction, setBusyAction] = useState<string>("");
  const gatewayTimerRef = useRef<number | null>(null);
  const taskTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const [status, tasks] = await Promise.all([fetchQwGatewayStatus(), fetchRecentTasks()]);
        if (!active) {
          return;
        }
        setGatewayStatus(status);

        const nextTask = tasks.find((item) => item.status === "running" || item.status === "pending") || tasks[0] || null;
        if (nextTask) {
          setTask(nextTask);
          setTaskMeta(buildTaskMeta(nextTask));
          startTaskPolling(nextTask.id);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setTaskMeta(readUserErrorMessage(error, "控制台初始化失败"));
      }
    }

    void loadInitial();
    startGatewayPolling();

    return () => {
      active = false;
      stopGatewayPolling();
      stopTaskPolling();
    };
  }, []);

  function buildTaskMeta(currentTask: TaskRecord): string {
    const statusText = STATUS_TEXT[currentTask.status] || "未知";
    return `${currentTask.title} | ${statusText} | ${currentTask.step}/${currentTask.totalSteps}`;
  }

  function stopGatewayPolling() {
    if (gatewayTimerRef.current !== null) {
      window.clearInterval(gatewayTimerRef.current);
      gatewayTimerRef.current = null;
    }
  }

  function startGatewayPolling() {
    stopGatewayPolling();
    const tick = async () => {
      try {
        const status = await fetchQwGatewayStatus();
        setGatewayStatus(status);
      } catch {
        // keep previous status
      }
    };
    void tick();
    gatewayTimerRef.current = window.setInterval(tick, 4000);
  }

  function stopTaskPolling() {
    if (taskTimerRef.current !== null) {
      window.clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
  }

  function startTaskPolling(taskId: string) {
    stopTaskPolling();

    const tick = async () => {
      try {
        const nextTask = await fetchTask(taskId);
        setTask(nextTask);
        setTaskMeta(buildTaskMeta(nextTask));
        logCenter.reportTask("dashboard", nextTask, buildTaskMeta(nextTask));
        if (nextTask.status === "success" || nextTask.status === "failed") {
          stopTaskPolling();
        }
      } catch (error) {
        stopTaskPolling();
        setTaskMeta(readUserErrorMessage(error, "任务状态刷新失败"));
      }
    };

    void tick();
    taskTimerRef.current = window.setInterval(tick, 1000);
  }

  async function handleAction(action: "restart-gateway" | "restart-qw-gateway" | "update-openclaw") {
    setBusyAction(action);
    try {
      const data =
        action === "update-openclaw"
          ? await startGatewayUpdate()
          : await startGatewayAction(action === "restart-gateway" ? "restart" : "restart-qw-gateway");

      if (data.taskId) {
        setTaskMeta(data.reused ? "已复用当前任务" : "任务已启动");
        logCenter.startTask("dashboard", {
          taskId: data.taskId,
          title: action === "update-openclaw" ? "升级 openclaw" : action === "restart-gateway" ? "重启 openclaw" : "重启 qw gateway",
        });
        startTaskPolling(data.taskId);
      }
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "操作失败"));
    } finally {
      setBusyAction("");
    }
  }

  const quickActions = [
    { key: "openclaw-entry", title: "启动 openclaw", icon: ArrowRight, variant: "default" as const },
    { key: "restart-gateway", title: "重启 openclaw", icon: RefreshCw, variant: "secondary" as const },
    { key: "update-openclaw", title: "升级 openclaw", icon: ShieldAlert, variant: "ghost" as const },
  ] as const;

  const gatewayStateText = STATUS_TEXT[gatewayStatus.state || "idle"] || String(gatewayStatus.state || "未知");
  const gatewayMessage = gatewayStatus.message?.trim() || "等待状态更新...";
  return (
    <>
      <section className="status-strip">
        <div>
          <span className="status-label">版本</span>
          <strong>v0.9.44</strong>
        </div>
        <div>
          <span className="status-label">执行环境</span>
          <strong>Windows / WSL</strong>
        </div>
        <div>
          <span className="status-label">网关状态</span>
          <strong>{gatewayStateText}</strong>
        </div>
      </section>

      <section className="content-grid">
        <Card className="feature-panel">
          <CardHeader>
            <CardTitle>常用动作</CardTitle>
            <CardDescription>{gatewayMessage}</CardDescription>
          </CardHeader>
          <CardContent className="feature-stack">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.key} className="action-row">
                  <div>
                    <h3>{action.title}</h3>
                  </div>
                  <Button
                    variant={action.variant}
                    onClick={() => {
                      if (action.key === "openclaw-entry") {
                        void openOpenclawConsole().catch((error) => {
                          setTaskMeta(readUserErrorMessage(error, "打开 openclaw Console 失败"));
                        });
                        return;
                      }
                      void handleAction(action.key as "restart-gateway" | "restart-qw-gateway" | "update-openclaw");
                    }}
                    disabled={busyAction === action.key}
                  >
                    <Icon size={14} />
                    {busyAction === action.key ? "执行中..." : "执行"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="log-panel">
          <CardHeader>
            <CardTitle>任务日志</CardTitle>
            <CardDescription>{taskMeta}</CardDescription>
          </CardHeader>
          <CardContent className="migration-list">
            <Button variant="outline" onClick={() => logCenter.openCenter(task?.id)}>
              打开日志中心
            </Button>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
