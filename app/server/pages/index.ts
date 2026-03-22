const REACT_APP_HTML = `
<!doctype html>
<html lang="zh-CN" data-clawos-desktop-page="1">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClawOS</title>
    <link rel="stylesheet" href="/assets/app.css" />
    <script type="module" src="/assets/react-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`.trim();

const PAGES = new Set([
  "/",
  "/index",
  "/config/channels",
  "/config/channels/",
  "/config/agents",
  "/config/agents/",
  "/config/environment",
  "/config/environment/",
  "/config/skills",
  "/config/skills/",
  "/config/browser",
  "/config/browser/",
  "/config/desktop-control",
  "/config/desktop-control/",
  "/config/wallet",
  "/config/wallet/",
  "/config/settings",
  "/config/settings/",
  "/config/backups",
  "/config/backups/",
  "/react",
  "/react/",
  "/sessions",
  "/sessions/",
]);

export function handlePageRequest(path: string): Response | null {
  if (!PAGES.has(path)) {
    return null;
  }

  return new Response(REACT_APP_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
