import indexHtml from "../pages/index.html" with { type: "text" };
import sessionsHtml from "../pages/sessions.html" with { type: "text" };
import configChannelsHtml from "../pages/config-channels.html" with { type: "text" };
import configAgentsHtml from "../pages/config-agents.html" with { type: "text" };
import configSkillsHtml from "../pages/config-skills.html" with { type: "text" };
import configBrowserHtml from "../pages/config-browser.html" with { type: "text" };
import configWalletHtml from "../pages/config-wallet.html" with { type: "text" };
import configSettingsHtml from "../pages/config-settings.html" with { type: "text" };
import configBackupsHtml from "../pages/config-backups.html" with { type: "text" };
import sidebarUpdateJs from "../pages/sidebar-update.js" with { type: "text" };
import pagesShellCss from "../pages/pages-shell.css" with { type: "text" };
import cssContent from "../../dist/output.css" with { type: "text" };

type SidebarNavId =
  | "dashboard"
  | "channels"
  | "agents"
  | "skills"
  | "browser"
  | "wallet"
  | "settings"
  | "backups"
  | "sessions";

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
  "/config/backups": configBackupsHtml,
  "/config/backups/": configBackupsHtml,
  "/sessions": sessionsHtml,
  "/sessions/": sessionsHtml,
};

function resolveSidebarActive(path: string): SidebarNavId | null {
  if (path === "/" || path === "/index") return "dashboard";
  if (path.startsWith("/config/channels")) return "channels";
  if (path.startsWith("/config/agents")) return "agents";
  if (path.startsWith("/config/skills")) return "skills";
  if (path.startsWith("/config/browser")) return "browser";
  if (path.startsWith("/config/wallet")) return "wallet";
  if (path.startsWith("/config/settings")) return "settings";
  if (path.startsWith("/config/backups")) return "backups";
  if (path.startsWith("/sessions")) return "sessions";
  return null;
}

function renderSidebar(active: SidebarNavId | null): string {
  const sections: Array<{
    title: string;
    items: Array<{ id: SidebarNavId; href: string; label: string }>;
  }> = [
    {
      title: "\u603b\u89c8",
      items: [
        { id: "dashboard", href: "/", label: "\u63a7\u5236\u53f0" },
      ],
    },
    {
      title: "\u914d\u7f6e",
      items: [
        { id: "channels", href: "/config/channels", label: "\u6e20\u9053\u914d\u7f6e" },
        { id: "agents", href: "/config/agents", label: "\u4ee3\u7406\u914d\u7f6e" },
        { id: "settings", href: "/config/settings", label: "\u5e38\u89c4\u8bbe\u7f6e" },
        { id: "backups", href: "/config/backups", label: "\u5907\u4efd\u7ba1\u7406" },
      ],
    },
    {
      title: "\u5de5\u5177",
      items: [
        { id: "browser", href: "/config/browser", label: "\u6d4f\u89c8\u5668" },
        { id: "wallet", href: "/config/wallet", label: "\u94b1\u5305" },
        { id: "sessions", href: "/sessions", label: "\u4f1a\u8bdd" },
        { id: "skills", href: "/config/skills", label: "Skills" },
      ],
    },
  ];

  const nav = sections
    .map((section) => {
      const itemsHtml = section.items
        .map((item) => {
          const className =
            item.id === active
              ? "btn btn-primary btn-sm justify-start gap-2"
              : "btn btn-ghost btn-sm justify-start gap-2";
          return `<a class="${className}" href="${item.href}"><span>${item.label}</span></a>`;
        })
        .join("");
      return `
        <div class="flex flex-col gap-1.5">
          <div class="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/40">${section.title}</div>
          <div class="flex flex-col gap-1">${itemsHtml}</div>
        </div>
      `;
    })
    .join("");

  return `
      <aside class="clawos-page-sidebar flex flex-col">
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
              <a href="https://clawos.cc" target="_blank" rel="noopener noreferrer">clawos.cc</a> | \u7248\u672c: <span data-app-version>v-</span>
            </div>
            <div class="mt-2 text-[11px] text-base-content/60" data-app-update-meta>\u68c0\u67e5\u66f4\u65b0\u4e2d...</div>
            <div class="mt-2 hidden" data-app-update-actions>
              <button class="btn btn-primary btn-xs w-full" type="button" data-app-update-run>
                \u66f4\u65b0\u5e76\u91cd\u542f ClawOS
              </button>
            </div>
          </div>

          <button class="btn btn-outline btn-sm justify-start gap-2" type="button" data-openclaw-entry>
            <span>\u6253\u5f00 openclaw \u63a7\u5236\u53f0</span>
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

  if (path === "/pages-shell.css") {
    return new Response(pagesShellCss, {
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
