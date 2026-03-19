import type { ElectrobunRPCSchema } from "electrobun";

export type DesktopApiRequest = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
};

export type DesktopApiResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export type DesktopPageRequest = {
  path: string;
};

export type DesktopPageResponse = {
  status: number;
  html: string;
};

export type DesktopOpenExternalRequest = {
  url: string;
};

export type DesktopOpenExternalResponse = {
  ok: boolean;
};

export type DesktopRpcSchema = ElectrobunRPCSchema & {
  bun: {
    requests: {
      api: {
        params: DesktopApiRequest;
        response: DesktopApiResponse;
      };
      renderPage: {
        params: DesktopPageRequest;
        response: DesktopPageResponse;
      };
      openExternalUrl: {
        params: DesktopOpenExternalRequest;
        response: DesktopOpenExternalResponse;
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
