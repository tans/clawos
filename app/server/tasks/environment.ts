import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import { normalizeOutput, runProcess, runWslScript, type CommandResult } from "./shell";

type EnvironmentTarget = "windows" | "wsl";
type EnvironmentTool = "python" | "uv" | "bun";
type TargetToolStatus = Record<EnvironmentTool, { installed: boolean; version: string | null }>;

export type EnvironmentStatusSnapshot = Record<EnvironmentTarget, TargetToolStatus>;

const IS_WINDOWS = process.platform === "win32";

function appendCommandLogs(task: Task, result: CommandResult): void {
  for (const line of normalizeOutput(result.stdout)) {
    appendTaskLog(task, line, "info");
  }
  for (const line of normalizeOutput(result.stderr)) {
    appendTaskLog(task, line, result.ok ? "info" : "error");
  }
}

function readTargetLabel(target: EnvironmentTarget): string {
  return target === "windows" ? "Windows" : "WSL";
}

function readToolLabel(tool: EnvironmentTool): string {
  if (tool === "python") return "Python";
  if (tool === "uv") return "uv";
  return "bun";
}

function createEmptyTargetStatus(): TargetToolStatus {
  return {
    python: { installed: false, version: null },
    uv: { installed: false, version: null },
    bun: { installed: false, version: null },
  };
}

function parseProbeLines(output: string): Partial<Record<EnvironmentTool, string>> {
  const result: Partial<Record<EnvironmentTool, string>> = {};
  for (const line of normalizeOutput(output)) {
    const match = line.match(/^__(python|uv|bun)__=(.*)$/);
    if (!match) {
      continue;
    }
    const key = match[1] as EnvironmentTool;
    const value = match[2] ? match[2].trim() : "";
    result[key] = value;
  }
  return result;
}

function toTargetStatus(raw: Partial<Record<EnvironmentTool, string>>): TargetToolStatus {
  const next = createEmptyTargetStatus();
  for (const tool of ["python", "uv", "bun"] as const) {
    const version = (raw[tool] || "").trim();
    next[tool] = {
      installed: version.length > 0,
      version: version.length > 0 ? version : null,
    };
  }
  return next;
}

async function probeWindowsStatus(): Promise<TargetToolStatus> {
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "function EmitVersion([string]$name, [string]$value) {",
    "  if (-not $value) { $value = '' }",
    '  Write-Output ("__" + $name + "__=" + $value.Trim())',
    "}",
    "$python = ''",
    "if (Get-Command python -ErrorAction SilentlyContinue) {",
    "  $python = ((python --version) 2>&1 | Select-Object -First 1)",
    "} elseif (Test-Path \"$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe\") {",
    "  $python = ((& \"$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe\" --version) 2>&1 | Select-Object -First 1)",
    "}",
    "$uv = ''",
    "if (Get-Command uv -ErrorAction SilentlyContinue) {",
    "  $uv = ((uv --version) 2>&1 | Select-Object -First 1)",
    "} elseif (Test-Path \"$env:USERPROFILE\\.local\\bin\\uv.exe\") {",
    "  $uv = ((& \"$env:USERPROFILE\\.local\\bin\\uv.exe\" --version) 2>&1 | Select-Object -First 1)",
    "}",
    "$bun = ''",
    "if (Get-Command bun -ErrorAction SilentlyContinue) {",
    "  $bun = ((bun --version) 2>&1 | Select-Object -First 1)",
    "} elseif (Test-Path \"$env:USERPROFILE\\.bun\\bin\\bun.exe\") {",
    "  $bun = ((& \"$env:USERPROFILE\\.bun\\bin\\bun.exe\" --version) 2>&1 | Select-Object -First 1)",
    "}",
    "EmitVersion 'python' ([string]$python)",
    "EmitVersion 'uv' ([string]$uv)",
    "EmitVersion 'bun' ([string]$bun)",
  ].join("\n");

  const result = await runProcess(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    timeoutMs: 15_000,
  });
  if (!result.ok) {
    return createEmptyTargetStatus();
  }
  return toTargetStatus(parseProbeLines(result.stdout));
}

async function probeWslStatus(): Promise<TargetToolStatus> {
  const script = [
    "set +e",
    "python_ver=''",
    "if command -v python3 >/dev/null 2>&1; then python_ver=\"$(python3 --version 2>&1 | head -n1)\"; fi",
    "uv_ver=''",
    "if command -v uv >/dev/null 2>&1; then",
    "  uv_ver=\"$(uv --version 2>&1 | head -n1)\"",
    "elif [ -x \"$HOME/.local/bin/uv\" ]; then",
    "  uv_ver=\"$(\"$HOME/.local/bin/uv\" --version 2>&1 | head -n1)\"",
    "fi",
    "bun_ver=''",
    "if command -v bun >/dev/null 2>&1; then",
    "  bun_ver=\"$(bun --version 2>&1 | head -n1)\"",
    "elif [ -x \"$HOME/.bun/bin/bun\" ]; then",
    "  bun_ver=\"$(\"$HOME/.bun/bin/bun\" --version 2>&1 | head -n1)\"",
    "fi",
    "echo \"__python__=${python_ver}\"",
    "echo \"__uv__=${uv_ver}\"",
    "echo \"__bun__=${bun_ver}\"",
  ].join("\n");

  const result = await runWslScript(script, { shellMode: "login", loginShell: true });
  if (!result.ok) {
    return createEmptyTargetStatus();
  }
  return toTargetStatus(parseProbeLines(result.stdout));
}

export async function probeEnvironmentStatus(): Promise<EnvironmentStatusSnapshot> {
  if (!IS_WINDOWS) {
    return {
      windows: createEmptyTargetStatus(),
      wsl: createEmptyTargetStatus(),
    };
  }

  const [windows, wsl] = await Promise.all([probeWindowsStatus(), probeWslStatus()]);
  return { windows, wsl };
}

async function runWindowsInstall(task: Task, tool: EnvironmentTool): Promise<void> {
  const scripts: Record<EnvironmentTool, string> = {
    python: [
      "$ErrorActionPreference = 'Stop'",
      "if (Get-Command python -ErrorAction SilentlyContinue) { python --version; exit 0 }",
      "if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'winget not found, cannot install Python automatically.' }",
      "winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements",
      "if (Get-Command python -ErrorAction SilentlyContinue) { python --version; exit 0 }",
      "if (Test-Path \"$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe\") {",
      "  & \"$env:LOCALAPPDATA\\Programs\\Python\\Python312\\python.exe\" --version",
      "  exit 0",
      "}",
      "throw 'Python installation finished but python command is still not available in current session.'",
    ].join("\n"),
    uv: [
      "$ErrorActionPreference = 'Stop'",
      "if (Get-Command uv -ErrorAction SilentlyContinue) { uv --version; exit 0 }",
      "Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression",
      "if (Get-Command uv -ErrorAction SilentlyContinue) { uv --version; exit 0 }",
      "if (Test-Path \"$env:USERPROFILE\\.local\\bin\\uv.exe\") {",
      "  & \"$env:USERPROFILE\\.local\\bin\\uv.exe\" --version",
      "  exit 0",
      "}",
      "throw 'uv installation finished but uv command is still not available in current session.'",
    ].join("\n"),
    bun: [
      "$ErrorActionPreference = 'Stop'",
      "if (Get-Command bun -ErrorAction SilentlyContinue) { bun --version; exit 0 }",
      "Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression",
      "if (Get-Command bun -ErrorAction SilentlyContinue) { bun --version; exit 0 }",
      "if (Test-Path \"$env:USERPROFILE\\.bun\\bin\\bun.exe\") {",
      "  & \"$env:USERPROFILE\\.bun\\bin\\bun.exe\" --version",
      "  exit 0",
      "}",
      "throw 'bun installation finished but bun command is still not available in current session.'",
    ].join("\n"),
  };

  const commandArgs = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", scripts[tool]];
  appendTaskLog(task, "Run: powershell.exe install script");
  const result = await runProcess(commandArgs, { timeoutMs: 20 * 60 * 1000 });
  appendCommandLogs(task, result);
  if (!result.ok) {
    throw new Error(`Windows install failed (exit code ${result.code})`);
  }
}

async function runWslInstall(task: Task, tool: EnvironmentTool): Promise<void> {
  const scripts: Record<EnvironmentTool, string> = {
    python: [
      "set -euo pipefail",
      "if command -v python3 >/dev/null 2>&1; then python3 --version; exit 0; fi",
      "SUDO=''",
      "if [ \"$(id -u)\" -ne 0 ]; then",
      "  if command -v sudo >/dev/null 2>&1; then",
      "    SUDO='sudo'",
      "  else",
      "    echo 'sudo not found and current user is not root; cannot install Python automatically.' >&2",
      "    exit 1",
      "  fi",
      "fi",
      "$SUDO apt-get update",
      "$SUDO apt-get install -y python3 python3-pip",
      "python3 --version",
    ].join("\n"),
    uv: [
      "set -euo pipefail",
      "if command -v uv >/dev/null 2>&1; then uv --version; exit 0; fi",
      "if ! command -v curl >/dev/null 2>&1; then",
      "  SUDO=''",
      "  if [ \"$(id -u)\" -ne 0 ]; then",
      "    if command -v sudo >/dev/null 2>&1; then SUDO='sudo'; else echo 'sudo not found and curl missing.' >&2; exit 1; fi",
      "  fi",
      "  $SUDO apt-get update",
      "  $SUDO apt-get install -y curl ca-certificates",
      "fi",
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
      "if command -v uv >/dev/null 2>&1; then uv --version; exit 0; fi",
      "if [ -x \"$HOME/.local/bin/uv\" ]; then \"$HOME/.local/bin/uv\" --version; exit 0; fi",
      "echo 'uv installation finished but uv command is still not available in current shell.' >&2",
      "exit 1",
    ].join("\n"),
    bun: [
      "set -euo pipefail",
      "if command -v bun >/dev/null 2>&1; then bun --version; exit 0; fi",
      "if ! command -v curl >/dev/null 2>&1; then",
      "  SUDO=''",
      "  if [ \"$(id -u)\" -ne 0 ]; then",
      "    if command -v sudo >/dev/null 2>&1; then SUDO='sudo'; else echo 'sudo not found and curl missing.' >&2; exit 1; fi",
      "  fi",
      "  $SUDO apt-get update",
      "  $SUDO apt-get install -y curl ca-certificates",
      "fi",
      "curl -fsSL https://bun.sh/install | bash",
      "if command -v bun >/dev/null 2>&1; then bun --version; exit 0; fi",
      "if [ -x \"$HOME/.bun/bin/bun\" ]; then \"$HOME/.bun/bin/bun\" --version; exit 0; fi",
      "echo 'bun installation finished but bun command is still not available in current shell.' >&2",
      "exit 1",
    ].join("\n"),
  };

  appendTaskLog(task, "Run: wsl install script");
  const result = await runWslScript(scripts[tool], { shellMode: "login", loginShell: true });
  appendCommandLogs(task, result);
  if (!result.ok) {
    throw new Error(`WSL install failed (exit code ${result.code})`);
  }
}

async function verifyInstall(task: Task, target: EnvironmentTarget, tool: EnvironmentTool): Promise<void> {
  if (target === "windows") {
    const cmdMap: Record<EnvironmentTool, string[]> = {
      python: ["python", "--version"],
      uv: ["uv", "--version"],
      bun: ["bun", "--version"],
    };
    appendTaskLog(task, `Verify: ${cmdMap[tool].join(" ")}`);
    const result = await runProcess(cmdMap[tool], { timeoutMs: 10_000 });
    appendCommandLogs(task, result);
    if (!result.ok) {
      throw new Error(`Verification failed: ${cmdMap[tool].join(" ")} (exit code ${result.code})`);
    }
    return;
  }

  const verifyScripts: Record<EnvironmentTool, string> = {
    python: "set -euo pipefail\npython3 --version",
    uv: "set -euo pipefail\nif command -v uv >/dev/null 2>&1; then uv --version; else \"$HOME/.local/bin/uv\" --version; fi",
    bun: "set -euo pipefail\nif command -v bun >/dev/null 2>&1; then bun --version; else \"$HOME/.bun/bin/bun\" --version; fi",
  };
  appendTaskLog(task, "Verify in WSL");
  const result = await runWslScript(verifyScripts[tool], { shellMode: "login", loginShell: true });
  appendCommandLogs(task, result);
  if (!result.ok) {
    throw new Error(`WSL verification failed (exit code ${result.code})`);
  }
}

export function startEnvironmentInstallTask(
  target: EnvironmentTarget,
  tool: EnvironmentTool
): { task: Task; reused: boolean } {
  const taskType = `environment-install-${target}-${tool}`;
  const runningTask = findRunningTask(taskType);
  if (runningTask) {
    appendTaskLog(runningTask, "Detected same install task is running. Reusing existing task.");
    return { task: runningTask, reused: true };
  }

  const targetLabel = readTargetLabel(target);
  const toolLabel = readToolLabel(tool);
  const task = createTask(taskType, `环境配置：安装 ${targetLabel} ${toolLabel}`, 2);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("Environment install tasks are only supported on Windows host.");
      }

      task.step = 1;
      appendTaskLog(task, `Step 1/2: install ${toolLabel} in ${targetLabel}`);
      if (target === "windows") {
        await runWindowsInstall(task, tool);
      } else {
        await runWslInstall(task, tool);
      }

      task.step = 2;
      appendTaskLog(task, `Step 2/2: verify ${toolLabel} in ${targetLabel}`);
      await verifyInstall(task, target, tool);

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
