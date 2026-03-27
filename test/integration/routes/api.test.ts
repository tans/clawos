import { describe, expect, it } from "bun:test";
import { handleApiRequest } from "../../../app/server/api";

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("api routes", () => {
  it("returns structured error for unsupported browser action", async () => {
    const req = new Request("http://clawos.desktop/api/browser/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "invalid-action" }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toContain("不支持的 action");
  });

  it("supports legacy browser restart action alias", async () => {
    const req = new Request("http://clawos.desktop/api/browser/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restart", confirmed: true }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    const task = payload.task as Record<string, unknown>;
    expect(task.type).toBe("browser-cdp-restart");
  });

  it("supports open-cdp browser action alias", async () => {
    const req = new Request("http://clawos.desktop/api/browser/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "open-cdp", confirmed: true }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    const task = payload.task as Record<string, unknown>;
    expect(task.type).toBe("browser-cdp-restart");
  });

  it("supports browser reset action alias", async () => {
    const req = new Request("http://clawos.desktop/api/browser/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset", confirmed: true }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    const task = payload.task as Record<string, unknown>;
    expect(task.type).toBe("browser-cdp-repair");
  });

  it("requires explicit confirmation before browser repair starts", async () => {
    const req = new Request("http://clawos.desktop/api/browser/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "repair" }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(400);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(false);
    expect(String(payload.error || "")).toContain("请先确认后再继续");
  });

  it("ignores wework channel patch on macOS", async () => {
    if (process.platform !== "darwin") {
      return;
    }

    const req = new Request("http://clawos.desktop/api/config/channels/channel/wework", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { enable: true } }),
    });

    const response = await handleApiRequest(req, "/api/config/channels/channel/wework");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    expect(payload.ignored).toBe(true);
  });

  it("returns structured error for missing task id", async () => {
    const req = new Request("http://clawos.desktop/api/tasks/not-found", {
      method: "GET",
    });

    const response = await handleApiRequest(req, "/api/tasks/not-found");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(404);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("任务不存在。");
  });

  it("returns remote catalog with fixed executors", async () => {
    const req = new Request("http://clawos.desktop/api/remote/catalog", { method: "GET" });
    const response = await handleApiRequest(req, "/api/remote/catalog");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    expect(payload.executors).toEqual(["shell", "powershell", "wsl"]);
    expect(Array.isArray(payload.actions)).toBe(true);
  });

  it("returns remote dispatch instructions for app execution", async () => {
    const req = new Request("http://clawos.desktop/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "gateway.restart" }),
    });
    const response = await handleApiRequest(req, "/api/remote/dispatch");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    expect(payload.executeOn).toBe("app");
    expect(payload.actionIntent).toBe("gateway.restart");
    expect(payload.purpose).toBe("return-actions-for-app");
    expect(Array.isArray(payload.ACTIONS)).toBe(true);
    expect(payload.ACTIONS).toEqual(['POST /api/gateway/action {"action":"restart"}']);
  });

  it("returns full gateway.update action flow", async () => {
    const req = new Request("http://clawos.desktop/api/remote/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionIntent: "gateway.update" }),
    });
    const response = await handleApiRequest(req, "/api/remote/dispatch");
    expect(response).not.toBeNull();
    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    expect(payload.ACTIONS).toEqual([
      "cd /data/openclaw",
      "cd /data/openclaw && git fetch origin main --prune && git reset --hard origin/main && git clean -fd",
      "cd /data/openclaw && npm i -g nrm",
      "cd /data/openclaw && nrm use tencent",
      "cd /data/openclaw && pnpm install",
      "cd /data/openclaw && pnpm run build",
      "cd /data/openclaw && pnpm run ui:build",
      "cd /data/openclaw && pnpm link --global",
      "cd /data/openclaw && openclaw gateway restart",
    ]);
  });

  it("returns null for unknown path", async () => {
    const req = new Request("http://clawos.desktop/api/unknown", { method: "GET" });
    const response = await handleApiRequest(req, "/api/unknown");
    expect(response).toBeNull();
  });
});
