import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  fetchClawosAutoStart,
  fetchLocalSettings,
  readUserErrorMessage,
  saveClawosAutoStart,
  saveLocalSettings,
  type AutoStartState,
} from "../lib/api";

export function SettingsPage() {
  const [token, setToken] = useState("xiake");
  const [controllerAddress, setControllerAddress] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartState, setAutoStartState] = useState<AutoStartState>({});
  const [meta, setMeta] = useState("正在读取设置...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAutoStart, setIsSavingAutoStart] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [settings, state] = await Promise.all([fetchLocalSettings(), fetchClawosAutoStart()]);
        if (!active) {
          return;
        }

        setToken(typeof settings.openclawToken === "string" ? settings.openclawToken : "xiake");
        setControllerAddress(typeof settings.controllerAddress === "string" ? settings.controllerAddress : "");
        setCompanyAddress(
          typeof settings.companyAddress === "string"
            ? settings.companyAddress
            : settings.companyBaseUrl || settings.farmAddress || settings.farmBaseUrl || ""
        );
        setAutoStartState(state);
        setAutoStart(Boolean(state.enabled));
        setMeta("设置已加载");
      } catch (error) {
        if (!active) {
          return;
        }
        setMeta(readUserErrorMessage(error, "初始化失败"));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleReload(): Promise<void> {
    setIsLoading(true);
    setMeta("正在读取设置...");
    try {
      const [settings, state] = await Promise.all([fetchLocalSettings(), fetchClawosAutoStart()]);
      setToken(typeof settings.openclawToken === "string" ? settings.openclawToken : "xiake");
      setControllerAddress(typeof settings.controllerAddress === "string" ? settings.controllerAddress : "");
      setCompanyAddress(
        typeof settings.companyAddress === "string"
          ? settings.companyAddress
          : settings.companyBaseUrl || settings.farmAddress || settings.farmBaseUrl || ""
      );
      setAutoStartState(state);
      setAutoStart(Boolean(state.enabled));
      setMeta("设置已刷新");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "读取失败"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(): Promise<void> {
    const trimmedToken = token.trim();
    const trimmedControllerAddress = controllerAddress.trim();
    const trimmedCompanyAddress = companyAddress.trim();

    if (!trimmedToken) {
      setMeta("openclaw Token 不能为空");
      return;
    }

    if (trimmedControllerAddress && !/^0x[a-fA-F0-9]{40}$/.test(trimmedControllerAddress)) {
      setMeta("授权控制地址格式不合法");
      return;
    }

    setIsSaving(true);
    setMeta("正在保存设置...");
    try {
      const settings = await saveLocalSettings({
        openclawToken: trimmedToken,
        controllerAddress: trimmedControllerAddress,
        companyAddress: trimmedCompanyAddress,
      });
      setToken(typeof settings.openclawToken === "string" ? settings.openclawToken : trimmedToken);
      setControllerAddress(typeof settings.controllerAddress === "string" ? settings.controllerAddress : trimmedControllerAddress);
      setCompanyAddress(
        typeof settings.companyAddress === "string"
          ? settings.companyAddress
          : settings.companyBaseUrl || settings.farmAddress || settings.farmBaseUrl || trimmedCompanyAddress
      );
      setMeta("设置已保存");
    } catch (error) {
      setMeta(readUserErrorMessage(error, "保存失败"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAutoStartChange(next: boolean): Promise<void> {
    setAutoStart(next);
    setIsSavingAutoStart(true);
    setMeta("正在保存开机自启动...");
    try {
      const state = await saveClawosAutoStart(next);
      setAutoStartState(state);
      setAutoStart(Boolean(state.enabled));
      setMeta("开机自启动已更新");
    } catch (error) {
      setAutoStart(!next);
      setMeta(readUserErrorMessage(error, "保存失败"));
    } finally {
      setIsSavingAutoStart(false);
    }
  }

  const autoStartSupported = autoStartState.supported !== false;
  const autoStartDescription = !autoStartSupported ? "当前系统不支持" : autoStart ? "已启用" : "未启用";

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>服务参数</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="field-card">
            <div className="field-copy">
              <h3>openclaw Token</h3>
            </div>
            <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="xiake" disabled={isLoading || isSaving} />
          </section>

          <section className="field-card">
            <div className="field-copy">
              <h3>授权控制地址</h3>
            </div>
            <Input
              value={controllerAddress}
              onChange={(event) => setControllerAddress(event.target.value)}
              placeholder="0x..."
              disabled={isLoading || isSaving}
            />
          </section>

          <section className="field-card">
            <div className="field-copy">
              <h3>Company 通讯地址</h3>
            </div>
            <Input
              value={companyAddress}
              onChange={(event) => setCompanyAddress(event.target.value)}
              placeholder="https://..."
              disabled={isLoading || isSaving}
            />
          </section>

          <section className="field-card">
            <div className="field-copy">
              <h3>开机后自动启动 ClawOS</h3>
            </div>
            <div className="switch-row">
              <Switch checked={autoStart} onCheckedChange={handleAutoStartChange} disabled={!autoStartSupported || isSavingAutoStart || isLoading} />
              <span>{autoStartDescription}</span>
            </div>
          </section>

          <div className="settings-actions">
            <Button variant="outline" onClick={() => void handleReload()} disabled={isLoading || isSaving || isSavingAutoStart}>
              重新加载
            </Button>
            <Button onClick={() => void handleSave()} disabled={isLoading || isSaving}>
              {isSaving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
