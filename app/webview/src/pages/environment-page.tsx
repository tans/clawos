import { useEffect, useRef, useState } from "react";
import { Hammer, RefreshCw, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  fetchEnvironmentStatus,
  fetchMcpStatus,
  fetchTask,
  readUserErrorMessage,
  startEnvironmentInstall,
  startMcpBuild,
  type EnvironmentStatus,
  type McpTargetStatus,
  type TaskRecord,
} from "../lib/api";

const ENV_TARGETS: Array<"windows" | "wsl"> = ["windows", "wsl"];
const ENV_TOOLS: Array<"python" | "uv" | "bun"> = ["python", "uv", "bun"];
const MCP_NAMES = ["windows-mcp", "yingdao-mcp", "wechat-mcp"];

function readTaskStatus(task: TaskRecord): string {
  if (task.status === "running" || task.status === "pending") return "执行中";
  if (task.status === "success") return "已完成";
  if (task.status === "failed") return "失败";
  return "未知";
}

function toolLabel(tool: string): string {
  if (tool === "python") return "Python";
  if (tool === "uv") return "uv";
  return "bun";
}

function targetLabel(target: string): string {
  return target === "windows" ? "Windows" : "WSL";
}

function readToolVersion(status: EnvironmentStatus, target: "windows" | "wsl", tool: "python" | "uv" | "bun"): string | null {
  const value = status[target]?.[tool];
  if (value?.installed !== true) {
    return null;
  }
  return value.version?.trim() || "已安装";
}

export function EnvironmentPage() {
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus>({});
  const [mcpTargets, setMcpTargets] = useState<McpTargetStatus[]>([]);
  const [meta, setMeta] = useState("正在读取环境状态...");
  const [taskMeta, setTaskMeta] = useState("当前无任务");
  const [taskOutput, setTaskOutput] = useState("操作日志会显示在这里...");
  const [busyKey, setBusyKey] = useState("");
  const taskTimerRef = useRef<number | null>(null);

  function stopTaskPolling() {
    if (taskTimerRef.current !== null) {
      window.clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
  }

  function renderTask(task: TaskRecord) {
    setTaskMeta(`${task.title} | ${readTaskStatus(task)}`);
    const lines = (task.logs || []).map((item) => `[${item.timestamp}] ${String(item.level || "info").toUpperCase()} ${item.message}`);
    setTaskOutput(lines.join("\n") || "暂无日志");
  }

  function startTaskPolling(taskId: string, onSuccess?: () => Promise<void> | void) {
    stopTaskPolling();
    const tick = async () => {
      try {
        const task = await fetchTask(taskId);
        renderTask(task);
        if (task.status === "success" || task.status === "failed") {
          stopTaskPolling();
          if (task.status === "success" && onSuccess) {
            await onSuccess();
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

  async function loadEnvironment(silent = false) {
    if (!silent) {
      setMeta("正在读取环境状态...");
    }
    try {
      const status = await fetchEnvironmentStatus();
      setEnvironmentStatus(status);
      setMeta("环境状态已刷新");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取环境状态失败"));
    }
  }

  async function loadMcp(silent = false) {
    if (!silent) {
      setMeta("正在读取 MCP 状态...");
    }
    try {
      const targets = await fetchMcpStatus();
      setMcpTargets(targets);
      setMeta("MCP 状态已刷新");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取 MCP 状态失败"));
    }
  }

  useEffect(() => {
    void Promise.all([loadEnvironment(false), loadMcp(true)]);
    return () => {
      stopTaskPolling();
    };
  }, []);

  async function runInstall(target: "windows" | "wsl", tool: "python" | "uv" | "bun") {
    const actionKey = `${target}:${tool}`;
    setBusyKey(actionKey);
    setTaskMeta("任务启动中...");
    setTaskOutput("任务启动中...");
    try {
      const data = await startEnvironmentInstall(target, tool);
      startTaskPolling(data.taskId, async () => {
        await loadEnvironment(true);
      });
      setMeta(`${targetLabel(target)} / ${toolLabel(tool)} 安装任务已启动`);
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "安装请求失败"));
      setMeta(readUserErrorMessage(error, "安装请求失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function runBuild(name: string) {
    const actionKey = `mcp:${name}`;
    setBusyKey(actionKey);
    setTaskMeta("任务启动中...");
    setTaskOutput("任务启动中...");
    try {
      const data = await startMcpBuild(name);
      startTaskPolling(data.taskId, async () => {
        await loadMcp(true);
      });
      setMeta(`${name} 构建任务已启动`);
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "MCP 构建失败"));
      setMeta(readUserErrorMessage(error, "MCP 构建失败"));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>环境安装</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="dual-column-grid">
            {ENV_TARGETS.map((target) => (
              <section key={target} className="field-card field-card-vertical">
                <div className="field-copy">
                  <h3>{targetLabel(target)}</h3>
                </div>
                <div className="stack-compact">
                  {ENV_TOOLS.map((tool) => {
                    const installedVersion = readToolVersion(environmentStatus, target, tool);
                    const actionKey = `${target}:${tool}`;
                    return (
                      <div key={tool} className="metric-row">
                        <div>
                          <strong>{toolLabel(tool)}</strong>
                          <p>{installedVersion ? installedVersion : "未安装"}</p>
                        </div>
                        {installedVersion ? (
                          <span className="badge-soft">已安装</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyKey === actionKey}
                            onClick={() => void runInstall(target, tool)}
                          >
                            <Wrench size={14} />
                            {busyKey === actionKey ? "执行中..." : "安装"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="settings-actions settings-actions-start">
            <Button variant="outline" onClick={() => void loadEnvironment(false)}>
              <RefreshCw size={14} />
              刷新环境
            </Button>
            <Button variant="outline" onClick={() => void loadMcp(false)}>
              <RefreshCw size={14} />
              刷新 MCP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="stack-compact">
            {MCP_NAMES.map((name) => {
              const target = mcpTargets.find((item) => item.name === name);
              const actionKey = `mcp:${name}`;
              const statusText = !target
                ? "检查中..."
                : target.scriptExists !== true
                  ? "未检测到 build 脚本"
                  : target.built
                    ? "已构建"
                    : "未构建";
              return (
                <div key={name} className="metric-row">
                  <div>
                    <strong>{name}</strong>
                    <p>{statusText}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busyKey === actionKey} onClick={() => void runBuild(name)}>
                    <Hammer size={14} />
                    {busyKey === actionKey ? "执行中..." : "构建"}
                  </Button>
                </div>
              );
            })}
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
          <pre className="log-console">{taskOutput}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
