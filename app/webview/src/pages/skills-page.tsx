import { useEffect, useState } from "react";
import { ArrowUpRight, Cpu, Sparkles, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { fetchConfigSection, readUserErrorMessage, saveConfigSection } from "../lib/api";
import { openOpenclawSkillsConfig } from "../lib/desktop";

const FULL_PERMISSION_TOOLS_CONFIG = {
  profile: "full",
};

export function SkillsPage() {
  const [toolsRaw, setToolsRaw] = useState("{}");
  const [toolsPermissionAll, setToolsPermissionAll] = useState(false);
  const [skillsRedirectStatus, setSkillsRedirectStatus] = useState("点击按钮后将打开 openclaw 后台 Skills 配置页");
  const [meta, setMeta] = useState("正在读取功能配置...");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const toolsData = await fetchConfigSection<Record<string, unknown>>("tools");
        setToolsRaw(JSON.stringify(toolsData || {}, null, 2));
        setToolsPermissionAll((toolsData.profile as string | undefined) === "full");
        setMeta("MCP 技能中心已加载");
      } catch (error) {
        setMeta(readUserErrorMessage(error, "读取功能配置失败"));
      }
    }

    void load();
  }, []);

  function applyToolsToggle() {
    const nextConfig = toolsPermissionAll ? FULL_PERMISSION_TOOLS_CONFIG : {};
    setToolsRaw(JSON.stringify(nextConfig, null, 2));
  }

  useEffect(() => {
    applyToolsToggle();
  }, [toolsPermissionAll]);

  async function saveTools() {
    setBusyKey("save-tools");
    try {
      const parsed = JSON.parse(toolsRaw) as Record<string, unknown>;
      const payload = toolsPermissionAll ? FULL_PERMISSION_TOOLS_CONFIG : parsed;
      await saveConfigSection("tools", payload);
      setMeta("Tools 已保存");
      setToolsRaw(JSON.stringify(payload, null, 2));
    } catch (error) {
      setMeta(readUserErrorMessage(error, "保存 Tools 失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function gotoOpenclawSkills() {
    setBusyKey("open-openclaw-skills");
    try {
      await openOpenclawSkillsConfig();
      setSkillsRedirectStatus("已打开 openclaw 后台，请在后台完成 Skills 配置。");
    } catch (error) {
      setSkillsRedirectStatus(readUserErrorMessage(error, "打开 openclaw 后台失败"));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>MCP 技能中心</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="meta-banner">强化我们自研 MCP 技能，优先接入业务自动化与系统控制能力。</div>
          <div className="triple-grid">
            {[
              { title: "Windows MCP", desc: "桌面控制、进程操作与系统任务自动化。" },
              { title: "影刀 MCP", desc: "RPA 场景对接，提升企业流程执行效率。" },
              { title: "微信 MCP", desc: "企业微信场景联动，支持消息与客服协同。" },
              { title: "CRM MCP", desc: "客户数据协同，连接销售与服务闭环。" },
            ].map((item) => (
              <div key={item.title} className="field-card field-card-vertical">
                <div className="migration-item">
                  <Cpu size={18} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                  </div>
                </div>
                <span className="badge-soft">自研 MCP 技能</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="skills-panel-grid">
        <Card className="skills-card">
          <CardHeader>
            <CardTitle>Tools 设置</CardTitle>
          </CardHeader>
          <CardContent className="settings-stack">
            <label className="toggle-card">
              <div>
                <strong>开放所有权限</strong>
              </div>
              <Switch checked={toolsPermissionAll} onCheckedChange={setToolsPermissionAll} />
            </label>
            <label className="input-group">
              <span>Tools JSON</span>
              <textarea className="field-textarea skills-json" value={toolsRaw} onChange={(event) => setToolsRaw(event.target.value)} />
            </label>
            <Button disabled={busyKey === "save-tools"} onClick={() => void saveTools()}>
              <Wrench size={14} />
              {busyKey === "save-tools" ? "保存中..." : "保存 Tools"}
            </Button>
          </CardContent>
        </Card>

        <Card className="skills-card">
          <CardHeader>
            <CardTitle>Skills 配置入口</CardTitle>
          </CardHeader>
          <CardContent className="settings-stack">
            <label className="toggle-card">
              <div>
                <strong>统一跳转 openclaw 后台管理</strong>
                <p>App 内不再直接编辑 Skills，客户点击后将进入 openclaw 后台完成配置。</p>
              </div>
              <Sparkles size={16} />
            </label>
            <Button disabled={busyKey === "open-openclaw-skills"} onClick={() => void gotoOpenclawSkills()}>
              <ArrowUpRight size={14} />
              {busyKey === "open-openclaw-skills" ? "打开中..." : "前往 openclaw 后台配置 Skills"}
            </Button>
            <div className="meta-banner">{skillsRedirectStatus}</div>
          </CardContent>
        </Card>
      </div>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
