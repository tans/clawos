import { useEffect, useState } from "react";
import { Search, Sparkles, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import {
  activateClawhubSkill,
  fetchConfigSection,
  readUserErrorMessage,
  saveConfigSection,
  searchClawhubSkills,
  type ClawhubSearchItem,
} from "../lib/api";

const FULL_PERMISSION_TOOLS_CONFIG = {
  profile: "full",
};

export function SkillsPage() {
  const [toolsRaw, setToolsRaw] = useState("{}");
  const [skillsRaw, setSkillsRaw] = useState("{}");
  const [toolsPermissionAll, setToolsPermissionAll] = useState(false);
  const [skillsWatch, setSkillsWatch] = useState(false);
  const [skillsWatchDebounceMs, setSkillsWatchDebounceMs] = useState("300");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<ClawhubSearchItem[]>([]);
  const [clawhubStatus, setClawhubStatus] = useState("未搜索");
  const [meta, setMeta] = useState("正在读取功能配置...");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [toolsData, skillsData] = await Promise.all([
          fetchConfigSection<Record<string, unknown>>("tools"),
          fetchConfigSection<Record<string, unknown>>("skills"),
        ]);
        setToolsRaw(JSON.stringify(toolsData || {}, null, 2));
        setSkillsRaw(JSON.stringify(skillsData || {}, null, 2));
        setToolsPermissionAll((toolsData.profile as string | undefined) === "full");
        const loadConfig = typeof skillsData.load === "object" && skillsData.load ? (skillsData.load as Record<string, unknown>) : {};
        setSkillsWatch(loadConfig.watch === true);
        setSkillsWatchDebounceMs(typeof loadConfig.watchDebounceMs === "number" ? String(loadConfig.watchDebounceMs) : "300");
        setMeta("功能配置已加载");
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

  async function saveSkills() {
    setBusyKey("save-skills");
    try {
      const parsed = JSON.parse(skillsRaw) as Record<string, unknown>;
      const payload = {
        ...parsed,
        load: {
          ...(typeof parsed.load === "object" && parsed.load ? (parsed.load as Record<string, unknown>) : {}),
          watch: skillsWatch,
          watchDebounceMs: Number(skillsWatchDebounceMs || "0"),
        },
      };
      await saveConfigSection("skills", payload);
      setMeta("Skills 已保存");
      setSkillsRaw(JSON.stringify(payload, null, 2));
    } catch (error) {
      setMeta(readUserErrorMessage(error, "保存 Skills 失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function runSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setClawhubStatus("请输入搜索词");
      return;
    }
    setBusyKey("search");
    try {
      const items = await searchClawhubSkills(query);
      setSearchItems(items);
      setClawhubStatus(items.length > 0 ? `共找到 ${items.length} 个技能` : `未找到 ${query}`);
    } catch (error) {
      setClawhubStatus(readUserErrorMessage(error, "搜索失败"));
    } finally {
      setBusyKey("");
    }
  }

  async function runActivate(skill: string) {
    setBusyKey(`activate:${skill}`);
    try {
      const result = await activateClawhubSkill(skill);
      const nextSkills = (result.data || {}) as Record<string, unknown>;
      setSkillsRaw(JSON.stringify(nextSkills, null, 2));
      setClawhubStatus(`已激活 ${skill}`);
    } catch (error) {
      setClawhubStatus(readUserErrorMessage(error, "激活技能失败"));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="settings-layout">
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
            <CardTitle>Skills 设置</CardTitle>
          </CardHeader>
          <CardContent className="settings-stack">
            <label className="toggle-card">
              <div>
                <strong>监听技能目录</strong>
              </div>
              <Switch checked={skillsWatch} onCheckedChange={setSkillsWatch} />
            </label>
            <label className="input-group">
              <span>watchDebounceMs</span>
              <Input value={skillsWatchDebounceMs} onChange={(event) => setSkillsWatchDebounceMs(event.target.value)} />
            </label>
            <label className="input-group">
              <span>Skills JSON</span>
              <textarea className="field-textarea skills-json" value={skillsRaw} onChange={(event) => setSkillsRaw(event.target.value)} />
            </label>
            <Button disabled={busyKey === "save-skills"} onClick={() => void saveSkills()}>
              <Sparkles size={14} />
              {busyKey === "save-skills" ? "保存中..." : "保存 Skills"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ClawHub</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="browser-action-row skills-search-row">
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索技能" />
            <Button variant="outline" disabled={busyKey === "search"} onClick={() => void runSearch()}>
              <Search size={14} />
              {busyKey === "search" ? "搜索中..." : "搜索"}
            </Button>
          </div>
          <div className="meta-banner">{clawhubStatus}</div>
          <div className="stack-compact">
            {searchItems.length > 0 ? (
              searchItems.map((item, index) => {
                const skillId = (item.skill || item.name || item.title || `skill-${index}`).trim();
                return (
                  <div key={skillId} className="metric-row">
                    <div>
                      <strong>{item.title || item.name || skillId}</strong>
                      {item.description ? <p>{item.description}</p> : null}
                    </div>
                    <Button size="sm" disabled={busyKey === `activate:${skillId}`} onClick={() => void runActivate(skillId)}>
                      {busyKey === `activate:${skillId}` ? "激活中..." : "激活"}
                    </Button>
                  </div>
                );
              })
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="meta-banner">{meta}</div>
    </div>
  );
}
