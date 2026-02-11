import { callGatewayMethod, gatewayTroubleshootingTips } from "../gateway/sock";
import { asObject, readNonEmptyString, toFiniteNumber } from "../lib/value";
import { appendTaskLog, createTask, findRunningTask, type Task } from "./store";
import type { GatewayCallResult } from "../gateway/schema";
import { runTask, type Step } from "./runner";
import { normalizeOutput, runProcess } from "./shell";

const IS_WINDOWS = process.platform === "win32";
const QWCLI_EXE_PATH = "c:\\xiake\\qwcli\\cli.exe";

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

function appendUpdateRunDetails(task: Task, payload: unknown): void {
  const payloadObj = asObject(payload);
  const result = asObject(payloadObj?.result);

  const status = readNonEmptyString(result?.status) || "unknown";
  const mode = readNonEmptyString(result?.mode) || "unknown";
  const reason = readNonEmptyString(result?.reason);

  appendTaskLog(task, `update.run 结果：status=${status} mode=${mode}`);
  if (reason) {
    appendTaskLog(task, `update.run 原因：${reason}`, status === "error" ? "error" : "info");
  }

  const steps = Array.isArray(result?.steps) ? result.steps : [];
  steps.forEach((item, index) => {
    const stepObj = asObject(item);
    const name = readNonEmptyString(stepObj?.name) || "unknown";
    const command = readNonEmptyString(stepObj?.command) || "unknown";
    const cwd = readNonEmptyString(stepObj?.cwd) || "";
    const durationMs = toFiniteNumber(stepObj?.durationMs);
    const exitCode = toFiniteNumber(stepObj?.exitCode);
    const ok = exitCode === 0;

    appendTaskLog(
      task,
      `子步骤 ${index + 1}/${steps.length}：${name} | exit=${exitCode ?? "null"} | duration=${durationMs ?? 0}ms`
    );
    appendTaskLog(task, `  命令：${command}${cwd ? ` (cwd: ${cwd})` : ""}`);

    const stdoutTail = readNonEmptyString(stepObj?.stdoutTail);
    const stderrTail = readNonEmptyString(stepObj?.stderrTail);

    if (stdoutTail) {
      for (const line of stdoutTail.split(/\r?\n/g).filter(Boolean)) {
        appendTaskLog(task, `  stdout: ${line}`, "info");
      }
    }
    if (stderrTail) {
      for (const line of stderrTail.split(/\r?\n/g).filter(Boolean)) {
        appendTaskLog(task, `  stderr: ${line}`, ok ? "info" : "error");
      }
    }
  });
}

export function startGatewayUpdateTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("gateway-update");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有更新任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 2;
  const task = createTask("gateway-update", "更新 openclaw", totalSteps);
  task.status = "running";

  (async () => {
    try {
      await runGatewayTaskStep(task, 1, totalSteps, "读取 gateway 状态", "status", {}, 10000);

      const updatePayload = await runGatewayTaskStep(
        task,
        2,
        totalSteps,
        "执行 update.run",
        "update.run",
        {
          note: "clawos 控制台触发更新",
          timeoutMs: 20 * 60_000,
          restartDelayMs: 0,
        },
        22 * 60_000
      );

      appendUpdateRunDetails(task, updatePayload.payload);

      const result = asObject(asObject(updatePayload.payload)?.result);
      const status = readNonEmptyString(result?.status);
      const reason = readNonEmptyString(result?.reason);

      if (status === "error") {
        throw new Error(`update.run 执行失败：${reason || "未知错误"}`);
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
      for (const tip of gatewayTroubleshootingTips(message)) {
        appendTaskLog(task, `修复建议：${tip}`, "error");
      }
    }
  })();

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
    restart: "重启 gateway（CLI 兼容模式）",
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

export function startQwGatewayRestartTask(): { task: Task; reused: boolean } {
  const runningTask = findRunningTask("qw-gateway-restart");
  if (runningTask) {
    appendTaskLog(runningTask, "检测到已有企微网关重启任务正在执行，已复用当前任务。");
    return { task: runningTask, reused: true };
  }

  const totalSteps = 2;
  const task = createTask("qw-gateway-restart", "重启企微网关", totalSteps);
  task.status = "running";

  (async () => {
    try {
      if (!IS_WINDOWS) {
        throw new Error("当前系统不是 Windows，无法执行企微网关重启。");
      }

      const steps: Array<{ name: string; command: string; args: string[]; allowExitCodes?: number[] }> = [
        {
          name: "停止 cli.exe 进程",
          command: "taskkill /F /IM cli.exe /T",
          args: ["taskkill", "/F", "/IM", "cli.exe", "/T"],
          allowExitCodes: [128],
        },
        {
          name: "启动企微网关进程",
          command: `cmd.exe /d /s /c start \"\" \"${QWCLI_EXE_PATH}\"`,
          args: ["cmd.exe", "/d", "/s", "/c", `start "" "${QWCLI_EXE_PATH}"`],
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
