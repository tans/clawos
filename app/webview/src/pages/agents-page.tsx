import { useEffect, useState } from "react";
import { Bot, Save } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { fetchConfigSection, readUserErrorMessage, saveConfigSection } from "../lib/api";

type ProviderDraft = {
  providerKey: string;
  title: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  modelId: string;
  primary: boolean;
  fallback: boolean;
  enabled: boolean;
};

const PRESETS: ProviderDraft[] = [
  { providerKey: "kimi", title: "Kimi API", baseUrl: "https://api.moonshot.cn/v1", api: "openai-completions", apiKey: "", modelId: "moonshot-v1-8k", primary: false, fallback: false, enabled: true },
  { providerKey: "kimi-coding", title: "Kimi Code Plan", baseUrl: "https://api.kimi.com/coding/", api: "anthropic-messages", apiKey: "", modelId: "k2p5", primary: false, fallback: false, enabled: true },
  { providerKey: "minimax-cn", title: "MiniMax", baseUrl: "https://api.minimaxi.com/anthropic", api: "anthropic-messages", apiKey: "", modelId: "MiniMax-M2.5", primary: false, fallback: false, enabled: true },
  { providerKey: "freegpt", title: "FreeGPT Echo", baseUrl: "https://freegpt.minapp.xin/v1", api: "openai-completions", apiKey: "freeforclawos", modelId: "freegpt-echo", primary: false, fallback: true, enabled: false },
];

function parseProviderModel(raw: unknown): { provider: string; model: string } | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  const slashIndex = text.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= text.length - 1) return null;
  return {
    provider: text.slice(0, slashIndex).trim(),
    model: text.slice(slashIndex + 1).trim(),
  };
}

export function AgentsPage() {
  const [drafts, setDrafts] = useState<ProviderDraft[]>(PRESETS);
  const [meta, setMeta] = useState("正在读取代理配置...");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [modelsData, agentsData] = await Promise.all([
          fetchConfigSection<Record<string, unknown>>("models"),
          fetchConfigSection<Record<string, unknown>>("agents"),
        ]);

        const providers = typeof modelsData.providers === "object" && modelsData.providers ? (modelsData.providers as Record<string, any>) : {};
        const defaults = typeof agentsData.defaults === "object" && agentsData.defaults ? (agentsData.defaults as Record<string, any>) : {};
        const modelConfig = typeof defaults.model === "object" && defaults.model ? (defaults.model as Record<string, any>) : {};
        const primaryRef = parseProviderModel(modelConfig.primary);
        const fallbackRefs = Array.isArray(modelConfig.fallbacks)
          ? (modelConfig.fallbacks.map((item) => parseProviderModel(item)).filter(Boolean) as Array<{ provider: string; model: string }>)
          : [];

        const sourceKeys = new Set([...Object.keys(providers), ...PRESETS.map((item) => item.providerKey)]);
        const nextDrafts = Array.from(sourceKeys).map((providerKey) => {
          const preset = PRESETS.find((item) => item.providerKey === providerKey);
          const provider = typeof providers[providerKey] === "object" && providers[providerKey] ? providers[providerKey] : {};
          const models = Array.isArray(provider.models) ? provider.models : [];
          const firstModel = models.find((item: any) => item && typeof item.id === "string");
          return {
            providerKey,
            title: preset?.title || providerKey,
            baseUrl: (typeof provider.baseUrl === "string" ? provider.baseUrl : preset?.baseUrl) || "",
            api: (typeof provider.api === "string" ? provider.api : preset?.api) || "",
            apiKey: typeof provider.apiKey === "string" ? provider.apiKey : preset?.apiKey || "",
            modelId:
              primaryRef?.provider === providerKey
                ? primaryRef.model
                : fallbackRefs.find((item) => item.provider === providerKey)?.model || firstModel?.id || preset?.modelId || "",
            primary: primaryRef?.provider === providerKey,
            fallback: fallbackRefs.some((item) => item.provider === providerKey) || providerKey === "freegpt",
            enabled: providerKey === "freegpt" ? Boolean(providers[providerKey]) || fallbackRefs.some((item) => item.provider === providerKey) : true,
          } satisfies ProviderDraft;
        });

        if (!nextDrafts.some((item) => item.primary) && nextDrafts[0]) {
          nextDrafts[0].primary = true;
          nextDrafts[0].fallback = false;
        }
        setDrafts(nextDrafts);
        setMeta("代理配置已加载");
      } catch (error) {
        setMeta(readUserErrorMessage(error, "读取代理配置失败"));
      }
    }

    void load();
  }, []);

  function updateDraft(providerKey: string, patch: Partial<ProviderDraft>) {
    setDrafts((current) =>
      current.map((item) => {
        if (item.providerKey !== providerKey) return item;
        const next = { ...item, ...patch };
        if (next.primary) {
          next.fallback = false;
        }
        return next;
      })
    );
  }

  function setPrimary(providerKey: string) {
    setDrafts((current) =>
      current.map((item) => ({
        ...item,
        primary: item.providerKey === providerKey,
        fallback: item.providerKey === providerKey ? false : item.fallback,
      }))
    );
  }

  async function saveProvider(providerKey: string) {
    const target = drafts.find((item) => item.providerKey === providerKey);
    const primary = drafts.find((item) => item.primary);
    if (!target || !primary) {
      setMeta("缺少主模型配置");
      return;
    }
    setBusyKey(providerKey);
    try {
      const activeDrafts = drafts.filter((item) => item.providerKey !== "freegpt" || item.enabled);
      const providers = Object.fromEntries(
        activeDrafts.map((item) => [
          item.providerKey,
          {
            baseUrl: item.baseUrl.trim(),
            api: item.api.trim(),
            apiKey: item.apiKey.trim() || undefined,
            models: [{ id: item.modelId.trim(), name: item.modelId.trim() }],
          },
        ])
      );
      const fallbacks = activeDrafts
        .filter((item) => item.providerKey !== primary.providerKey && item.fallback && item.modelId.trim())
        .map((item) => `${item.providerKey}/${item.modelId.trim()}`);

      await Promise.all([
        saveConfigSection("models", { providers }),
        saveConfigSection("agents", {
          defaults: {
            model: {
              primary: `${primary.providerKey}/${primary.modelId.trim()}`,
              fallbacks,
            },
          },
        }),
      ]);
      setMeta(`${target.title} 已保存`);
    } catch (error) {
      setMeta(readUserErrorMessage(error, "保存代理配置失败"));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="settings-layout">
      <Card>
        <CardHeader>
          <CardTitle>模型路由</CardTitle>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="dual-column-grid">
            {drafts.map((item) => (
              <section key={item.providerKey} className="field-card field-card-vertical">
                <div className="channel-head">
                  <div className="channel-mark">
                    <Bot size={16} />
                  </div>
                  <div className="field-copy">
                    <h3>{item.title}</h3>
                    <p>{item.providerKey}</p>
                  </div>
                  {item.providerKey === "freegpt" ? (
                    <Switch checked={item.enabled} onCheckedChange={(checked) => updateDraft(item.providerKey, { enabled: checked, fallback: checked })} />
                  ) : null}
                </div>

                {item.providerKey !== "freegpt" ? (
                  <div className="dual-column-grid">
                    <label className="toggle-card">
                      <span>主模型</span>
                      <Switch checked={item.primary} onCheckedChange={() => setPrimary(item.providerKey)} />
                    </label>
                    <label className="toggle-card">
                      <span>备用</span>
                      <Switch checked={item.fallback} onCheckedChange={(checked) => updateDraft(item.providerKey, { fallback: checked })} disabled={item.primary} />
                    </label>
                  </div>
                ) : (
                  <div className="meta-banner">fallback</div>
                )}

                <div className="stack-compact">
                  <label className="input-group">
                    <span>Base URL</span>
                    <Input value={item.baseUrl} onChange={(event) => updateDraft(item.providerKey, { baseUrl: event.target.value })} disabled={item.providerKey === "freegpt"} />
                  </label>
                  <label className="input-group">
                    <span>API</span>
                    <Input value={item.api} onChange={(event) => updateDraft(item.providerKey, { api: event.target.value })} disabled={item.providerKey === "freegpt"} />
                  </label>
                  <label className="input-group">
                    <span>当前模型</span>
                    <Input value={item.modelId} onChange={(event) => updateDraft(item.providerKey, { modelId: event.target.value })} disabled={item.providerKey === "freegpt"} />
                  </label>
                  <label className="input-group">
                    <span>API Key</span>
                    <Input type="password" value={item.apiKey} onChange={(event) => updateDraft(item.providerKey, { apiKey: event.target.value })} disabled={item.providerKey === "freegpt"} />
                  </label>
                </div>

                <Button variant="outline" size="sm" disabled={busyKey === item.providerKey} onClick={() => void saveProvider(item.providerKey)}>
                  <Save size={14} />
                  {busyKey === item.providerKey ? "保存中..." : "保存"}
                </Button>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="meta-banner">{meta}</div>
    </div>
  );
}
