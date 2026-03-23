import { describe, expect, it } from "bun:test";
import path from "node:path";
import { resolveDesktopMcpServiceTarget } from "../../app/server/tasks/desktop-control";

describe("resolveDesktopMcpServiceTarget", () => {
  it("resolves the local windows-mcp executable from workspace ancestors", () => {
    const workspaceRoot = path.normalize("C:\\workspace\\clawos");
    const executablePath = path.join(
      workspaceRoot,
      "mcp_server",
      "windows_mcp",
      "Scripts",
      "windows-mcp.exe",
    );

    const target = resolveDesktopMcpServiceTarget({
      anchors: [
        path.join(workspaceRoot, "app", "server", "tasks"),
        path.join(
          workspaceRoot,
          "app",
          "build",
          "dev-win-x64",
          "ClawOS-dev",
          "Resources",
          "app",
          "bun",
        ),
      ],
      exists: (filePath) => path.normalize(filePath) === path.normalize(executablePath),
      platform: "win32",
    });

    expect(target.cwd).toBe(path.join(workspaceRoot, "mcp_server", "windows_mcp"));
    expect(target.command).toEqual([
      executablePath,
      "--transport",
      "streamable-http",
      "--host",
      "0.0.0.0",
      "--port",
      "8100",
    ]);
  });

  it("falls back to python -m windows_mcp when the launcher exe is unavailable", () => {
    const workspaceRoot = path.normalize("C:\\workspace\\clawos");
    const pythonPath = path.join(
      workspaceRoot,
      "mcp_server",
      "windows_mcp",
      "Scripts",
      "python.exe",
    );

    const target = resolveDesktopMcpServiceTarget({
      anchors: [path.join(workspaceRoot, "app", "server", "tasks")],
      exists: (filePath) => path.normalize(filePath) === path.normalize(pythonPath),
      platform: "win32",
    });

    expect(target.command).toEqual([
      pythonPath,
      "-m",
      "windows_mcp",
      "--transport",
      "streamable-http",
      "--host",
      "0.0.0.0",
      "--port",
      "8100",
    ]);
  });
});
