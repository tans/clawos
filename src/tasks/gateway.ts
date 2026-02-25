import { callGatewayMethod, gatewayTroubleshootingTips } from "../gateway/sock";
import { readNonEmptyString } from "../lib/value";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import type { GatewayCallResult } from "../gateway/schema";
import { runTask, type Step } from "./runner";
import { normalizeOutput, runProcess } from "./shell";
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
  timeoutMs: number
): Promise<GatewayCallResult<unknown>> {
  task.step = step;
  appendTaskLog(task, `步骤 ${step}/${totalSteps}：${name}`);
  appendTaskLog(task, `执行命令：gateway.${method}`);

  const result = await callGatewayMethod(method, params, { timeoutMs });

  if (step === 1) {
    const version = readNonEmptyString(result.hello.server?.version);
    if (version) {
      appendTaskLog(task, `网关版本：${version}`);
    }
    appendTaskLog(task, `网关地址：${result.url}`);
  }

  appendPayloadLog(task, `${method} 返回`, result.payload, 80);
  return result;
}

function buildOpenclawStepScript(command: string): string {
  return `set -euo pipefail\ncd ${OPENCLAW_SOURCE_DIR}\n${command}`;
}

function buildGitPullWithLockOverrideScript(): string {
  return [
    "set -euo pipefail",
    `cd ${OPENCLAW_SOURCE_DIR}`,
    "if [ -e pnpm-lock.yaml ]; then",
    "  if ! git diff --quiet -- pnpm-lock.yaml || ! git diff --cached --quiet -- pnpm-lock.yaml; then",
    '    echo "检测到 pnpm-lock.yaml 本地变动，已忽略该文件后继续拉取..."',
    "    if ! git restore --source=HEAD --staged --worktree pnpm-lock.yaml 2>/dev/null; then",
    "      git reset -q HEAD -- pnpm-lock.yaml",
    "      git checkout -- pnpm-lock.yaml",
    "    fi",
    "  fi",
    "fi",
    "git pull -X theirs",
  ].join("\n");
}

export function buildOpenclawSourceUpdateSteps(): Step[] {
  return [
    {
      name: "进入源码目录",
      command: `cd ${OPENCLAW_SOURCE_DIR}`,
      script: `set -euo pipefail\nif [ ! -d ${OPENCLAW_SOURCE_DIR} ]; then\n  echo "目录不存在：${OPENCLAW_SOURCE_DIR}。请先在 WSL 中安装 openclaw 源码。" >&2\n  exit 1\nfi\ncd ${OPENCLAW_SOURCE_DIR}\npwd`,
    },
    {
      name: "拉取最新源码（git pull -X theirs）",
      command: `cd ${OPENCLAW_SOURCE_DIR} && git pull -X theirs`,
      script: buildGitPullWithLockOverrideScript(),
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

  const steps = buildOpenclawSourceUpdateSteps();
  const task = createTask("gateway-update", "更新 openclaw（源码升级）", steps.length);
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
      for (const tip of gatewayTroubleshootingTips(message)) {
        appendTaskLog(task, `修复建议：${tip}`, "error");
      }
    }
  })();

  return task;
}

export function startGatewayControlTask(
  action: "restart" | "install" | "uninstall" | "start" | "stop"
): Task {
  const commandMap: Record<typeof action, string> = {
    restart: "openclaw gateway restart",
    install: "openclaw gateway install",
    uninstall: "openclaw gateway uninstall",
    start: "openclaw gateway start",
    stop: "openclaw gateway stop",
  };

  const actionNameMap: Record<typeof action, string> = {
    restart: "重启 openclaw（CLI 兼容模式）",
    install: "安装 gateway 自启动（CLI 兼容模式）",
    uninstall: "取消 gateway 自启动（CLI 兼容模式）",
    start: "启动 gateway（CLI 兼容模式）",
    stop: "停止 gateway（CLI 兼容模式）",
  };

  const steps: Step[] = [
    {
      name: actionNameMap[action],
      command: commandMap[action],
      script: `set -euo pipefail\n${commandMap[action]}`,
    },
  ];

  const task = createTask(`gateway-${action}`, actionNameMap[action], steps.length);
  runTask(task, steps);
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
