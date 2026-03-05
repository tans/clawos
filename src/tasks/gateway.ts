import { callGatewayMethodViaCli, type GatewayCliCallResult } from "../openclaw/gateway-cli";
import { readNonEmptyString } from "../lib/value";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import { openclawCliTroubleshootingTips, runOpenclawCli } from "../openclaw/cli";
import { runTask, type Step } from "./runner";
import { normalizeOutput, runProcess, runWslScript } from "./shell";
import {
  readLocalOpenclawSourceVersionHash,
  resolveOpenclawConfigPath,
  updateLocalOpenclawSourceVersionHash,
} from "../config/local";
import { existsSync } from "node:fs";
import path from "node:path";

const IS_WINDOWS = process.platform === "win32";
export const DEFAULT_QWCLI_EXE_PATH = "c:\\xiake\\qwcli\\cli.exe";
export const OPENCLAW_SOURCE_DIR = "/data/openclaw";
const QW_GATEWAY_STABLE_WINDOW_MS = 10_000;

type QwGatewayRestartTrigger = "manual" | "startup";
type QwGatewayStartupState = "idle" | "running" | "success" | "failed" | "unsupported";

type QwGatewayStartupStatus = {
  state: QwGatewayStartupState;
  source: QwGatewayRestartTrigger | null;
  taskId: string | null;
  message: string;
  updatedAt: string | null;
};

export type OpenclawConfigBackup = {
  path: string;
  fileName: string;
  modifiedAt: string;
  modifiedAtEpoch: number;
  size: number;
};

const qwGatewayStartupStatus: QwGatewayStartupStatus = {
  state: "idle",
  source: null,
  taskId: null,
  message: "尚未执行企微网关重启任务。",
  updatedAt: null,
};

function setQwGatewayStartupStatus(next: Partial<QwGatewayStartupStatus>): void {
  if (typeof next.state === "string") {
    qwGatewayStartupStatus.state = next.state;
  }
  if (Object.prototype.hasOwnProperty.call(next, "source")) {
    qwGatewayStartupStatus.source = next.source || null;
  }
  if (Object.prototype.hasOwnProperty.call(next, "taskId")) {
    qwGatewayStartupStatus.taskId = next.taskId || null;
  }
  if (typeof next.message === "string") {
    qwGatewayStartupStatus.message = next.message;
  }
  qwGatewayStartupStatus.updatedAt = new Date().toISOString();
}

export function getQwGatewayStartupStatus(): QwGatewayStartupStatus {
  return { ...qwGatewayStartupStatus };
}

function buildQwGatewayProbeArgs(): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$p = Get-Process -Name 'cli' -ErrorAction SilentlyContinue; if ($p) { exit 0 } else { exit 1 }",
  ];
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

export function resolveQwcliExePath(): string {
  const fromEnv = process.env.CLAWOS_QWCLI_EXE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return DEFAULT_QWCLI_EXE_PATH;
}

export function resolveQwcliWorkingDirectory(exePath: string): string {
  return path.win32.dirname(exePath);
}

export function buildQwGatewayStartCommand(exePath: string, workingDirectory: string): string {
  return `Start-Process -FilePath '${escapePowerShellSingleQuoted(exePath)}' -WorkingDirectory '${escapePowerShellSingleQuoted(workingDirectory)}' -WindowStyle Hidden`;
}

export function buildQwGatewayStartArgs(exePath: string, workingDirectory: string): string[] {
  return [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildQwGatewayStartCommand(exePath, workingDirectory),
  ];
}

function appendPayloadLog(task: Task, title: string, payload: unknown, maxLines = 120): void {
  const raw = JSON.stringify(payload, null, 2);
  if (!raw) {
    appendTaskLog(task, `${title}：<empty>`);
    return;
  }

  const lines = raw.split(/\r?\n/g);
  const limit = Math.max(1, maxLines);
  const view = lines.slice(0, limit);
  for (const line of view) {
    appendTaskLog(task, `${title} ${line}`);
  }
  if (lines.length > limit) {
    appendTaskLog(task, `${title} ...（已截断，共 ${lines.length} 行）`);
  }
}

async function runGatewayTaskStep(
  task: Task,
  step: number,
  totalSteps: number,
  name: string,
  method: string,
  params: unknown,
  _timeoutMs: number
): Promise<GatewayCliCallResult<unknown>> {
  task.step = step;
  appendTaskLog(task, `步骤 ${step}/${totalSteps}：${name}`);
  appendTaskLog(task, `执行命令：openclaw gateway call ${method}`);

  const result = await callGatewayMethodViaCli(method, params);
  const envelope = result.envelope as Record<string, unknown> | null;

  if (step === 1 && envelope) {
    const version =
      readNonEmptyString((envelope as Record<string, unknown>).version) ||
      readNonEmptyString((envelope.server as Record<string, unknown> | undefined)?.version);
    if (version) {
      appendTaskLog(task, `网关版本：${version}`);
    }
  }

  appendPayloadLog(task, `${method} 返回`, result.payload, 80);
  return result;
}

function buildOpenclawStepScript(command: string): string {
  return `set -euo pipefail\ncd ${OPENCLAW_SOURCE_DIR}\n${command}`;
}

function escapeDoubleQuotedShell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

export function buildOpenclawConfigBackupListScript(configPath: string): string {
  const safeConfigPath = escapeDoubleQuotedShell(configPath);
  return [
    "set -euo pipefail",
    `config_path_raw="${safeConfigPath}"`,
    'if [ "$config_path_raw" = "~" ]; then',
    '  config_path="$HOME"',
    'elif [[ "$config_path_raw" == "~/"* ]]; then',
    '  config_path="$HOME/${config_path_raw#~/}"',
    "else",
    '  config_path="$config_path_raw"',
    "fi",
    'config_dir="$(dirname "$config_path")"',
    'if [ ! -d "$config_dir" ]; then',
    "  exit 0",
    "fi",
    "shopt -s nullglob",
    'config_base="$(basename "$config_path")"',
    'files=("$config_dir"/"$config_base"*.bak*)',
    'if [ "${#files[@]}" -eq 0 ]; then',
    "  exit 0",
    "fi",
    'for file in "${files[@]}"; do',
    '  if [ -f "$file" ]; then',
    '    stat_out=""',
    '    if stat_out="$(stat -c "%Y %s" "$file" 2>/dev/null)"; then',
    "      :",
    '    elif stat_out="$(stat -f "%m %z" "$file" 2>/dev/null)"; then',
    "      :",
    "    else",
    '      echo "读取备份文件元数据失败：$file" >&2',
    "      continue",
    "    fi",
    '    mtime="$(printf "%s" "$stat_out" | awk \'{print $1}\')"',
    '    size="$(printf "%s" "$stat_out" | awk \'{print $2}\')"',
    '    if [ -z "$mtime" ] || [ -z "$size" ]; then',
    "      continue",
    "    fi",
    '    printf "%s\\t%s\\t%s\\n" "$mtime" "$size" "$file"',
    "  fi",
    'done | sort -rn -k1,1',
  ].join("\n");
}

export function parseOpenclawConfigBackupLine(line: string): OpenclawConfigBackup | null {
  const match = line.match(/^(\d+)\t(\d+)\t(.+)$/);
  if (!match) {
    return null;
  }

  const modifiedAtEpoch = Number(match[1]);
  const size = Number(match[2]);
  const backupPath = match[3].trim();
  if (!Number.isFinite(modifiedAtEpoch) || !Number.isFinite(size) || !backupPath) {
    return null;
  }

  return {
    path: backupPath,
    fileName: path.posix.basename(backupPath),
    modifiedAt: new Date(modifiedAtEpoch * 1000).toISOString(),
    modifiedAtEpoch,
    size,
  };
}

export async function listOpenclawConfigBackups(): Promise<OpenclawConfigBackup[]> {
  const configPath = resolveOpenclawConfigPath();
  const result = await runWslScript(buildOpenclawConfigBackupListScript(configPath));
  if (!result.ok) {
    throw new Error(`读取 openclaw 配置备份失败（退出码 ${result.code}）`);
  }

  return normalizeOutput(result.stdout)
    .map((line) => parseOpenclawConfigBackupLine(line))
    .filter((item): item is OpenclawConfigBackup => Boolean(item));
}

export function buildOpenclawConfigRollbackSteps(backupPath: string): Step[] {
  const configPath = resolveOpenclawConfigPath();
  const safeBackupPath = escapeDoubleQuotedShell(backupPath);
  const safeConfigPath = escapeDoubleQuotedShell(configPath);
  const stepCommand = `cp "${backupPath}" "${configPath}" && openclaw gateway restart`;
  const script = [
    "set -euo pipefail",
    `backup_path="${safeBackupPath}"`,
    `target_path_raw="${safeConfigPath}"`,
    'if [ "$target_path_raw" = "~" ]; then',
    '  target_path="$HOME"',
    'elif [[ "$target_path_raw" == "~/"* ]]; then',
    '  target_path="$HOME/${target_path_raw#~/}"',
    "else",
    '  target_path="$target_path_raw"',
    "fi",
    'if [ ! -f "$backup_path" ]; then',
    '  echo "备份文件不存在：$backup_path" >&2',
    "  exit 1",
    "fi",
    'backup_dir="$(dirname "$target_path")"',
    'mkdir -p "$backup_dir"',
    'if [ -f "$target_path" ]; then',
    '  rollback_snapshot="$target_path.before-rollback.$(date +%Y%m%d-%H%M%S).bak"',
    '  cp "$target_path" "$rollback_snapshot"',
    '  echo "已备份当前配置：$rollback_snapshot"',
    "else",
    '  echo "当前配置不存在，将直接从备份恢复。"',
    "fi",
    'cp "$backup_path" "$target_path"',
    'echo "已恢复配置：$backup_path -> $target_path"',
    "openclaw gateway restart",
  ].join("\n");

  return [
    {
      name: "回滚 openclaw.json 并重启 gateway",
      command: stepCommand,
      script,
    },
  ];
}

function buildGitForceSyncWithNoUpdateShortCircuitScript(recordedSourceHash: string): string {
  const safeRecordedSourceHash = escapeDoubleQuotedShell(recordedSourceHash.trim());
  return [
    "set -euo pipefail",
    `cd ${OPENCLAW_SOURCE_DIR}`,
    `saved_hash="${safeRecordedSourceHash}"`,
    'before_commit="$(git rev-parse HEAD)"',
    'before_origin_commit="$(git rev-parse --verify refs/remotes/origin/main 2>/dev/null || true)"',
    "git fetch origin main --prune",
    'remote_commit="$(git rev-parse origin/main)"',
    'echo "__CLAWOS_REMOTE_COMMIT__=$remote_commit"',
    'echo "同步前本地提交: $before_commit"',
    'if [ -n "$before_origin_commit" ] && [ "$before_origin_commit" != "$remote_commit" ]; then',
    '  echo "远端跟踪分支已刷新: $before_origin_commit -> $remote_commit"',
    "fi",
    'echo "同步后远端提交: $remote_commit"',
    "git reset --hard origin/main",
    "git clean -fd",
    'if [ -n "$saved_hash" ] && [ "$saved_hash" = "$remote_commit" ]; then',
    '  echo "版本 hash 未变化（$saved_hash），后续安装与构建步骤已自动跳过。"',
    '  echo "__CLAWOS_TASK_EARLY_SUCCESS__"',
    "else",
    '  echo "源码已更新：$before_commit -> $remote_commit"',
    '  if [ -n "$saved_hash" ]; then',
    '    echo "上次记录 hash: $saved_hash"',
    "  else",
    '    echo "上次记录 hash: <empty>"',
    "  fi",
    '  echo "将继续执行安装与构建步骤。"',
    "fi",
  ].join("\n");
}

export function buildOpenclawSourceUpdateSteps(recordedSourceHash = ""): Step[] {
  return [
    {
      name: "进入源码目录",
      command: `cd ${OPENCLAW_SOURCE_DIR}`,
      script: `set -euo pipefail\nif [ ! -d ${OPENCLAW_SOURCE_DIR} ]; then\n  echo "目录不存在：${OPENCLAW_SOURCE_DIR}。请先在 WSL 中安装 openclaw 源码。" >&2\n  exit 1\nfi\ncd ${OPENCLAW_SOURCE_DIR}\npwd`,
    },
    {
      name: "强制同步源码（覆盖本地改动）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && git fetch origin main --prune && git reset --hard origin/main && git clean -fd`,
      script: buildGitForceSyncWithNoUpdateShortCircuitScript(recordedSourceHash),
    },
    {
      name: "安装 nrm（npm i -g nrm）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && npm i -g nrm`,
      script: buildOpenclawStepScript("npm i -g nrm"),
    },
    {
      name: "切换 npm 源（nrm use tencent）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && nrm use tencent`,
      script: buildOpenclawStepScript("nrm use tencent"),
    },
    {
      name: "安装依赖（pnpm install）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && pnpm install`,
      script: buildOpenclawStepScript("pnpm install"),
    },
    {
      name: "构建主程序（pnpm run build）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && pnpm run build`,
      script: buildOpenclawStepScript("pnpm run build"),
    },
    {
      name: "构建 UI（pnpm run ui:build）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && pnpm run ui:build`,
      script: buildOpenclawStepScript("pnpm run ui:build"),
    },
    {
      name: "重启 gateway（openclaw gateway restart）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && openclaw gateway restart`,
      script: buildOpenclawStepScript("openclaw gateway restart"),
    },
  ];
}

export function startGatewayUpdateTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("gateway-update");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有更新任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const recordedSourceHash = readLocalOpenclawSourceVersionHash();
  const steps = buildOpenclawSourceUpdateSteps(recordedSourceHash);
  const task = createTask("gateway-update", "更新 openclaw（源码升级）", steps.length);
  let remoteCommitFromTask = "";

  if (recordedSourceHash) {
    appendTaskLog(task, `当前记录源码 hash：${recordedSourceHash}`);
  } else {
    appendTaskLog(task, "当前记录源码 hash：<empty>");
  }

  runTask(task, steps, {
    onStepSuccess: (info) => {
      if (info.stepIndex !== 1) {
        return;
      }
      const commit = readNonEmptyString(info.metadata.openclawRemoteCommit);
      if (!commit) {
        return;
      }
      remoteCommitFromTask = commit;
      appendTaskLog(task, `本次远端源码 hash：${commit}`);
    },
    onTaskSuccess: () => {
      if (!remoteCommitFromTask) {
        appendTaskLog(task, "未获取到本次远端源码 hash，已跳过本地 hash 写入。");
        return;
      }
      if (remoteCommitFromTask === recordedSourceHash) {
        return;
      }
      try {
        const savedHash = updateLocalOpenclawSourceVersionHash(remoteCommitFromTask);
        appendTaskLog(task, `已写入源码 hash 到 clawos.json：${savedHash}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendTaskLog(task, `写入源码 hash 失败：${message}`, "error");
      }
    },
  });

  return { task, reused: false };
}

export async function startOpenclawConfigRollbackTask(
  backupPath: string
): Promise<{ task: Task; reused: boolean }> {
  const runningTask = findRunningTask("openclaw-config-rollback");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有回滚任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const normalizedPath = backupPath.trim();
  if (!normalizedPath) {
    throw new Error("backupPath 不能为空。");
  }
  if (/[\r\n\0]/.test(normalizedPath)) {
    throw new Error("backupPath 包含非法字符。");
  }

  const backups = await listOpenclawConfigBackups();
  const targetBackup = backups.find((item) => item.path === normalizedPath);
  if (!targetBackup) {
    throw new Error(`未找到指定备份：${normalizedPath}`);
  }

  const steps = buildOpenclawConfigRollbackSteps(targetBackup.path);
  const task = createTask("openclaw-config-rollback", "回滚 openclaw.json", steps.length);
  appendTaskLog(task, `已选择备份：${targetBackup.fileName}`);
  appendTaskLog(task, `备份路径：${targetBackup.path}`);
  appendTaskLog(task, `备份时间：${targetBackup.modifiedAt}`);
  runTask(task, steps);
  return { task, reused: false };
}

export function startGatewayStatusTask(): Task {
  const task = createTask("gateway-status", "查看 gateway 状态", 3);
  task.status = "running";

  (async () => {
    try {
      await runGatewayTaskStep(task, 1, 3, "读取 status", "status", {}, 10000);
      await runGatewayTaskStep(task, 2, 3, "读取 health", "health", { probe: false }, 10000);
      await runGatewayTaskStep(
        task,
        3,
        3,
        "读取 channels.status",
        "channels.status",
        { probe: false, timeoutMs: 3000 },
        10000
      );

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "任务完成");
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
      for (const tip of openclawCliTroubleshootingTips(message)) {
        appendTaskLog(task, `修复建议：${tip}`, "error");
      }
    }
  })();

  return task;
}

export function startGatewayControlTask(
  action: "restart" | "install" | "uninstall" | "start" | "stop"
): Task {
  const commandMap: Record<typeof action, string[]> = {
    restart: ["gateway", "restart"],
    install: ["gateway", "install"],
    uninstall: ["gateway", "uninstall"],
    start: ["gateway", "start"],
    stop: ["gateway", "stop"],
  };

  const actionNameMap: Record<typeof action, string> = {
    restart: "重启 openclaw（CLI 兼容模式）",
    install: "安装 gateway 自启动（CLI 兼容模式）",
    uninstall: "取消 gateway 自启动（CLI 兼容模式）",
    start: "启动 gateway（CLI 兼容模式）",
    stop: "停止 gateway（CLI 兼容模式）",
  };

  const task = createTask(`gateway-${action}`, actionNameMap[action], 1);
  task.status = "running";

  (async () => {
    try {
      task.step = 1;
      appendTaskLog(task, `步骤 1/1：${actionNameMap[action]}`);
      appendTaskLog(task, `执行命令：openclaw ${commandMap[action].join(" ")}`);

      const result = await runOpenclawCli(commandMap[action]);
      for (const line of normalizeOutput(result.stdout)) {
        appendTaskLog(task, line, "info");
      }
      for (const line of normalizeOutput(result.stderr)) {
        appendTaskLog(task, line, result.ok ? "info" : "error");
      }

      if (!result.ok) {
        const message = result.stderr.trim() || result.stdout.trim() || `退出码 ${result.code}`;
        throw new Error(message);
      }

      task.status = "success";
      task.endedAt = new Date().toISOString();
      appendTaskLog(task, "任务完成");
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
      for (const tip of openclawCliTroubleshootingTips(message)) {
        appendTaskLog(task, `修复建议：${tip}`, "error");
      }
    }
  })();

  return task;
}

export function startQwGatewayRestartTask(
  trigger: QwGatewayRestartTrigger = "manual"
): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("qw-gateway-restart");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有企微网关重启任务正在执行，已复用当前任务。");
    setQwGatewayStartupStatus({
      state: "running",
      source: trigger,
      taskId: runningTask.id,
      message: "企微网关重启任务正在执行。",
    });
    return { task: runningTask, reused: true };
  }

  const totalSteps = 3;
  const taskTitle = trigger === "startup" ? "启动时重启企微网关" : "重启企微网关";
  const task = createTask("qw-gateway-restart", taskTitle, totalSteps);
  task.status = "running";
  setQwGatewayStartupStatus({
    state: "running",
    source: trigger,
    taskId: task.id,
    message:
      trigger === "startup"
        ? "ClawOS 启动后自动重启企微网关中..."
        : "正在重启企微网关...",
  });

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("当前系统不是 Windows，无法执行企微网关重启。");
      }

      const qwcliExePath = resolveQwcliExePath();
      if (!existsSync(qwcliExePath)) {
        throw new Error(
          `企微网关可执行文件不存在：${qwcliExePath}。请检查路径是否拼写正确，或通过 CLAWOS_QWCLI_EXE_PATH 指定正确路径。`
        );
      }
      const qwcliWorkingDirectory = resolveQwcliWorkingDirectory(qwcliExePath);

      const steps: Array<{ name: string; command: string; args: string[]; allowExitCodes?: number[] }> = [
        {
          name: "停止 cli.exe 进程",
          command: "taskkill /F /IM cli.exe /T",
          args: ["taskkill", "/F", "/IM", "cli.exe", "/T"],
          allowExitCodes: [128],
        },
        {
          name: "启动企微网关进程",
          command: `powershell.exe ... ${buildQwGatewayStartCommand(qwcliExePath, qwcliWorkingDirectory)}`,
          args: buildQwGatewayStartArgs(qwcliExePath, qwcliWorkingDirectory),
        },
      ];

      for (let index = 0; index < steps.length; index += 1) {
        const current = steps[index];
        task.step = index + 1;
        appendTaskLog(task, `步骤 ${task.step}/${totalSteps}：${current.name}`);
        appendTaskLog(task, `执行命令：${current.command}`);

        const result = await runProcess(current.args);
        const allowedExitCodes = new Set(current.allowExitCodes || []);
        const treatedAsSuccess = result.ok || allowedExitCodes.has(result.code);

        for (const line of normalizeOutput(result.stdout)) {
          appendTaskLog(task, line, "info");
        }
        for (const line of normalizeOutput(result.stderr)) {
          appendTaskLog(task, line, treatedAsSuccess ? "info" : "error");
        }

        if (!treatedAsSuccess) {
          throw new Error(`${current.name} 执行失败（退出码 ${result.code}）`);
        }
      }

      task.step = 3;
      appendTaskLog(task, `步骤 3/${totalSteps}：校验进程稳定性（10 秒存活）`);
      appendTaskLog(task, "执行命令：powershell.exe ... Get-Process -Name cli");
      const firstProbe = await runProcess(buildQwGatewayProbeArgs());
      for (const line of normalizeOutput(firstProbe.stdout)) {
        appendTaskLog(task, line, "info");
      }
      for (const line of normalizeOutput(firstProbe.stderr)) {
        appendTaskLog(task, line, firstProbe.ok ? "info" : "error");
      }
      if (!firstProbe.ok) {
        throw new Error("启动后未检测到 cli.exe 进程，企微网关启动失败。");
      }

      appendTaskLog(task, `首次探活通过，等待 ${QW_GATEWAY_STABLE_WINDOW_MS / 1000} 秒确认未闪退...`);
      await Bun.sleep(QW_GATEWAY_STABLE_WINDOW_MS);
      appendTaskLog(task, "执行命令：powershell.exe ... Get-Process -Name cli");
      const secondProbe = await runProcess(buildQwGatewayProbeArgs());
      for (const line of normalizeOutput(secondProbe.stdout)) {
        appendTaskLog(task, line, "info");
      }
      for (const line of normalizeOutput(secondProbe.stderr)) {
        appendTaskLog(task, line, secondProbe.ok ? "info" : "error");
      }
      if (!secondProbe.ok) {
        throw new Error("cli.exe 在 10 秒内退出，判定企微网关启动失败。");
      }

      task.status = "success";
      task.endedAt = new Date().toISOString();
      const successMessage = "企微网关启动成功（进程稳定存活 10 秒）。";
      appendTaskLog(task, successMessage);
      appendTaskLog(task, "任务完成");
      setQwGatewayStartupStatus({
        state: "success",
        source: trigger,
        taskId: task.id,
        message: successMessage,
      });
    } catch (error) {
      task.status = "failed";
      task.endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      task.error = message;
      appendTaskLog(task, message, "error");
      const unsupported = message.includes("当前系统不是 Windows");
      setQwGatewayStartupStatus({
        state: unsupported ? "unsupported" : "failed",
        source: trigger,
        taskId: task.id,
        message: unsupported ? "当前系统不是 Windows，无法启动企微网关。" : message,
      });
    }
  })();

  return { task, reused: false };
}

export function startQwGatewayRestartTaskOnStartup(): { task: Task; reused: boolean } {
  return startQwGatewayRestartTask("startup");
}
