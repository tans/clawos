import { appendTaskLog, type Task } from "./store";
import { normalizeOutput, runWslScript, troubleshootingTips, type CommandResult } from "./shell";

export type Step = {
  name: string;
  script: string;
  command: string;
};

const TASK_EARLY_SUCCESS_MARKER = "__CLAWOS_TASK_EARLY_SUCCESS__";
const TASK_OPENCLAW_REMOTE_COMMIT_MARKER_PREFIX = "__CLAWOS_REMOTE_COMMIT__=";

export type StepRunMetadata = {
  openclawRemoteCommit: string;
};

export type RunTaskStepResult = {
  task: Task;
  step: Step;
  stepIndex: number;
  result: CommandResult;
  stdoutLines: string[];
  stderrLines: string[];
  hasEarlySuccessMarker: boolean;
  metadata: Partial<StepRunMetadata>;
};

export type RunTaskOptions = {
  onStepSuccess?: (info: RunTaskStepResult) => Promise<void> | void;
  onTaskSuccess?: (task: Task) => Promise<void> | void;
};

export function runTask(task: Task, steps: Step[], options: RunTaskOptions = {}): void {
  task.status = "running";

  (async () => {
    try {
      for (let index = 0; index < steps.length; index += 1) {
        const current = steps[index];
        task.step = index + 1;
        appendTaskLog(task, `步骤 ${task.step}/${task.totalSteps}：${current.name}`);
        appendTaskLog(task, `执行命令：${current.command}`);

        const result = await runWslScript(current.script);
        const stdoutLines = normalizeOutput(result.stdout);
        const stderrLines = normalizeOutput(result.stderr);
        const metadata: Partial<StepRunMetadata> = {};
        const hasEarlySuccessMarker = result.ok && stdoutLines.includes(TASK_EARLY_SUCCESS_MARKER);

        for (const line of stdoutLines) {
          if (line === TASK_EARLY_SUCCESS_MARKER) {
            continue;
          }
          if (line.startsWith(TASK_OPENCLAW_REMOTE_COMMIT_MARKER_PREFIX)) {
            const value = line.slice(TASK_OPENCLAW_REMOTE_COMMIT_MARKER_PREFIX.length).trim();
            if (value.length > 0) {
              metadata.openclawRemoteCommit = value;
            }
            continue;
          }
          appendTaskLog(task, line, "info");
        }

        for (const line of stderrLines) {
          appendTaskLog(task, line, result.ok ? "info" : "error");
        }

        if (!result.ok) {
          for (const tip of troubleshootingTips(result.stderr)) {
            appendTaskLog(task, `修复建议：${tip}`, "error");
          }
          throw new Error(`${current.name} 执行失败（退出码 ${result.code}）`);
        }

        if (options.onStepSuccess) {
          await options.onStepSuccess({
            task,
            step: current,
            stepIndex: index,
            result,
            stdoutLines,
            stderrLines,
            hasEarlySuccessMarker,
            metadata,
          });
        }

        if (hasEarlySuccessMarker) {
          appendTaskLog(task, "检测到版本 hash 未变化，已跳过后续步骤。");
          break;
        }
      }

      if (options.onTaskSuccess) {
        await options.onTaskSuccess(task);
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
}
