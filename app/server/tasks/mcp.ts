import { existsSync } from "node:fs";
import path from "node:path";
import { hasDesktopMcpServiceTarget } from "./desktop-control";
import { normalizeOutput, runProcess, type CommandResult } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";

export type McpName = "windows-mcp" | "yingdao-mcp" | "wechat-mcp" | "crm-mcp";

type McpTarget = {
  name: McpName;
  label: string;
  scriptPath: string;
  distPath: string;
};

const REPO_ROOT = path.resolve(import.meta.dir, "../../../");

const MCP_TARGETS: McpTarget[] = [
  {
    name: "windows-mcp",
    label: "Windows MCP",
    scriptPath: path.join(REPO_ROOT, "mcp", "windows-mcp", "build.ps1"),
    distPath: path.join(REPO_ROOT, "mcp", "windows-mcp", "dist", "windows-mcp.exe"),
  },
  {
    name: "yingdao-mcp",
    label: "Yingdao MCP",
    scriptPath: path.join(REPO_ROOT, "mcp", "yingdao-mcp", "build.ps1"),
    distPath: path.join(REPO_ROOT, "mcp", "yingdao-mcp", "dist", "yingdao-mcp.exe"),
  },
  {
    name: "wechat-mcp",
    label: "WeChat MCP",
    scriptPath: path.join(REPO_ROOT, "mcp", "wechat-mcp", "build.ps1"),
    distPath: path.join(REPO_ROOT, "mcp", "wechat-mcp", "dist", "wechat-mcp.exe"),
  },
  {
    name: "crm-mcp",
    label: "CRM MCP",
    scriptPath: path.join(REPO_ROOT, "mcp", "crm-mcp", "build.ps1"),
    distPath: path.join(REPO_ROOT, "mcp", "crm-mcp", "dist", "crm-mcp.exe"),
  },
];

function getMcpTarget(name: McpName): McpTarget {
  const target = MCP_TARGETS.find((item) => item.name === name);
  if (!target) {
    throw new Error(`Unsupported MCP name: ${name}`);
  }
  return target;
}

function appendCommandLogs(task: Task, result: CommandResult): void {
  for (const line of normalizeOutput(result.stdout)) {
    appendTaskLog(task, line, "info");
  }
  for (const line of normalizeOutput(result.stderr)) {
    appendTaskLog(task, line, result.ok ? "info" : "error");
  }
}

export function probeMcpTargets(): Array<{
  name: McpName;
  label: string;
  scriptExists: boolean;
  built: boolean;
  distPath: string;
}> {
  return MCP_TARGETS.map((target) => {
    if (target.name === "windows-mcp") {
      const available = hasDesktopMcpServiceTarget();
      return {
        name: target.name,
        label: target.label,
        scriptExists: available,
        built: available,
        distPath: target.distPath,
      };
    }

    return {
      name: target.name,
      label: target.label,
      scriptExists: existsSync(target.scriptPath),
      built: existsSync(target.distPath),
      distPath: target.distPath,
    };
  });
}

export function startMcpBuildTask(name: McpName): { task: Task; reused: boolean } {
  const target = getMcpTarget(name);
  const taskType = `mcp-build-${name}`;
  const runningTask = findRunningTask(taskType);
  if (runningTask) {
    appendTaskLog(runningTask, "Reusing existing MCP build task.");
    return { task: runningTask, reused: true };
  }

  const task = createTask(taskType, `Build ${target.label}`, 1);
  task.status = "running";

  if (name === "windows-mcp") {
    task.status = "success";
    task.step = 1;
    task.endedAt = new Date().toISOString();
    appendTaskLog(task, "Windows MCP now runs in local service mode.");
    appendTaskLog(task, "Use the Desktop Control MCP switch to start or stop mcp_server/windows_mcp.");
    appendTaskLog(task, "The legacy build step has been skipped.");
    return { task, reused: false };
  }

  void (async () => {
    try {
      if (process.platform !== "win32") {
        throw new Error("MCP build is only supported on Windows.");
      }

      task.step = 1;
      appendTaskLog(task, `Step 1/1: build ${target.label}`);
      appendTaskLog(task, `Script: ${target.scriptPath}`);

      if (!existsSync(target.scriptPath)) {
        throw new Error(`Build script not found: ${target.scriptPath}`);
      }

      const command = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        target.scriptPath,
      ];
      appendTaskLog(task, `Run: ${command.join(" ")}`);
      const result = await runProcess(command, { timeoutMs: 40 * 60 * 1000 });
      appendCommandLogs(task, result);
      if (!result.ok) {
        throw new Error(`MCP build failed (exit code ${result.code})`);
      }

      if (existsSync(target.distPath)) {
        appendTaskLog(task, `Output: ${target.distPath}`);
      } else {
        appendTaskLog(task, `Build completed but output not found: ${target.distPath}`, "error");
      }

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "Task completed.");
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
    }
  })();

  return { task, reused: false };
}
