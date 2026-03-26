import Electrobun, { BrowserView } from "electrobun";
import type { DesktopRpcSchema } from "../shared/rpc/schema";
import { invokeDesktopApi, renderDesktopPage } from "./desktop-ui";

function assertAllowedExternalUrl(rawUrl: string): string {
  const url = String(rawUrl || "").trim();
  if (!url) {
    throw new Error("外部链接不能为空。");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`外部链接无效：${url}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`不支持的外部链接协议：${parsed.protocol}`);
  }

  return parsed.toString();
}

export function createDesktopRpc() {
  return BrowserView.defineRPC<DesktopRpcSchema>({
    maxRequestTime: 60_000,
    handlers: {
      requests: {
        api: async (params) => await invokeDesktopApi(params),
        renderPage: async (params) => await renderDesktopPage(params.path),
        openExternalUrl: async (params) => {
          const url = assertAllowedExternalUrl(params?.url || "");
          console.log(`[desktop-rpc] openExternalUrl -> ${url}`);
          const ok = Electrobun.Utils.openExternal(url);
          if (!ok) {
            console.error(`[desktop-rpc] openExternalUrl failed -> ${url}`);
            throw new Error(`调用系统浏览器失败：${url}`);
          }
          console.log(`[desktop-rpc] openExternalUrl ok -> ${url}`);
          return { ok: true };
        },
      },
    },
  });
}
