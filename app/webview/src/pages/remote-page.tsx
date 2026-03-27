import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useTaskLogCenter } from "../components/task-log-center";
import {
  dispatchRemoteAction,
  fetchRemoteCatalog,
  readUserErrorMessage,
  type RemoteCatalogItem,
  type RemoteDispatchResponse,
} from "../lib/api";

const DEFAULT_ENV_INSTALL_PAYLOAD = '{"target":"wsl","tool":"python"}';
const DEFAULT_MCP_BUILD_PAYLOAD = '{"name":"windows-mcp"}';

function defaultPayloadText(intent: string): string {
  if (intent === "environment.install") return DEFAULT_ENV_INSTALL_PAYLOAD;
  if (intent === "mcp.build") return DEFAULT_MCP_BUILD_PAYLOAD;
  return "{}";
}

function readPayloadHint(item: RemoteCatalogItem | null): string {
  if (!item?.payloadSchema || Object.keys(item.payloadSchema).length === 0) {
    return "该动作不需要额外 payload。";
  }
  return `payload schema: ${JSON.stringify(item.payloadSchema)}`;
}

export function RemotePage() {
  const logCenter = useTaskLogCenter();
  const [catalog, setCatalog] = useState<RemoteCatalogItem[]>([]);
  const [allowedExecutors, setAllowedExecutors] = useState<string[]>([]);
  const [intent, setIntent] = useState("gateway.restart");
  const [payloadText, setPayloadText] = useState("{}");
  const [meta, setMeta] = useState("正在读取 remote 路由能力...");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<RemoteDispatchResponse | null>(null);

  const selectedItem = useMemo(() => catalog.find((item) => item.actionIntent === intent) || null, [catalog, intent]);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchRemoteCatalog();
        setCatalog(data.actions || []);
        setAllowedExecutors(data.executors || []);
        const firstIntent = data.actions?.[0]?.actionIntent || "gateway.restart";
        setIntent(firstIntent);
        setPayloadText(defaultPayloadText(firstIntent));
        setMeta("remote 路由能力已加载");
      } catch (error) {
        setMeta(readUserErrorMessage(error, "加载 remote 路由能力失败"));
      }
    }

    void load();
  }, []);

  function parsePayload(): Record<string, unknown> {
    const raw = payloadText.trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload 必须是 JSON 对象");
    }
    return parsed as Record<string, unknown>;
  }

  async function runDispatch(dryRun: boolean) {
    setBusy(true);
    setMeta(dryRun ? "正在请求远程计划（dry-run）..." : "正在请求远程计划并执行...");
    try {
      const payload = parsePayload();
      const result = await dispatchRemoteAction({ actionIntent: intent, payload, dryRun });
      setResponse(result);
      const taskIds = result.execution?.taskIds || [];
      const uiCommands = result.execution?.uiCommands || [];

      if (taskIds.length > 0) {
        for (const taskId of taskIds) {
          logCenter.startTask("remote", {
            taskId,
            title: `远程动作 ${intent}`,
            taskMeta: "任务已创建，等待执行日志...",
          });
        }
      }

      if (uiCommands.includes("open-log-center")) {
        logCenter.openCenter(taskIds[0]);
      }

      setMeta(
        dryRun
          ? `计划预览完成，步骤数：${result.plan.steps.length}`
          : `执行完成，任务数：${taskIds.length}，UI 指令数：${uiCommands.length}`
      );
    } catch (error) {
      setMeta(readUserErrorMessage(error, "remote 调用失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>Remote 指令路由</CardTitle>
          <CardDescription>按钮 → 上报动作与环境 → 获取远程 commandPlan → 本地执行</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="field-card field-card-vertical">
            <label className="input-group">
              <span>actionIntent</span>
              <select
                className="field-input"
                value={intent}
                onChange={(event) => {
                  const nextIntent = event.target.value;
                  setIntent(nextIntent);
                  setPayloadText(defaultPayloadText(nextIntent));
                }}
              >
                {catalog.length > 0 ? (
                  catalog.map((item) => (
                    <option key={item.actionIntent} value={item.actionIntent}>
                      {item.actionIntent} | {item.title}
                    </option>
                  ))
                ) : (
                  <option value="gateway.restart">gateway.restart</option>
                )}
              </select>
            </label>
            <div className="meta-banner">{readPayloadHint(selectedItem)}</div>

            <label className="input-group">
              <span>payload(JSON)</span>
              <textarea className="field-textarea" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
            </label>

            <label className="input-group">
              <span>允许执行器</span>
              <Input readOnly value={allowedExecutors.join(" / ") || "shell / powershell / wsl"} />
            </label>

            <div className="settings-actions settings-actions-start">
              <Button variant="outline" disabled={busy} onClick={() => void runDispatch(true)}>
                <RefreshCw size={14} />
                Dry Run
              </Button>
              <Button disabled={busy} onClick={() => void runDispatch(false)}>
                <Send size={14} />
                执行
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => logCenter.openCenter()}>
                <Play size={14} />
                打开日志中心
              </Button>
            </div>
          </section>

          {response ? (
            <section className="field-card field-card-vertical">
              <div className="field-copy">
                <h3>返回结果</h3>
              </div>
              <pre className="log-console" style={{ maxHeight: 360 }}>{JSON.stringify(response, null, 2)}</pre>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
