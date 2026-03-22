import { useEffect, useRef, useState } from "react";
import { MessageCircleMore, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  fetchConfigSection,
  fetchQwGatewayStatus,
  saveChannelConfig,
  readUserErrorMessage,
  startGatewayAction,
  type QwGatewayStatus,
} from "../lib/api";

type ChannelsSection = {
  feishu?: {
    enable?: boolean;
    enabled?: boolean;
    appId?: string;
    secret?: string;
    appSecret?: string;
  };
  wework?: {
    enable?: boolean;
    enabled?: boolean;
  };
};

function normalizeEnabled(value: { enable?: boolean; enabled?: boolean } | undefined): boolean {
  return value?.enable === true || value?.enabled === true;
}

function gatewayStatusText(status: QwGatewayStatus | null): string {
  if (!status) return "未检测";
  const base =
    status.state === "running"
      ? "重启中"
      : status.state === "success"
        ? "最近一次成功"
        : status.state === "failed"
          ? "最近一次失败"
          : status.state === "unsupported"
            ? "不支持"
            : "未执行";
  const source = status.source === "startup" ? "启动触发" : status.source === "manual" ? "手动触发" : "";
  const message = status.message?.trim() || "";
  return [base, source, message].filter(Boolean).join(" | ");
}

export function ChannelsPage() {
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [weworkEnabled, setWeworkEnabled] = useState(false);
  const [feishuAppId, setFeishuAppId] = useState("");
  const [feishuSecret, setFeishuSecret] = useState("");
  const [gatewayStatus, setGatewayStatus] = useState<QwGatewayStatus | null>(null);
  const [meta, setMeta] = useState("加载中...");
  const [busyKey, setBusyKey] = useState("");
  const gatewayTimerRef = useRef<number | null>(null);

  function stopGatewayPolling() {
    if (gatewayTimerRef.current !== null) {
      window.clearTimeout(gatewayTimerRef.current);
      gatewayTimerRef.current = null;
    }
  }

  async function refreshGatewayStatus() {
    try {
      const status = await fetchQwGatewayStatus();
      setGatewayStatus(status);
      return status;
    } catch {
      return null;
    }
  }

  async function pollGatewayStatus() {
    stopGatewayPolling();
    const tick = async () => {
      const status = await refreshGatewayStatus();
      if (status?.state === "running") {
        gatewayTimerRef.current = window.setTimeout(() => {
          void tick();
        }, 1000);
      }
    };
    await tick();
  }

  async function loadChannels() {
    setMeta("正在读取渠道配置...");
    try {
      const [channels, status] = await Promise.all([fetchConfigSection<ChannelsSection>("channels"), refreshGatewayStatus()]);
      setFeishuEnabled(normalizeEnabled(channels.feishu));
      setWeworkEnabled(normalizeEnabled(channels.wework));
      setFeishuAppId(channels.feishu?.appId?.trim() || "");
      setFeishuSecret((channels.feishu?.secret || channels.feishu?.appSecret || "").trim());
      setGatewayStatus(status);
      setMeta("渠道配置已加载");
      if (status?.state === "running") {
        void pollGatewayStatus();
      }
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取渠道配置失败"));
    }
  }

  useEffect(() => {
    void loadChannels();
    return () => {
      stopGatewayPolling();
    };
  }, []);

  async function saveFeishuToggle(nextValue: boolean) {
    setFeishuEnabled(nextValue);
    setBusyKey("feishu-toggle");
    try {
      await saveChannelConfig("feishu", {
        enable: nextValue,
        appId: feishuAppId.trim(),
        secret: feishuSecret.trim(),
      });
      setMeta("飞书开关已保存");
    } catch (error) {
      setFeishuEnabled(!nextValue);
      setMeta(readUserErrorMessage(error, "保存飞书开关失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function saveFeishuFields() {
    setBusyKey("feishu-save");
    try {
      await saveChannelConfig("feishu", {
        enable: feishuEnabled,
        appId: feishuAppId.trim(),
        secret: feishuSecret.trim(),
      });
      setMeta("飞书参数已保存");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "保存飞书参数失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function saveWeworkToggle(nextValue: boolean) {
    setWeworkEnabled(nextValue);
    setBusyKey("wework-toggle");
    try {
      await saveChannelConfig("wework", { enable: nextValue });
      setMeta("企业微信开关已保存");
    } catch (error) {
      setWeworkEnabled(!nextValue);
      setMeta(readUserErrorMessage(error, "保存企业微信开关失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function restartGateway() {
    setBusyKey("gateway-restart");
    try {
      const data = await startGatewayAction("restart-qw-gateway");
      setMeta(data.reused ? "已复用当前任务" : "网关重启任务已启动");
      await pollGatewayStatus();
    } catch (error) {
      setMeta(readUserErrorMessage(error, "重启企业微信网关失败"));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>渠道</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="dual-column-grid">
            <section className="field-card field-card-vertical">
              <div className="channel-head">
                <div className="channel-mark">
                  <Send size={16} />
                </div>
                <div className="field-copy">
                  <h3>飞书</h3>
                </div>
                <Switch checked={feishuEnabled} onCheckedChange={saveFeishuToggle} disabled={busyKey === "feishu-toggle"} />
              </div>
              <div className="stack-compact">
                <label className="input-group">
                  <span>appId</span>
                  <Input value={feishuAppId} onChange={(event) => setFeishuAppId(event.target.value)} placeholder="输入飞书 appId" />
                </label>
                <label className="input-group">
                  <span>secret</span>
                  <Input
                    type="password"
                    value={feishuSecret}
                    onChange={(event) => setFeishuSecret(event.target.value)}
                    placeholder="输入飞书 secret"
                  />
                </label>
                <Button variant="outline" size="sm" disabled={busyKey === "feishu-save"} onClick={() => void saveFeishuFields()}>
                  <ShieldCheck size={14} />
                  {busyKey === "feishu-save" ? "保存中..." : "保存参数"}
                </Button>
              </div>
            </section>

            <section className="field-card field-card-vertical">
              <div className="channel-head">
                <div className="channel-mark">
                  <MessageCircleMore size={16} />
                </div>
                <div className="field-copy">
                  <h3>企业微信</h3>
                </div>
                <Switch checked={weworkEnabled} onCheckedChange={saveWeworkToggle} disabled={busyKey === "wework-toggle"} />
              </div>
              <div className="stack-compact">
                <div className="meta-banner">{gatewayStatusText(gatewayStatus)}</div>
                <div className="settings-actions settings-actions-start">
                  <Button variant="outline" size="sm" onClick={() => void refreshGatewayStatus()}>
                    <RefreshCw size={14} />
                    刷新状态
                  </Button>
                  <Button size="sm" disabled={busyKey === "gateway-restart"} onClick={() => void restartGateway()}>
                    <RotateCcw size={14} />
                    {busyKey === "gateway-restart" ? "执行中..." : "重启企微网关"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
