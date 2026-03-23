import { useEffect, useState } from "react";
import { AgentsPage } from "./pages/agents-page";
import { AppShell } from "./components/layout/app-shell";
import { BackupsPage } from "./pages/backups-page";
import { BrowserPage } from "./pages/browser-page";
import { ChannelsPage } from "./pages/channels-page";
import { DashboardPage } from "./pages/dashboard-page";
import { DesktopControlPage } from "./pages/desktop-control-page";
import { EnvironmentPage } from "./pages/environment-page";
import { SettingsPage } from "./pages/settings-page";
import { SkillsPage } from "./pages/skills-page";
import { WalletPage } from "./pages/wallet-page";

const PAGE_CONFIG = {
  dashboard: { title: "控制台", description: "" },
  settings: { title: "更多设置", description: "" },
  channels: { title: "通讯设置", description: "" },
  agents: { title: "模型配置", description: "" },
  skills: { title: "功能配置", description: "" },
} as const;

export type PageKey = keyof typeof PAGE_CONFIG;

function readPageFromLocation(): PageKey {
  const pathname = window.location.pathname.toLowerCase();

  if (
    pathname === "/config/settings" ||
    pathname === "/config/settings/" ||
    pathname === "/config/environment" ||
    pathname === "/config/environment/" ||
    pathname === "/config/backups" ||
    pathname === "/config/backups/"
  ) {
    return "settings";
  }

  if (pathname === "/config/channels" || pathname === "/config/channels/") return "channels";
  if (pathname === "/config/agents" || pathname === "/config/agents/") return "agents";

  if (
    pathname === "/config/skills" ||
    pathname === "/config/skills/" ||
    pathname === "/config/browser" ||
    pathname === "/config/browser/" ||
    pathname === "/config/desktop-control" ||
    pathname === "/config/desktop-control/" ||
    pathname === "/config/wallet" ||
    pathname === "/config/wallet/"
  ) {
    return "skills";
  }

  if (pathname === "/" || pathname === "/index" || pathname === "/react" || pathname === "/react/") {
    const hashValue = (window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (hashValue === "settings" || hashValue === "environment" || hashValue === "backups") return "settings";
    if (hashValue === "channels") return "channels";
    if (hashValue === "agents") return "agents";
    if (hashValue === "skills" || hashValue === "browser" || hashValue === "desktop-control" || hashValue === "wallet") {
      return "skills";
    }
    return "dashboard";
  }

  return "dashboard";
}

function toHref(page: PageKey): string {
  switch (page) {
    case "settings":
      return "/config/settings";
    case "channels":
      return "/config/channels";
    case "agents":
      return "/config/agents";
    case "skills":
      return "/config/skills";
    default:
      return "/";
  }
}

function MoreSettingsPage() {
  return (
    <>
      <SettingsPage />
      <EnvironmentPage />
      <BackupsPage />
    </>
  );
}

function SkillsConfigPage() {
  return (
    <>
      <BrowserPage />
      <SkillsPage />
      <DesktopControlPage />
      <WalletPage />
    </>
  );
}

export function App() {
  const [page, setPage] = useState<PageKey>(() => readPageFromLocation());

  useEffect(() => {
    const sync = () => setPage(readPageFromLocation());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const config = PAGE_CONFIG[page];

  return (
    <AppShell
      page={page}
      title={config.title}
      description={config.description}
      onNavigate={(next) => {
        const href = toHref(next);
        if (window.location.pathname !== href) {
          window.history.pushState({}, "", href);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }}
    >
      {page === "settings" ? (
        <MoreSettingsPage />
      ) : page === "channels" ? (
        <ChannelsPage />
      ) : page === "agents" ? (
        <AgentsPage />
      ) : page === "skills" ? (
        <SkillsConfigPage />
      ) : (
        <DashboardPage />
      )}
    </AppShell>
  );
}
