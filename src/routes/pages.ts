import indexHtml from "../pages/index.html" with { type: "text" };
import sessionsHtml from "../pages/sessions.html" with { type: "text" };
import configChannelsHtml from "../pages/config-channels.html" with { type: "text" };
import configAgentsHtml from "../pages/config-agents.html" with { type: "text" };
import configSkillsHtml from "../pages/config-skills.html" with { type: "text" };
import configBrowserHtml from "../pages/config-browser.html" with { type: "text" };
import configWalletHtml from "../pages/config-wallet.html" with { type: "text" };
import configSettingsHtml from "../pages/config-settings.html" with { type: "text" };
import sidebarUpdateJs from "../pages/sidebar-update.js" with { type: "text" };
import cssContent from "../../dist/output.css" with { type: "text" };

type SidebarNavId = "dashboard" | "channels" | "agents" | "skills" | "browser" | "wallet" | "settings" | "sessions";

const PAGES: Record<string, string> = {
  "/": indexHtml,
  "/index": indexHtml,
  "/config/channels": configChannelsHtml,
  "/config/channels/": configChannelsHtml,
  "/config/agents": configAgentsHtml,
  "/config/agents/": configAgentsHtml,
  "/config/skills": configSkillsHtml,
  "/config/skills/": configSkillsHtml,
  "/config/browser": configBrowserHtml,
  "/config/browser/": configBrowserHtml,
  "/config/wallet": configWalletHtml,
  "/config/wallet/": configWalletHtml,
  "/config/settings": configSettingsHtml,
  "/config/settings/": configSettingsHtml,
  "/sessions": sessionsHtml,
  "/sessions/": sessionsHtml,
};

function resolveSidebarActive(path: string): SidebarNavId | null {
  if (path === "/" || path === "/index") {
    return "dashboard";
  }

  if (path.startsWith("/config/channels")) {
    return "channels";
  }

  if (path.startsWith("/config/agents")) {
    return "agents";
  }

  if (path.startsWith("/config/skills")) {
    return "skills";
  }

  if (path.startsWith("/config/browser")) {
    return "browser";
  }

  if (path.startsWith("/config/wallet")) {
    return "wallet";
  }

  if (path.startsWith("/config/settings")) {
    return "settings";
  }

  if (path.startsWith("/sessions")) {
    return "sessions";
  }

  return null;
}

function renderSidebar(active: SidebarNavId | null): string {
  const items: Array<{ id: SidebarNavId; href: string; icon: string; label: string }> = [
    { id: "dashboard", href: "/", icon: "fa-gauge-high", label: "控制台" },
    { id: "channels", href: "/config/channels", icon: "fa-comments", label: "通讯渠道" },
    { id: "agents", href: "/config/agents", icon: "fa-brain", label: "大模型" },
    { id: "skills", href: "/config/skills", icon: "fa-graduation-cap", label: "功能" },
    { id: "browser", href: "/config/browser", icon: "fa-globe", label: "浏览器" },
    { id: "wallet", href: "/config/wallet", icon: "fa-wallet", label: "钱包" },
    { id: "settings", href: "/config/settings", icon: "fa-gear", label: "设置" },
  ];

  const nav = items
    .map((item) => {
      const className =
        item.id === active ? "btn btn-primary btn-sm justify-start gap-2" : "btn btn-ghost btn-sm justify-start gap-2";
      return `<a class="${className}" href="${item.href}"><i class="fa-solid ${item.icon} w-4 text-center" aria-hidden="true"></i><span>${item.label}</span></a>`;
    })
    .join("");

  return `
      <aside class="flex flex-col gap-4 border-r border-base-200 bg-base-100 px-4 py-4">
        <div class="flex items-center justify-between gap-2 text-sm font-semibold">
          <a
            class="flex items-center gap-2 rounded-md px-1 py-1 transition hover:bg-base-200/60"
            href="https://clawos.cc"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="h-2 w-2 rounded-full bg-neutral" aria-hidden="true"></span>
            <span>ClawOS.CC</span>
          </a>
        </div>
        <nav class="flex flex-col gap-2">
          ${nav}
        </nav>

        <div class="flex flex-col gap-3 pt-1">
          <div data-app-update-widget>
            <div class="text-xs text-base-content/70">
              <a href="https://clawos.cc" target="_blank" rel="noopener noreferrer">clawos.cc</a> · 版本：<span data-app-version>v-</span>
            </div>
            <div class="mt-2 text-[11px] text-base-content/60" data-app-update-meta>正在检查更新...</div>
          </div>

          <button class="btn btn-outline btn-sm justify-start gap-2" type="button" data-openclaw-entry>
            <i class="fa-solid fa-arrow-up-right-from-square w-4 text-center" aria-hidden="true"></i>
            <span>打开 openclaw 后台</span>
          </button>
        </div>
      </aside>`;
}

function withSharedSidebar(pageHtml: string, path: string): string {
  const active = resolveSidebarActive(path);
  return pageHtml.replace(/<aside[\s\S]*?<\/aside>/, renderSidebar(active));
}

export function handlePageRequest(path: string): Response | null {
  if (path === "/styles.css") {
    return new Response(cssContent, {
      headers: { "content-type": "text/css; charset=utf-8" },
    });
  }

  if (path === "/sidebar-update.js") {
    return new Response(sidebarUpdateJs, {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  }

  if (PAGES[path]) {
    return new Response(withSharedSidebar(PAGES[path], path), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return null;
}
