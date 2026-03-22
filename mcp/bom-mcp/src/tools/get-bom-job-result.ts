import { getJob } from "../infra/store";
import type { GetBomJobResultOutput } from "../types";

export async function getBomJobResult(jobId: string): Promise<GetBomJobResultOutput> {
  const found = getJob(jobId);
  if (!found) {
    throw new Error(`job 不存在: ${jobId}`);
  }
  const failedLines =
    found.job.status === "failed"
      ? found.job.inputMeta.lineCount
      : found.quote?.missingItems.length || 0;
  const successLines =
    found.job.status === "succeeded"
      ? Math.max(0, found.job.inputMeta.lineCount - failedLines)
      : 0;
  return {
    status: found.job.status,
    progress: found.job.progress,
    summary: {
      totalLines: found.job.inputMeta.lineCount,
      successLines,
      failedLines,
    },
    errors: found.job.error ? [found.job.error] : [],
  };
}
