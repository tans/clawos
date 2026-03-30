export interface IntentTask {
  taskName: string;
  bomContent: string;
}

export interface IntentAnalysisResult {
  intentSummary: string;
  tasks: IntentTask[];
}

export interface IntentAnalyzerOptions {
  llmExtractBomBlocks?: (message: string) => Promise<Array<string | IntentTask>>;
}

function findBomTaskTitle(message: string, blockStart: number): string | undefined {
  const prefix = message.slice(0, blockStart);
  const lines = prefix.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) {
      continue;
    }
    return /bom/i.test(line) ? line : undefined;
  }
  return undefined;
}

function extractBomTasksByHeuristic(message: string): IntentTask[] {
  const tasks: IntentTask[] = [];
  const fencedPattern = /```(?:csv|table|bom)?\s*\n([\s\S]*?)```/gi;
  let matched: RegExpExecArray | null = fencedPattern.exec(message);
  while (matched) {
    const title = findBomTaskTitle(message, matched.index ?? 0);
    const block = (matched[1] || "").trim();
    if (block && /partnumber/i.test(block) && /quantity/i.test(block)) {
      tasks.push({
        taskName: title || `bom_task_${tasks.length + 1}`,
        bomContent: block,
      });
    }
    matched = fencedPattern.exec(message);
  }
  return tasks;
}

function buildIntentSummary(message: string, taskCount: number): string {
  const hints: string[] = [];
  if (/加急|今天|尽快/.test(message)) {
    hints.push("客户有紧急交期诉求");
  }
  if (/优先|先报|分开报价|拆分/.test(message)) {
    hints.push("客户希望按批次拆分并区分优先级");
  }
  if (/替代|兼容|可替换/.test(message)) {
    hints.push("客户可能关注替代料建议");
  }

  const base = `识别到 ${taskCount} 个 BOM 子任务`;
  if (hints.length === 0) {
    return `${base}，建议按独立任务并行处理。`;
  }
  return `${base}，${hints.join("；")}。`;
}

export async function analyzeCustomerIntent(
  message: string,
  options: IntentAnalyzerOptions = {},
): Promise<IntentAnalysisResult> {
  const fromLlm = options.llmExtractBomBlocks ? await options.llmExtractBomBlocks(message) : [];
  const tasks =
    fromLlm.length > 0
      ? fromLlm.map((entry, idx) =>
          typeof entry === "string"
            ? {
                taskName: `bom_task_${idx + 1}`,
                bomContent: entry.trim(),
              }
            : {
                taskName: entry.taskName?.trim() || `bom_task_${idx + 1}`,
                bomContent: entry.bomContent.trim(),
              },
        )
      : extractBomTasksByHeuristic(message);

  return {
    intentSummary: buildIntentSummary(message, tasks.length),
    tasks,
  };
}
