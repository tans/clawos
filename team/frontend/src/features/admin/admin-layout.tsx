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
  { id: "company", label: "Company" },
  { id: "gateway", label: "Gateway" },
  { id: "agents", label: "Agents" },
  { id: "teams", label: "Teams" },
  { id: "invites", label: "Invites" },
];

type AdminLayoutProps = {
  companyId?: string;
  api?: TeamFrontendApi;
  onTeamCreated?: (teamId: string) => void;
};

function readCompanyIdFromPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = /^\/app\/admin\/([^/]+)$/.exec(window.location.pathname);
  return match?.[1] ?? null;
}

export function AdminLayout({ companyId: providedCompanyId, api = teamFrontendApi, onTeamCreated }: AdminLayoutProps) {
  const companyId = providedCompanyId ?? readCompanyIdFromPath() ?? "";
  const [brandName, setBrandName] = useState("Alpha Ops");
  const [themeColor, setThemeColor] = useState("#1d4ed8");
  const [welcomeText, setWelcomeText] = useState("Welcome to your company workspace");
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

  return (
    <main className="team-shell">
      <section className="admin-shell">
        <aside className="chat-sidebar">
          <p className="eyebrow">Admin setup</p>
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
                setStatusMessage("Company settings saved.");
              })
            }
          />
          <GatewaySettings
            baseUrl={baseUrl}
            apiKey={apiKey}
            onBaseUrlChange={setBaseUrl}
            onApiKeyChange={setApiKey}
            onTest={() =>
              void runAction(async () => {
                await api.testGateway(companyId, { baseUrl, apiKey });
                setStatusMessage("Gateway connection succeeded.");
              })
            }
            onSync={() =>
              void runAction(async () => {
                const nextAgents = await api.syncGatewayAgents(companyId);
                setAgents(nextAgents);
                if (!primaryAgentId && nextAgents[0]) {
                  setPrimaryAgentId(nextAgents[0].externalAgentId);
                }
                setStatusMessage("Agents synced.");
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
                setStatusMessage(`Team created: ${team.name}`);
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
                setStatusMessage("Invite created.");
              })
            }
          />
        </div>
      </section>
    </main>
  );
}
