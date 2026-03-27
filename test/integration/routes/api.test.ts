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

  it("covers all remote button intents in one dispatch unit test", async () => {
    const intents: Array<{ actionIntent: string; payload?: Record<string, unknown>; expectedActions: string[] }> = [
      {
        actionIntent: "gateway.restart",
        expectedActions: ["openclaw gateway restart"],
      },
      {
        actionIntent: "gateway.restart_qw",
        expectedActions: [
          `powershell -NoProfile -Command "$target='<normalized_managed_cli_exe_path>'; $procs=@(Get-CimInstance Win32_Process -Filter \\"Name='cli.exe'\\" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.Replace('/', '\\\\').Trim().ToLowerInvariant() -eq $target }); foreach($p in $procs){ taskkill /F /T /PID $p.ProcessId | Out-Null }"`,
          `powershell -NoProfile -Command "Start-Process -FilePath '<qwcli_exe_path>' -WorkingDirectory '<qwcli_working_dir>' -WindowStyle Hidden"`,
          `powershell -NoProfile -Command "$target='<normalized_managed_cli_exe_path>'; $p=@(Get-CimInstance Win32_Process -Filter \\"Name='cli.exe'\\" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.Replace('/', '\\\\').Trim().ToLowerInvariant() -eq $target }); if ($p.Count -gt 0) { exit 0 } else { exit 1 }"`,
        ],
      },
      {
        actionIntent: "gateway.update",
        expectedActions: [
          "cd /data/openclaw",
          "cd /data/openclaw && git fetch origin main --prune && git reset --hard origin/main && git clean -fd",
          "cd /data/openclaw && npm i -g nrm",
          "cd /data/openclaw && nrm use tencent",
          "cd /data/openclaw && pnpm install",
          "cd /data/openclaw && pnpm run build",
          "cd /data/openclaw && pnpm run ui:build",
          "cd /data/openclaw && pnpm link --global",
          "cd /data/openclaw && openclaw gateway restart",
        ],
      },
      {
        actionIntent: "browser.detect",
        expectedActions: [`powershell -NoProfile -Command "curl.exe -sS http://127.0.0.1:<cdp_port>/json/version"`],
      },
      {
        actionIntent: "browser.repair",
        expectedActions: [
          `powershell -NoProfile -Command "netsh advfirewall firewall add rule name=\\"openclaw-cdp-<cdp_port>\\" dir=in action=allow protocol=TCP localport=<cdp_port>"`,
          `powershell -NoProfile -Command "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=<cdp_port> connectaddress=127.0.0.1 connectport=<cdp_port>"`,
          `powershell -NoProfile -Command "curl.exe -sS http://127.0.0.1:<cdp_port>/json/version"`,
          `openclaw config set browser.cdpUrl=http://<wsl_host_or_windows_ip>:<cdp_port>`,
        ],
      },
      {
        actionIntent: "browser.open_cdp",
        expectedActions: [
          `powershell -NoProfile -Command "taskkill /F /IM chrome.exe; Start-Process -FilePath '<chrome_exe_path>' -ArgumentList '--remote-debugging-port=<cdp_port> --user-data-dir=<chrome_profile_dir>'"`,
          `powershell -NoProfile -Command "netsh advfirewall firewall add rule name=\\"openclaw-cdp-<cdp_port>\\" dir=in action=allow protocol=TCP localport=<cdp_port>"`,
          `powershell -NoProfile -Command "netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=<cdp_port> connectaddress=127.0.0.1 connectport=<cdp_port>"`,
          `openclaw config set browser.cdpUrl=http://<wsl_host_or_windows_ip>:<cdp_port>`,
        ],
      },
      {
        actionIntent: "environment.install",
        payload: { target: "wsl", tool: "python" },
        expectedActions: [`wsl -d <distro> bash -lc "<install-python-for-wsl>"`, `wsl -d <distro> bash -lc "python --version"`],
      },
      {
        actionIntent: "mcp.build",
        payload: { name: "windows-mcp" },
        expectedActions: ["echo windows-mcp uses local service mode (skip build.ps1)"],
      },
      {
        actionIntent: "app.upgrade",
        payload: { autoRestart: true },
        expectedActions: ["openclaw app update --trigger manual --auto-restart=true"],
      },
      {
        actionIntent: "app.restart",
        expectedActions: ["openclaw gateway restart"],
      },
      {
        actionIntent: "app.log_center.open",
        expectedActions: ["openclaw app log-center open"],
      },
    ];

    for (const item of intents) {
      const req = new Request("http://clawos.desktop/api/remote/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionIntent: item.actionIntent, payload: item.payload || {} }),
      });

      const response = await handleApiRequest(req, "/api/remote/dispatch");
      expect(response).not.toBeNull();
      expect(response?.status).toBe(200);

      const payload = await parseJson(response as Response);
      expect(payload.ok).toBe(true);
      expect(payload.executeOn).toBe("app");
      expect(payload.purpose).toBe("return-actions-for-app");
      expect(payload.actionIntent).toBe(item.actionIntent);
      expect(payload.allowedExecutors).toEqual(["shell", "powershell", "wsl"]);
      expect(payload.ACTIONS).toEqual(item.expectedActions);
    }
  });

  it("returns null for unknown path", async () => {
    const req = new Request("http://clawos.desktop/api/unknown", { method: "GET" });
    const response = await handleApiRequest(req, "/api/unknown");
    expect(response).toBeNull();
  });
});
