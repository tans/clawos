import { getJob } from "../infra/store";
import type { GetBomJobResultOutput } from "../types";

export async function getBomJobResult(jobId: string): Promise<GetBomJobResultOutput> {
  const found = getJob(jobId);
  if (!found) {
    throw new Error(`job 不存在: ${jobId}`);
  }
  const failedLines = found.job.status === "failed" ? found.job.inputMeta.lineCount : found.quote?.failures.length || 0;
  const resolvedLines = found.quote?.lines.filter((line) => line.decisionType === "resolved").length || 0;
  const pendingDecisionLines = found.quote?.pendingDecisions.length || 0;
  return {
    status: found.job.status,
    progress: found.job.progress,
    summary: {
      totalLines: found.job.inputMeta.lineCount,
      resolvedLines,
      pendingDecisionLines,
      failedLines,
    },
    errors: found.job.error ? [found.job.error] : [],
  };
}
