import { appendTaskLog, type Task } from "./store";
import { normalizeOutput, runWslScript, troubleshootingTips } from "./shell";

export type Step = {
  name: string;
  script: string;
  command: string;
};

export function runTask(task: Task, steps: Step[]): void {
  task.status = "running";

  (async () => {
    try {
      for (let index = 0; index < steps.length; index += 1) {
        const current = steps[index];
        task.step = index + 1;
        appendTaskLog(task, `步骤 ${task.step}/${task.totalSteps}：${current.name}`);
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
