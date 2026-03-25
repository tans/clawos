export interface IntentTask {
  taskName: string;
  bomContent: string;
}

export interface IntentAnalysisResult {
  intentSummary: string;
  tasks: IntentTask[];
}

export interface IntentAnalyzerOptions {
  llmExtractBomBlocks?: (message: string) => Promise<string[]>;
}

function extractBomBlocksByHeuristic(message: string): string[] {
  const blocks: string[] = [];
  const fencedPattern = /```(?:csv|table|bom)?\s*\n([\s\S]*?)```/gi;
  let matched: RegExpExecArray | null = fencedPattern.exec(message);
  while (matched) {
    const block = (matched[1] || "").trim();
    if (block && /partnumber/i.test(block) && /quantity/i.test(block)) {
      blocks.push(block);
    }
    matched = fencedPattern.exec(message);
  }
  return blocks;
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
  const blocks = fromLlm.length > 0 ? fromLlm : extractBomBlocksByHeuristic(message);
  const tasks = blocks.map((bomContent, idx) => ({
    taskName: `bom_task_${idx + 1}`,
    bomContent: bomContent.trim(),
  }));

  return {
    intentSummary: buildIntentSummary(message, tasks.length),
    tasks,
  };
}
