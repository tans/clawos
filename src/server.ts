import { ensureLocalConfigTemplateFile, readLocalAppSettings } from "./config/local";
import { HttpError, jsonResponse } from "./lib/http";
import { handleApiRequest } from "./routes/api";
import { handlePageRequest } from "./routes/pages";
import { openBrowser } from "./system/browser";
import { startQwGatewayRestartTaskOnStartup } from "./tasks/gateway";

let server: ReturnType<typeof Bun.serve>;
let appSettings: ReturnType<typeof readLocalAppSettings> | null = null;

try {
  ensureLocalConfigTemplateFile();
  appSettings = readLocalAppSettings();

  server = Bun.serve({
    port: appSettings.port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      try {
        const apiResponse = await handleApiRequest(req, path);
        if (apiResponse) {
          return apiResponse;
        }

        const pageResponse = handlePageRequest(path);
        if (pageResponse) {
          return pageResponse;
        }

        return new Response("<h1>404 Not Found</h1>", {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return jsonResponse(
            { ok: false, error: error.message },
            error.status,
          );
        }

        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ ok: false, error: message }, 500);
      }
    },
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ClawOS 启动失败：${message}`);
  console.error("请检查当前配置端口是否被占用，或使用管理员权限重试。");
  process.exit(1);
}

const serverUrl = `http://localhost:${server.port}`;
const startupBanner = `

  ██████╗██╗      █████╗ ██╗    ██╗ ██████╗ ███████╗
 ██╔════╝██║     ██╔══██╗██║    ██║██╔═══██╗██╔════╝
 ██║     ██║     ███████║██║ █╗ ██║██║   ██║███████╗
 ██║     ██║     ██╔══██║██║███╗██║██║   ██║╚════██║
 ╚██████╗███████╗██║  ██║╚███╔███╔╝╚██████╔╝███████║
  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝  ╚═════╝ ╚══════╝
`;
console.log(startupBanner);
console.log("ClawOS 已启动");
console.log(`访问地址: ${serverUrl}`);
console.log("官网: https://clawos.cc");
startQwGatewayRestartTaskOnStartup();
openBrowser(serverUrl, { enabled: appSettings?.autoOpenBrowser !== false });
