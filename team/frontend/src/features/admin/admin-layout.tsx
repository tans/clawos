import { useState } from "react";
import type { TeamFrontendApi } from "../../api/client";
import { teamFrontendApi } from "../../api/client";
import type { GatewayAgent, TeamInvite } from "../../types";
import { AgentManager } from "./agent-manager";
import { CompanySettings } from "./company-settings";
import { GatewaySettings } from "./gateway-settings";
import { InviteManager } from "./invite-manager";
import { TeamManager } from "./team-manager";

const NAV_ITEMS = [
  { id: "company", label: "公司" },
  { id: "gateway", label: "网关" },
  { id: "agents", label: "Agent" },
  { id: "teams", label: "团队" },
  { id: "invites", label: "邀请" },
];

type AdminLayoutProps = {
  companyId?: string;
  api?: TeamFrontendApi;
  onTeamCreated?: (teamId: string) => void;
};

type GatewayConfigInput = {
  baseUrl: string;
  apiKey?: string;
};

type GatewayConfigPersistenceApi = {
  saveGatewayConfig?: (companyId: string, input: GatewayConfigInput) => Promise<{ ok: boolean }>;
};

function readCompanyIdFromPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = /^\/app\/admin\/([^/]+)$/.exec(window.location.pathname);
  return match?.[1] ?? null;
}

async function persistGatewayConfig(api: TeamFrontendApi, companyId: string, input: GatewayConfigInput): Promise<void> {
  const gatewayApi = api as TeamFrontendApi & GatewayConfigPersistenceApi;
  if (typeof gatewayApi.saveGatewayConfig === "function") {
    await gatewayApi.saveGatewayConfig(companyId, input);
    return;
  }

  const response = await fetch(`/api/team/admin/companies/${companyId}/gateway/config`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let errorMessage = "Gateway 配置保存失败。";
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      errorMessage = payload.message ?? payload.error ?? errorMessage;
    } catch {
      // Ignore malformed JSON and keep fallback error message.
    }
    throw new Error(errorMessage);
  }
}

export function AdminLayout({ companyId: providedCompanyId, api = teamFrontendApi, onTeamCreated }: AdminLayoutProps) {
  const companyId = providedCompanyId ?? readCompanyIdFromPath() ?? "";
  const [brandName, setBrandName] = useState("阿尔法科技");
  const [themeColor, setThemeColor] = useState("#1d4ed8");
  const [welcomeText, setWelcomeText] = useState("欢迎来到你的公司工作台");
  const [logoUrl, setLogoUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [agents, setAgents] = useState<GatewayAgent[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [primaryAgentId, setPrimaryAgentId] = useState("");
  const [usageLimit, setUsageLimit] = useState("20");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [latestInvite, setLatestInvite] = useState<TeamInvite | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runAction(action: () => Promise<void>) {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function saveGatewayConfig() {
    await persistGatewayConfig(api, companyId, {
      baseUrl,
      apiKey: apiKey || undefined,
    });
  }

  return (
    <main className="team-shell">
      <section className="admin-shell">
        <aside className="chat-sidebar">
          <p className="eyebrow">管理配置</p>
          <ul className="sidebar-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </aside>
        <div className="admin-main">
          {statusMessage ? <div className="status-banner status-success">{statusMessage}</div> : null}
          {errorMessage ? <div className="status-banner status-error">{errorMessage}</div> : null}
          <CompanySettings
            brandName={brandName}
            themeColor={themeColor}
            welcomeText={welcomeText}
            logoUrl={logoUrl}
            onBrandNameChange={setBrandName}
            onThemeColorChange={setThemeColor}
            onWelcomeTextChange={setWelcomeText}
            onLogoUrlChange={setLogoUrl}
            onSave={() =>
              void runAction(async () => {
                await api.saveBrand(companyId, { brandName, themeColor, welcomeText, logoUrl });
                setStatusMessage("公司资料已保存。");
              })
            }
          />
          <GatewaySettings
            baseUrl={baseUrl}
            apiKey={apiKey}
            onBaseUrlChange={setBaseUrl}
            onApiKeyChange={setApiKey}
            onSave={() =>
              void runAction(async () => {
                await saveGatewayConfig();
                setStatusMessage("Gateway 配置已保存。");
              })
            }
            onTest={() =>
              void runAction(async () => {
                await saveGatewayConfig();
                await api.testGateway(companyId, { baseUrl, apiKey });
                setStatusMessage("Gateway 连通测试成功。");
              })
            }
            onSync={() =>
              void runAction(async () => {
                await saveGatewayConfig();
                const nextAgents = await api.syncGatewayAgents(companyId);
                setAgents(nextAgents);
                if (!primaryAgentId && nextAgents[0]) {
                  setPrimaryAgentId(nextAgents[0].externalAgentId);
                }
                setStatusMessage("Agent 已同步。");
              })
            }
          />
          <AgentManager agents={agents} />
          <TeamManager
            name={teamName}
            description={teamDescription}
            primaryAgentId={primaryAgentId}
            agents={agents}
            onNameChange={setTeamName}
            onDescriptionChange={setTeamDescription}
            onPrimaryAgentIdChange={setPrimaryAgentId}
            onCreate={() =>
              void runAction(async () => {
                const team = await api.createTeam(companyId, {
                  name: teamName,
                  description: teamDescription || null,
                  primaryAgentId,
                });
                onTeamCreated?.(team.id);
                setStatusMessage(`团队已创建：${team.name}`);
              })
            }
          />
          <InviteManager
            usageLimit={usageLimit}
            expiresInHours={expiresInHours}
            latestInvite={latestInvite}
            onUsageLimitChange={setUsageLimit}
            onExpiresInHoursChange={setExpiresInHours}
            onCreate={() =>
              void runAction(async () => {
                const invite = await api.createInvite(companyId, {
                  expiresInHours: Number(expiresInHours) || 24,
                  usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
                });
                setLatestInvite(invite);
                setStatusMessage("邀请链接已创建。");
              })
            }
          />
        </div>
      </section>
    </main>
  );
}
