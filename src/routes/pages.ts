import indexHtml from "../pages/index.html" with { type: "text" };
import sessionsHtml from "../pages/sessions.html" with { type: "text" };
import configChannelsHtml from "../pages/config-channels.html" with { type: "text" };
import configAgentsHtml from "../pages/config-agents.html" with { type: "text" };
import configSkillsHtml from "../pages/config-skills.html" with { type: "text" };
import configBrowserHtml from "../pages/config-browser.html" with { type: "text" };
import configGatewayHtml from "../pages/config-gateway.html" with { type: "text" };
import cssContent from "../../dist/output.css" with { type: "text" };

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
  "/config/gateway": configGatewayHtml,
  "/config/gateway/": configGatewayHtml,
  "/sessions": sessionsHtml,
  "/sessions/": sessionsHtml,
};

export function handlePageRequest(path: string): Response | null {
  if (path === "/styles.css") {
    return new Response(cssContent, {
      headers: { "content-type": "text/css; charset=utf-8" },
    });
  }

  if (PAGES[path]) {
    return new Response(PAGES[path], {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return null;
}
