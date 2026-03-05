import { describe, expect, it } from "bun:test";
import { handleApiRequest } from "../../src/routes/api";

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
      body: JSON.stringify({ action: "restart" }),
    });

    const response = await handleApiRequest(req, "/api/browser/action");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);

    const payload = await parseJson(response as Response);
    expect(payload.ok).toBe(true);
    const task = payload.task as Record<string, unknown>;
    expect(task.type).toBe("browser-cdp-restart");
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

  it("returns null for unknown path", async () => {
    const req = new Request("http://clawos.desktop/api/unknown", { method: "GET" });
    const response = await handleApiRequest(req, "/api/unknown");
    expect(response).toBeNull();
  });
});
