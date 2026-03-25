import { useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Save, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useTaskLogCenter } from "../components/task-log-center";
import {
  fetchConfigSection,
  fetchTask,
  readUserErrorMessage,
  saveConfigSection,
  startBrowserAction,
  type TaskRecord,
} from "../lib/api";

const DEFAULT_BROWSER_CDP_PORT = 9222;

const actionMap = [
  { key: "detect", title: "检测", icon: Activity, variant: "outline" as const },
  { key: "repair", title: "修复", icon: Wrench, variant: "outline" as const },
  { key: "open-cdp", title: "打开 CDP", icon: RefreshCw, variant: "default" as const },
] as const;

type BrowserSection = Record<string, unknown> & {
  cdpUrl?: string;
};

function normalizeBrowserPort(config: BrowserSection): number {
  const rawUrl = typeof config.cdpUrl === "string" ? config.cdpUrl.trim() : "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const inferred = Number(parsed.port);
      if (Number.isInteger(inferred) && inferred >= 1 && inferred <= 65535) {
        return inferred;
      }
    } catch {
      // Ignore invalid URL input and fall back to the default port.
    }
  }

  return DEFAULT_BROWSER_CDP_PORT;
}

function buildBrowserCdpUrl(config: BrowserSection, cdpPort: number): string {
  const rawUrl = typeof config.cdpUrl === "string" ? config.cdpUrl.trim() : "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.protocol = parsed.protocol === "https:" || parsed.protocol === "wss:" ? "https:" : "http:";
      parsed.port = String(cdpPort);
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      // Fall through to the default local endpoint when the saved URL is malformed.
    }
  }

  return `http://127.0.0.1:${cdpPort}/`;
}

function formatTaskStatus(task: TaskRecord): string {
  if (task.status === "running" || task.status === "pending") {
    return "执行中";
  }
  if (task.status === "success") {
    return "已完成";
  }
  if (task.status === "failed") {
    return "失败";
  }
  return "未知";
}

export function BrowserPage() {
  const logCenter = useTaskLogCenter();
  const [browserConfig, setBrowserConfig] = useState<BrowserSection>({});
  const [cdpPortInput, setCdpPortInput] = useState(String(DEFAULT_BROWSER_CDP_PORT));
  const [taskMeta, setTaskMeta] = useState("正在读取浏览器设置...");
  const [busyKey, setBusyKey] = useState("");
  const taskTimerRef = useRef<number | null>(null);

  function stopTaskPolling() {
    if (taskTimerRef.current !== null) {
      window.clearInterval(taskTimerRef.current);
      taskTimerRef.current = null;
    }
  }

  function renderTask(task: TaskRecord) {
    const nextMeta = `${task.title} | ${formatTaskStatus(task)}`;
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
          void loadBrowserConfig(false);
        }
      } catch (error) {
        stopTaskPolling();
        setTaskMeta(readUserErrorMessage(error, "任务状态刷新失败"));
      }
    };

    void tick();
    taskTimerRef.current = window.setInterval(tick, 1000);
  }

  async function loadBrowserConfig(showLoadingMeta = true) {
    if (showLoadingMeta) {
      setTaskMeta("正在读取浏览器设置...");
    }

    try {
      const nextConfig = await fetchConfigSection<BrowserSection>("browser");
      setBrowserConfig(nextConfig);
      setCdpPortInput(String(normalizeBrowserPort(nextConfig)));
      if (showLoadingMeta) {
        setTaskMeta("浏览器设置已加载");
      }
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "读取浏览器设置失败"));
    }
  }

  useEffect(() => {
    void loadBrowserConfig(true);
    return () => {
      stopTaskPolling();
    };
  }, []);

  async function reloadBrowserConfig() {
    setBusyKey("reload-config");
    try {
      await loadBrowserConfig(true);
    } finally {
      setBusyKey("");
    }
  }

  async function saveBrowserPort() {
    const parsedPort = Number(cdpPortInput.trim());
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setTaskMeta("CDP 端口必须是 1-65535 的整数");
      return;
    }

    setBusyKey("save-port");
    try {
      const nextConfig: BrowserSection = {
        ...browserConfig,
        cdpUrl: buildBrowserCdpUrl(browserConfig, parsedPort),
      };
      delete nextConfig.cdpPort;
      await saveConfigSection("browser", nextConfig);
      setBrowserConfig(nextConfig);
      setCdpPortInput(String(parsedPort));
      setTaskMeta("浏览器 cdpUrl 端口已保存");
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "保存浏览器端口失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function runAction(action: (typeof actionMap)[number]["key"]) {
    setBusyKey(action);
    setTaskMeta(`正在执行 ${action}`);
    try {
      const data = await startBrowserAction(action);
      if (!data.taskId) {
        throw new Error("服务端未返回任务 ID");
      }
      logCenter.startTask("browser", {
        taskId: data.taskId,
        title: `浏览器 ${action}`,
      });
      if (data.reused) {
        setTaskMeta("已复用当前任务");
      }
      startTaskPolling(data.taskId);
    } catch (error) {
      setTaskMeta(readUserErrorMessage(error, "浏览器操作失败"));
    } finally {
      setBusyKey("");
    }
  }

  const currentCdpUrl = typeof browserConfig.cdpUrl === "string" ? browserConfig.cdpUrl.trim() : "";

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>浏览器设置</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="field-card field-card-vertical">
            <div className="field-copy">
              <h3>CDP 端口</h3>
              <p>默认端口是 9222。这里只会更新 browser.cdpUrl 的端口位；打开 CDP 时如果端口被占用，会自动尝试后续空闲端口并回写 cdpUrl。</p>
            </div>

            <div className="stack-compact">
              <label className="input-group browser-port-field">
                <span>端口</span>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  className="browser-port-input"
                  value={cdpPortInput}
                  onChange={(event) => setCdpPortInput(event.target.value)}
                  placeholder="9222"
                />
              </label>

              <div className="settings-actions settings-actions-start">
                <Button variant="outline" size="sm" disabled={busyKey === "reload-config"} onClick={() => void reloadBrowserConfig()}>
                  <RefreshCw size={14} />
                  {busyKey === "reload-config" ? "读取中..." : "重新加载"}
                </Button>
                <Button size="sm" disabled={busyKey === "save-port"} onClick={() => void saveBrowserPort()}>
                  <Save size={14} />
                  {busyKey === "save-port" ? "保存中..." : "保存端口"}
                </Button>
              </div>
            </div>
          </section>

          <div className="browser-action-row">
            {actionMap.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.key}
                  variant={action.variant}
                  onClick={() => void runAction(action.key)}
                  disabled={busyKey === action.key}
                >
                  <Icon size={14} />
                  {busyKey === action.key ? "执行中..." : action.title}
                </Button>
              );
            })}
          </div>

          {currentCdpUrl ? <div className="meta-banner">当前 cdpUrl: {currentCdpUrl}</div> : null}
          <div className="meta-banner">{taskMeta}</div>
        </CardContent>
      </Card>
    </div>
  );
}
