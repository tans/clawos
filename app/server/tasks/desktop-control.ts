import { existsSync } from "node:fs";
import path from "node:path";
import { appendTaskLog, createTask, type Task } from "./store";
import { runProcess } from "./shell";

export const DESKTOP_MCP_HOST = "0.0.0.0";
export const DESKTOP_MCP_PORT = 8100;

const DESKTOP_MCP_TASK_TYPE = "desktop-mcp-server";
const DESKTOP_MCP_SERVICE_NAME = "windows-mcp";

type DesktopMcpStatus = {
  running: boolean;
  host: string;
  port: number;
  url: string;
  taskId: string | null;
  taskStatus: string | null;
  pid: number | null;
  command: string | null;
  cwd: string | null;
};

type ResolveDesktopMcpServiceTargetOptions = {
  anchors?: string[];
  exists?: (filePath: string) => boolean;
  platform?: NodeJS.Platform;
};

type DesktopMcpServiceTarget = {
  executablePath: string;
  cwd: string;
  command: string[];
};

type DesktopMcpObservedProcess = {
  pid: number;
  executablePath: string | null;
  command: string | null;
  cwd: string | null;
};

type DesktopMcpRuntimeEntry = {
  process: ReturnType<typeof Bun.spawn>;
  command: string[];
  cwd: string;
  task: Task;
  stopping: boolean;
};

type WindowsProcessSnapshot = {
  ProcessId?: number | string | null;
  ExecutablePath?: string | null;
  CommandLine?: string | null;
};

let desktopMcpRuntime: DesktopMcpRuntimeEntry | null = null;
let desktopMcpTask: Task | null = null;

function listAncestorDirs(start: string, maxDepth = 8): string[] {
  const result: string[] = [];
  let current = path.resolve(start);
  for (let index = 0; index <= maxDepth; index += 1) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return result;
}

function buildCandidateRoots(anchors: string[]): string[] {
  return [...new Set(anchors.flatMap((anchor) => listAncestorDirs(anchor)))];
}

export function resolveDesktopMcpServiceTarget(
  options: ResolveDesktopMcpServiceTargetOptions = {},
): DesktopMcpServiceTarget {
  const exists = options.exists ?? existsSync;
  const platform = options.platform ?? process.platform;
  const scriptsDir = platform === "win32" ? "Scripts" : "bin";
  const executableName = platform === "win32" ? "windows-mcp.exe" : "windows-mcp";
  const pythonName = platform === "win32" ? "python.exe" : "python";
  const anchors = options.anchors ?? [import.meta.dir, process.cwd(), path.dirname(process.execPath)];

  for (const root of buildCandidateRoots(anchors)) {
    const serviceDir = path.resolve(root, "mcp_server", "windows_mcp");
    const executablePath = path.join(serviceDir, scriptsDir, executableName);
    if (exists(executablePath)) {
      return {
        executablePath,
        cwd: serviceDir,
        command: [
          executablePath,
          "--transport",
          "streamable-http",
          "--host",
          DESKTOP_MCP_HOST,
          "--port",
          String(DESKTOP_MCP_PORT),
        ],
      };
    }

    const pythonPath = path.join(serviceDir, scriptsDir, pythonName);
    if (exists(pythonPath)) {
      return {
        executablePath: pythonPath,
        cwd: serviceDir,
        command: [
          pythonPath,
          "-m",
          "windows_mcp",
          "--transport",
          "streamable-http",
          "--host",
          DESKTOP_MCP_HOST,
          "--port",
          String(DESKTOP_MCP_PORT),
        ],
      };
    }
  }

  throw new Error("Desktop MCP service not found. Expected mcp_server/windows_mcp under the workspace.");
}

export function hasDesktopMcpServiceTarget(
  options: ResolveDesktopMcpServiceTargetOptions = {},
): boolean {
  try {
    resolveDesktopMcpServiceTarget(options);
    return true;
  } catch {
    return false;
  }
}

function readTaskId(task: Task | null): string | null {
  return task?.id || null;
}

function finishDesktopMcpTask(
  task: Task,
  status: "success" | "failed",
  message: string,
  level: "info" | "error" = "info",
): Task {
  task.status = status;
  task.step = task.totalSteps;
  task.endedAt = new Date().toISOString();
  task.error = status === "failed" ? message : null;
  appendTaskLog(task, message, level);
  return task;
}

async function streamProcessLogs(
  task: Task,
  stream: ReadableStream<Uint8Array> | null | undefined,
  level: "info" | "error",
): Promise<void> {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/g);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const text = line.trim();
        if (text) {
          appendTaskLog(task, text, level);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendTaskLog(task, `Failed to read process log stream: ${message}`, "error");
  } finally {
    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) {
      appendTaskLog(task, tail, level);
    }
    reader.releaseLock();
  }
}

function getRunningRuntime(): DesktopMcpRuntimeEntry | null {
  const entry = desktopMcpRuntime;
  if (!entry) {
    return null;
  }

  if (entry.process.exitCode !== null) {
    desktopMcpRuntime = null;
    if (!entry.stopping) {
      finishDesktopMcpTask(
        entry.task,
        entry.process.exitCode === 0 ? "success" : "failed",
        entry.process.exitCode === 0
          ? "Desktop MCP service exited."
          : `Desktop MCP service exited unexpectedly (code ${entry.process.exitCode}).`,
        entry.process.exitCode === 0 ? "info" : "error",
      );
    }
    return null;
  }

  return entry;
}

function buildDesktopMcpTask(target: DesktopMcpServiceTarget): Task {
  const task = createTask(DESKTOP_MCP_TASK_TYPE, "Desktop Control MCP", 1);
  task.status = "running";
  task.step = 1;
  appendTaskLog(task, `Starting ${DESKTOP_MCP_SERVICE_NAME} service...`);
  appendTaskLog(task, `Command: ${target.command.join(" ")}`);
  appendTaskLog(task, `Cwd: ${target.cwd}`);
  appendTaskLog(task, `Expected MCP endpoint: http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`);
  return task;
}

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeWindowsProcessSnapshots(stdout: string): WindowsProcessSnapshot[] {
  const text = stdout.trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed) {
      return [];
    }
    return Array.isArray(parsed) ? (parsed as WindowsProcessSnapshot[]) : [parsed as WindowsProcessSnapshot];
  } catch {
    return [];
  }
}

function normalizeWindowsPath(value: string | null | undefined): string {
  return path.normalize(String(value || "")).toLowerCase();
}

function scoreObservedProcess(candidate: WindowsProcessSnapshot, target: DesktopMcpServiceTarget | null): number {
  const command = String(candidate.CommandLine || "").toLowerCase();
  const executablePath = normalizeWindowsPath(candidate.ExecutablePath);
  const expectedExecutablePath = normalizeWindowsPath(target?.command[0] || "");

  if (expectedExecutablePath && executablePath === expectedExecutablePath) {
    return 0;
  }
  if (expectedExecutablePath && command.includes(expectedExecutablePath)) {
    return 1;
  }
  if (command.includes("-m windows_mcp")) {
    return 2;
  }
  return 3;
}

async function findDesktopMcpProcess(target: DesktopMcpServiceTarget | null): Promise<DesktopMcpObservedProcess | null> {
  if (process.platform !== "win32") {
    return null;
  }

  const expectedExecutablePath = target?.command[0] || "";
  const script = String.raw`
$expectedExecutable = ${quotePowerShellString(expectedExecutablePath)}
$transportPattern = '(?i)--transport\s+streamable-http'
$portPattern = '(?i)--port\s+${DESKTOP_MCP_PORT}'
$launcherPattern = '(?i)(^|[\s"])windows-mcp(?:\.exe)?([\s"]|$)'
$modulePattern = '(?i)(^|\s)-m\s+windows_mcp(\s|$)'
$items = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $commandLine = [string]$_.CommandLine
  $executablePath = [string]$_.ExecutablePath
  $matchesExpected = $false
  if ($expectedExecutable) {
    $matchesExpected = $executablePath -and $executablePath.Equals($expectedExecutable, [System.StringComparison]::OrdinalIgnoreCase)
  }
  $matchesGeneric = $commandLine -and (
    ($commandLine -match $launcherPattern -or $commandLine -match $modulePattern) -and
    $commandLine -match $transportPattern -and
    $commandLine -match $portPattern
  )
  $matchesExpected -or $matchesGeneric
} | Select-Object ProcessId, ExecutablePath, CommandLine
if ($items) {
  $items | ConvertTo-Json -Compress
}
`;

  const result = await runProcess(["powershell.exe", "-NoProfile", "-Command", script], {
    timeoutMs: 8000,
  });
  if (!result.ok && !result.stdout.trim()) {
    return null;
  }

  const candidates = normalizeWindowsProcessSnapshots(result.stdout).filter((candidate) => {
    const pid = Number(candidate.ProcessId);
    return Number.isFinite(pid) && pid > 0;
  });
  if (candidates.length === 0) {
    return null;
  }

  const best = candidates
    .slice()
    .sort((left, right) => scoreObservedProcess(left, target) - scoreObservedProcess(right, target))[0];
  if (!best) {
    return null;
  }

  const pid = Number(best.ProcessId);
  if (!Number.isFinite(pid) || pid <= 0) {
    return null;
  }

  const matchesExpectedExecutable =
    normalizeWindowsPath(best.ExecutablePath) === normalizeWindowsPath(target?.command[0] || "");

  return {
    pid,
    executablePath: typeof best.ExecutablePath === "string" && best.ExecutablePath.trim() ? best.ExecutablePath : null,
    command: typeof best.CommandLine === "string" && best.CommandLine.trim() ? best.CommandLine : null,
    cwd: matchesExpectedExecutable ? target?.cwd || null : null,
  };
}

async function terminateDesktopMcpProcess(pid: number): Promise<void> {
  if (process.platform === "win32") {
    const result = await runProcess(["taskkill", "/PID", String(pid), "/T", "/F"], {
      timeoutMs: 15000,
    });
    const details = `${result.stdout}\n${result.stderr}`.trim();
    if (result.ok) {
      return;
    }
    if (/not found|no running instance|does not exist/i.test(details)) {
      return;
    }
    throw new Error(details || `taskkill exited with code ${result.code}`);
  }

  process.kill(pid, "SIGTERM");
}

export async function getDesktopMcpStatus(): Promise<DesktopMcpStatus> {
  const running = getRunningRuntime();
  if (running) {
    return {
      running: true,
      host: DESKTOP_MCP_HOST,
      port: DESKTOP_MCP_PORT,
      url: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`,
      taskId: readTaskId(desktopMcpTask),
      taskStatus: desktopMcpTask?.status || null,
      pid: running.process.pid || null,
      command: running.command.join(" "),
      cwd: running.cwd,
    };
  }

  let target: DesktopMcpServiceTarget | null = null;
  try {
    target = resolveDesktopMcpServiceTarget();
  } catch {
    target = null;
  }

  const observed = await findDesktopMcpProcess(target);
  return {
    running: observed !== null,
    host: DESKTOP_MCP_HOST,
    port: DESKTOP_MCP_PORT,
    url: `http://${DESKTOP_MCP_HOST}:${DESKTOP_MCP_PORT}/mcp`,
    taskId: readTaskId(desktopMcpTask),
    taskStatus: desktopMcpTask?.status || (observed ? "success" : null),
    pid: observed?.pid || null,
    command: observed?.command || (target ? target.command.join(" ") : null),
    cwd: observed?.cwd || target?.cwd || null,
  };
}

export async function startDesktopMcpServerTask(): Promise<{ task: Task; reused: boolean }> {
  const running = getRunningRuntime();
  if (running) {
    appendTaskLog(running.task, "Desktop MCP service is already running. Reusing existing process.");
    desktopMcpTask = running.task;
    return { task: running.task, reused: true };
  }

  const target = resolveDesktopMcpServiceTarget();
  const observed = await findDesktopMcpProcess(target);
  if (observed) {
    const task = desktopMcpTask || createTask(DESKTOP_MCP_TASK_TYPE, "Desktop Control MCP", 1);
    desktopMcpTask = task;
    task.step = 1;
    finishDesktopMcpTask(task, "success", `Desktop MCP service is already running. PID: ${observed.pid}`);
    if (observed.command) {
      appendTaskLog(task, `Command: ${observed.command}`);
    }
    appendTaskLog(task, `Cwd: ${observed.cwd || target.cwd}`);
    return { task, reused: true };
  }

  const task = buildDesktopMcpTask(target);

  try {
    const proc = Bun.spawn({
      cmd: target.command,
      cwd: target.cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    const runtimeEntry: DesktopMcpRuntimeEntry = {
      process: proc,
      command: target.command,
      cwd: target.cwd,
      task,
      stopping: false,
    };

    desktopMcpRuntime = runtimeEntry;
    desktopMcpTask = task;

    void streamProcessLogs(task, proc.stdout, "info");
    void streamProcessLogs(task, proc.stderr, "error");
    void proc.exited.then((exitCode) => {
      if (desktopMcpRuntime === runtimeEntry) {
        desktopMcpRuntime = null;
      }
      if (!runtimeEntry.stopping) {
        finishDesktopMcpTask(
          runtimeEntry.task,
          exitCode === 0 ? "success" : "failed",
          exitCode === 0
            ? "Desktop MCP service exited."
            : `Desktop MCP service exited unexpectedly (code ${exitCode}).`,
          exitCode === 0 ? "info" : "error",
        );
      }
    });

    await Bun.sleep(600);
    if (proc.exitCode !== null) {
      desktopMcpRuntime = null;
      finishDesktopMcpTask(
        task,
        "failed",
        `Desktop MCP service exited immediately (code ${proc.exitCode}).`,
        "error",
      );
      return { task, reused: false };
    }

    finishDesktopMcpTask(task, "success", `Desktop MCP service started. PID: ${proc.pid}`);
    return { task, reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishDesktopMcpTask(task, "failed", message, "error");
    desktopMcpRuntime = null;
    desktopMcpTask = task;
    throw error;
  }
}

export async function stopDesktopMcpServerTask(): Promise<{ task: Task; reused: boolean }> {
  const task = desktopMcpTask || createTask(DESKTOP_MCP_TASK_TYPE, "Desktop Control MCP", 1);
  desktopMcpTask = task;

  const runtime = getRunningRuntime();
  if (runtime) {
    appendTaskLog(task, "Stopping Desktop MCP service...");
    try {
      runtime.stopping = true;
      desktopMcpRuntime = null;
      await terminateDesktopMcpProcess(runtime.process.pid);
      await runtime.process.exited;
      return {
        task: finishDesktopMcpTask(task, "success", `Desktop MCP service stopped (PID ${runtime.process.pid}).`),
        reused: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finishDesktopMcpTask(task, "failed", message, "error");
      throw error;
    }
  }

  let target: DesktopMcpServiceTarget | null = null;
  try {
    target = resolveDesktopMcpServiceTarget();
  } catch {
    target = null;
  }

  const observed = await findDesktopMcpProcess(target);
  if (!observed) {
    return {
      task: finishDesktopMcpTask(task, "success", "Desktop MCP service is already stopped."),
      reused: true,
    };
  }

  appendTaskLog(task, `Stopping Desktop MCP service (PID ${observed.pid})...`);
  try {
    await terminateDesktopMcpProcess(observed.pid);
    return {
      task: finishDesktopMcpTask(task, "success", `Desktop MCP service stopped (PID ${observed.pid}).`),
      reused: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishDesktopMcpTask(task, "failed", message, "error");
    throw error;
  }
}
