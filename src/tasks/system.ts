import { checkWslCommandRequirements, REQUIRED_WSL_COMMANDS } from "../system/wsl-requirements";
import { normalizeOutput, runWslScript, troubleshootingTips } from "./shell";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import type { Step } from "./runner";

const OPENCLAW_SOURCE_DIR = "/data/openclaw";

function buildGitRepairScript(): string {
  return [
    "set -euo pipefail",
    'if type -P git >/dev/null 2>&1; then',
    '  echo "git 已存在：$(type -P git)"',
    "  exit 0",
    "fi",
    'echo "检测到缺少 git，开始安装..."',
    "export DEBIAN_FRONTEND=noninteractive",
    "apt-get update",
    "apt-get install -y git",
    "git --version",
  ].join("\n");
}

function buildNodeToolsRepairScript(): string {
  return [
    "set -euo pipefail",
    'if ! type -P npm >/dev/null 2>&1; then',
    '  echo "缺少 npm，开始安装 nodejs npm..."',
    "  export DEBIAN_FRONTEND=noninteractive",
    "  apt-get update",
    "  apt-get install -y nodejs npm",
    "fi",
    'if ! type -P pnpm >/dev/null 2>&1; then',
    '  echo "检测到缺少 pnpm，开始安装..."',
    "  if type -P corepack >/dev/null 2>&1; then",
    "    corepack enable",
    "    corepack prepare pnpm@latest --activate",
    "  else",
    "    npm install -g pnpm",
    "  fi",
    "fi",
    'if ! type -P nrm >/dev/null 2>&1; then',
    '  echo "检测到缺少 nrm，开始安装..."',
    "  npm install -g nrm",
    "fi",
    'echo "pnpm 路径：$(type -P pnpm 2>/dev/null || echo not-found)"',
    'echo "nrm 路径：$(type -P nrm 2>/dev/null || echo not-found)"',
  ].join("\n");
}

function buildOpenclawRepairScript(): string {
  return [
    "set -euo pipefail",
    'if type -P openclaw >/dev/null 2>&1; then',
    '  echo "openclaw 已存在：$(type -P openclaw)"',
    "  exit 0",
    "fi",
    `if [ ! -d "${OPENCLAW_SOURCE_DIR}" ]; then`,
    `  echo "目录不存在：${OPENCLAW_SOURCE_DIR}。请先在 WSL 安装 openclaw 源码。" >&2`,
    "  exit 1",
    "fi",
    'if ! type -P pnpm >/dev/null 2>&1; then',
    '  echo "缺少 pnpm，无法修复 openclaw。请先执行 pnpm 修复步骤。" >&2',
    "  exit 1",
    "fi",
    `cd "${OPENCLAW_SOURCE_DIR}"`,
    "pnpm install",
    'if ! type -P openclaw >/dev/null 2>&1; then',
    '  echo "openclaw 仍缺失，尝试创建命令封装到 /usr/local/bin/openclaw"',
    "  mkdir -p /usr/local/bin",
    "  cat > /usr/local/bin/openclaw <<'EOF'",
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `cd "${OPENCLAW_SOURCE_DIR}"`,
    'exec pnpm exec openclaw "$@"',
    "EOF",
    "  chmod +x /usr/local/bin/openclaw",
    "fi",
    'if ! type -P openclaw >/dev/null 2>&1; then',
    '  echo "openclaw 命令仍不可用，请手工检查 /data/openclaw 与 pnpm 依赖。" >&2',
    "  exit 1",
    "fi",
    "openclaw --version || true",
  ].join("\n");
}

function normalizeMissingCommands(missing: string[]): string[] {
  const known = new Set<string>(REQUIRED_WSL_COMMANDS);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const raw of missing) {
    const command = raw.trim();
    if (!command || seen.has(command) || !known.has(command)) {
      continue;
    }
    seen.add(command);
    ordered.push(command);
  }

  return ordered;
}

export function buildWslRepairSteps(missing: string[]): Step[] {
  const normalized = normalizeMissingCommands(missing);
  const set = new Set(normalized);
  const steps: Step[] = [];

  if (set.has("git")) {
    steps.push({
      name: "修复 git",
      command: "apt-get update && apt-get install -y git",
      script: buildGitRepairScript(),
    });
  }

  if (set.has("pnpm") || set.has("nrm")) {
    steps.push({
      name: "修复 pnpm / nrm",
      command: "install pnpm + nrm",
      script: buildNodeToolsRepairScript(),
    });
  }

  if (set.has("openclaw")) {
    steps.push({
      name: "修复 openclaw",
      command: "cd /data/openclaw && pnpm install (+ shim)",
      script: buildOpenclawRepairScript(),
    });
  }

  return steps;
}

function isBenignShellNoise(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return normalized === "logout";
}

function logProbeOutput(task: Task, title: string, output: string, forceError = false): void {
  for (const line of normalizeOutput(output)) {
    const level = forceError && !isBenignShellNoise(line) ? "error" : "info";
    appendTaskLog(task, `${title}${line}`, level);
  }
}

function logCommandStatuses(task: Task, title: string, commands: Array<{ command: string; exists: boolean; path?: string }>): void {
  if (commands.length === 0) {
    appendTaskLog(task, `${title}无有效命令状态。`);
    return;
  }
  for (const item of commands) {
    const suffix = item.path ? ` (${item.path})` : "";
    appendTaskLog(
      task,
      `${title}${item.command}: ${item.exists ? "已就绪" : "缺失"}${suffix}`,
      item.exists ? "info" : "error"
    );
  }
}

async function runWslStep(task: Task, step: number, totalSteps: number, current: Step): Promise<void> {
  task.step = step;
  appendTaskLog(task, `步骤 ${step}/${totalSteps}：${current.name}`);
  appendTaskLog(task, `执行命令：${current.command}`);

  const result = await runWslScript(current.script);

  for (const line of normalizeOutput(result.stdout)) {
    appendTaskLog(task, line, "info");
  }

  for (const line of normalizeOutput(result.stderr)) {
    appendTaskLog(task, line, result.ok ? "info" : "error");
  }

  if (!result.ok) {
    for (const tip of troubleshootingTips(result.stderr)) {
      appendTaskLog(task, `修复建议：${tip}`, "error");
    }
    throw new Error(`${current.name} 执行失败（退出码 ${result.code}）`);
  }
}

export function startWslRepairTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("wsl-repair");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有环境修复任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const task = createTask("wsl-repair", "环境修复", 1);
  task.status = "running";

  (async () => {
    try {
      task.step = 1;
      appendTaskLog(task, "步骤 1/1：检测 WSL 缺少命令");
      const initial = await checkWslCommandRequirements();
      appendTaskLog(task, `探测模式：${initial.probeMethod === "marker" ? "标记探测" : "逐命令退出码回退"}`);
      for (const line of initial.diagnostics) {
        appendTaskLog(task, `探测详情：${line}`);
      }
      logCommandStatuses(task, "命令状态：", initial.commands);

      if (initial.stdout.trim().length > 0) {
        logProbeOutput(task, "检测输出(stdout)：", initial.stdout);
      }
      if (initial.stderr.trim().length > 0) {
        logProbeOutput(task, "检测输出(stderr)：", initial.stderr, !initial.ok);
      }

      if (initial.ok) {
        appendTaskLog(task, "未检测到缺失命令，无需修复。");
        task.status = "success";
        task.endedAt = new Date().toISOString();
        appendTaskLog(task, "任务完成");
        return;
      }

      if (initial.missing.length === 0) {
        throw new Error("WSL 命令探测失败：输出异常，未识别到有效探测结果。请先检查 WSL shell 初始化脚本。");
      }

      appendTaskLog(task, `检测到缺失命令：${initial.missing.join(", ")}`, "error");

      const repairSteps = buildWslRepairSteps(initial.missing);
      if (repairSteps.length === 0) {
        throw new Error(`当前缺失命令暂不支持自动修复：${initial.missing.join(", ")}`);
      }

      task.totalSteps = 1 + repairSteps.length + 1;

      for (let index = 0; index < repairSteps.length; index += 1) {
        await runWslStep(task, index + 2, task.totalSteps, repairSteps[index]);
      }

      task.step = task.totalSteps;
      appendTaskLog(task, `步骤 ${task.totalSteps}/${task.totalSteps}：复检命令`);
      const finalCheck = await checkWslCommandRequirements();
      appendTaskLog(task, `复检模式：${finalCheck.probeMethod === "marker" ? "标记探测" : "逐命令退出码回退"}`);
      for (const line of finalCheck.diagnostics) {
        appendTaskLog(task, `复检详情：${line}`);
      }
      logCommandStatuses(task, "复检命令：", finalCheck.commands);
      if (finalCheck.stdout.trim().length > 0) {
        logProbeOutput(task, "复检输出(stdout)：", finalCheck.stdout);
      }
      if (finalCheck.stderr.trim().length > 0) {
        logProbeOutput(task, "复检输出(stderr)：", finalCheck.stderr, !finalCheck.ok);
      }
      if (!finalCheck.ok && finalCheck.missing.length === 0) {
        throw new Error("修复后复检失败：命令探测输出异常，未识别到有效探测结果。");
      }
      if (!finalCheck.ok && finalCheck.missing.length > 0) {
        throw new Error(`修复后仍缺少命令：${finalCheck.missing.join(", ")}`);
      }

      appendTaskLog(task, "所有必需命令已就绪：openclaw, git, pnpm, nrm。");
      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "任务完成");
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
