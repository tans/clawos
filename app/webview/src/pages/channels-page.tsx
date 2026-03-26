import { useEffect, useRef, useState } from "react";
import { ExternalLink, MessageCircleMore, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  fetchConfigSection,
  fetchQwGatewayStatus,
  fetchWeixinLoginState,
  readUserErrorMessage,
  saveChannelConfig,
  startGatewayAction,
  startWeixinLogin,
  type QwGatewayStatus,
  type WeixinLoginState,
} from "../lib/api";
import { openExternalUrl } from "../lib/desktop";

type ChannelToggleState = {
  enable?: boolean;
  enabled?: boolean;
};

type ChannelsSection = {
  feishu?: ChannelToggleState & {
    appId?: string;
    secret?: string;
    appSecret?: string;
  };
  wework?: ChannelToggleState;
  "openclaw-weixin"?: ChannelToggleState;
};

function normalizeEnabled(value: ChannelToggleState | undefined): boolean {
  return value?.enable === true || value?.enabled === true;
}

function readWeixinLoginUrl(state: WeixinLoginState | null | undefined): string {
  const loginUrl = typeof state?.loginUrl === "string" ? state.loginUrl.trim() : "";
  if (loginUrl) {
    return loginUrl;
  }
  return typeof state?.qrDataUrl === "string" ? state.qrDataUrl.trim() : "";
}

function gatewayStatusText(status: QwGatewayStatus | null): string {
  if (!status) return "未读取企业微信网关状态";
  const base =
    status.state === "running"
      ? "企业微信网关重启中"
      : status.state === "success"
        ? "最近一次重启成功"
        : status.state === "failed"
          ? "最近一次重启失败"
          : status.state === "unsupported"
            ? "当前系统不支持企业微信网关"
            : "尚未执行企业微信网关重启";
  const source = status.source === "startup" ? "启动时触发" : status.source === "manual" ? "手动触发" : "";
  const message = status.message?.trim() || "";
  return [base, source, message].filter(Boolean).join(" | ");
}

function weixinStatusText(state: WeixinLoginState | null): string {
  if (!state) {
    return "默认关闭。开启微信模块后会自动获取扫码登录链接并尝试打开系统浏览器。";
  }
  if (state.phase === "connected") {
    return state.accountId ? `微信已连接，账号：${state.accountId}` : "微信已连接。";
  }
  if (state.phase === "failed") {
    return state.message?.trim() || "微信登录失败，请重新获取登录链接。";
  }
  return state.message?.trim() || "登录流程已启动，正在等待微信链接输出。";
}

export function ChannelsPage() {
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [weworkEnabled, setWeworkEnabled] = useState(false);
  const [weixinEnabled, setWeixinEnabled] = useState(false);
  const [feishuAppId, setFeishuAppId] = useState("");
  const [feishuSecret, setFeishuSecret] = useState("");
  const [gatewayStatus, setGatewayStatus] = useState<QwGatewayStatus | null>(null);
  const [weixinLoginState, setWeixinLoginState] = useState<WeixinLoginState | null>(null);
  const [meta, setMeta] = useState("正在加载...");
  const [busyKey, setBusyKey] = useState("");
  const gatewayTimerRef = useRef<number | null>(null);
  const weixinTimerRef = useRef<number | null>(null);
  const lastAutoOpenedWeixinUrlRef = useRef("");

  const weixinLoginUrl = readWeixinLoginUrl(weixinLoginState);
  const canOpenWeixinInBrowser = /^https?:\/\//i.test(weixinLoginUrl);

  function stopGatewayPolling() {
    if (gatewayTimerRef.current !== null) {
      window.clearTimeout(gatewayTimerRef.current);
      gatewayTimerRef.current = null;
    }
  }

  function stopWeixinPolling() {
    if (weixinTimerRef.current !== null) {
      window.clearTimeout(weixinTimerRef.current);
      weixinTimerRef.current = null;
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

  async function refreshWeixinState(sessionKey?: string) {
    try {
      const state = await fetchWeixinLoginState(sessionKey);
      setWeixinLoginState(state);
      return state;
    } catch {
      return null;
    }
  }

  async function maybeAutoOpenWeixinLoginUrl(state: WeixinLoginState | null, source: string): Promise<boolean> {
    const loginUrl = readWeixinLoginUrl(state);
    if (!/^https?:\/\//i.test(loginUrl)) {
      return false;
    }
    if (lastAutoOpenedWeixinUrlRef.current === loginUrl) {
      return false;
    }

    lastAutoOpenedWeixinUrlRef.current = loginUrl;
    console.info("[weixin-login] auto open browser", { source, loginUrl });
    try {
      await openExternalUrl(loginUrl);
      setMeta("已在系统浏览器打开微信扫码页面，请继续完成登录。");
      return true;
    } catch (error) {
      console.error("[weixin-login] open browser failed", { source, loginUrl, error });
      setMeta(readUserErrorMessage(error, "已获取微信登录链接，请点击“打开浏览器扫码”继续。"));
      return false;
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

  async function pollWeixinState(sessionKey: string) {
    stopWeixinPolling();
    const tick = async () => {
      const state = await refreshWeixinState(sessionKey);
      await maybeAutoOpenWeixinLoginUrl(state, "poll");
      if (state?.phase === "waiting") {
        weixinTimerRef.current = window.setTimeout(() => {
          void tick();
        }, 2000);
      }
    };
    await tick();
  }

  async function loadChannels() {
    setMeta("正在读取渠道配置...");
    try {
      const [channels, status, weixinState] = await Promise.all([
        fetchConfigSection<ChannelsSection>("channels"),
        refreshGatewayStatus(),
        refreshWeixinState(),
      ]);
      const isWeixinEnabled = normalizeEnabled(channels["openclaw-weixin"]);
      setFeishuEnabled(normalizeEnabled(channels.feishu));
      setWeworkEnabled(normalizeEnabled(channels.wework));
      setWeixinEnabled(isWeixinEnabled);
      setFeishuAppId(channels.feishu?.appId?.trim() || "");
      setFeishuSecret((channels.feishu?.secret || channels.feishu?.appSecret || "").trim());
      setGatewayStatus(status);
      setWeixinLoginState(weixinState);
      setMeta(isWeixinEnabled ? "微信模块当前处于开启状态，如需重新扫码请点击“重新获取登录链接”。" : "渠道配置已加载");

      if (status?.state === "running") {
        void pollGatewayStatus();
      }
      if (weixinState?.phase === "waiting" && typeof weixinState.sessionKey === "string" && weixinState.sessionKey.trim()) {
        void pollWeixinState(weixinState.sessionKey);
        void maybeAutoOpenWeixinLoginUrl(weixinState, "load");
      }
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取渠道配置失败"));
    }
  }

  useEffect(() => {
    void loadChannels();
    return () => {
      stopGatewayPolling();
      stopWeixinPolling();
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

  async function beginWeixinLogin(force = false) {
    setBusyKey(force ? "weixin-refresh" : "weixin-toggle");
    try {
      const state = await startWeixinLogin(force);
      setWeixinEnabled(true);
      setWeixinLoginState(state);
      if (state.sessionKey) {
        void pollWeixinState(state.sessionKey);
      }

      if (await maybeAutoOpenWeixinLoginUrl(state, force ? "refresh" : "toggle")) {
        return;
      }

      setMeta(state.message?.trim() || "微信登录流程已启动，正在等待登录链接输出...");
    } finally {
      setBusyKey("");
    }
  }

  async function saveWeixinToggle(nextValue: boolean) {
    setWeixinEnabled(nextValue);
    if (nextValue) {
      try {
        await beginWeixinLogin(false);
      } catch (error) {
        setWeixinLoginState(null);
        setMeta(readUserErrorMessage(error, "启动微信扫码登录失败"));
      }
      return;
    }

    stopWeixinPolling();
    lastAutoOpenedWeixinUrlRef.current = "";
    setBusyKey("weixin-toggle");
    try {
      await saveChannelConfig("openclaw-weixin", { enable: false });
      setWeixinLoginState(null);
      setMeta("微信模块已关闭");
    } catch (error) {
      setWeixinEnabled(true);
      setMeta(readUserErrorMessage(error, "关闭微信模块失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function restartGateway() {
    setBusyKey("gateway-restart");
    try {
      const data = await startGatewayAction("restart-qw-gateway");
      setMeta(data.reused ? "已复用当前企业微信网关重启任务" : "企业微信网关重启任务已启动");
      await pollGatewayStatus();
    } catch (error) {
      setMeta(readUserErrorMessage(error, "重启企业微信网关失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function openWeixinInBrowser() {
    if (!weixinLoginUrl || !canOpenWeixinInBrowser) {
      setMeta("当前登录链接无法在系统浏览器中打开。");
      return;
    }
    setBusyKey("weixin-open");
    try {
      await openExternalUrl(weixinLoginUrl);
      lastAutoOpenedWeixinUrlRef.current = weixinLoginUrl;
      setMeta("已在系统浏览器打开微信登录页面");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "打开微信登录页面失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function refreshWeixinLogin() {
    try {
      await beginWeixinLogin(true);
    } catch (error) {
      setMeta(readUserErrorMessage(error, "重新获取微信登录链接失败"));
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

          <section className="field-card field-card-vertical">
            <div className="channel-head">
              <div className="channel-mark">
                <MessageCircleMore size={16} />
              </div>
              <div className="field-copy">
                <h3>微信</h3>
                <p>默认关闭。开启后自动调用 `openclaw-weixin` 登录流程，截取扫码链接并尝试直接打开系统浏览器。</p>
              </div>
              <Switch checked={weixinEnabled} onCheckedChange={saveWeixinToggle} disabled={busyKey === "weixin-toggle"} />
            </div>
            <div className="stack-compact">
              <div className="meta-banner">{weixinStatusText(weixinLoginState)}</div>

              {weixinEnabled ? (
                <div className="weixin-login-panel">
                  <div className="weixin-login-actions">
                    <Button variant="outline" size="sm" disabled={busyKey === "weixin-refresh"} onClick={() => void refreshWeixinLogin()}>
                      <RefreshCw size={14} />
                      {busyKey === "weixin-refresh" ? "获取中..." : "重新获取登录链接"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyKey === "weixin-open" || !canOpenWeixinInBrowser}
                      onClick={() => void openWeixinInBrowser()}
                    >
                      <ExternalLink size={14} />
                      {busyKey === "weixin-open" ? "打开中..." : "打开浏览器扫码"}
                    </Button>
                  </div>

                  {weixinLoginState?.phase === "connected" && weixinLoginState.accountId ? (
                    <div className="meta-banner">当前已连接账号：{weixinLoginState.accountId}</div>
                  ) : null}

                  {weixinLoginUrl ? (
                    <div className="meta-banner weixin-login-link">{weixinLoginUrl}</div>
                  ) : weixinLoginState?.phase === "waiting" ? (
                    <div className="meta-banner">暂未获取到登录链接，后台会继续等待输出，也可以点击“重新获取登录链接”。</div>
                  ) : null}

                  <p className="weixin-login-caption">如果 20 到 30 秒内还没有自动弹出浏览器，请查看日志并手动点击“打开浏览器扫码”。</p>
                </div>
              ) : null}
            </div>
          </section>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
