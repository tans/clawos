import { getJob } from "../infra/store";
import type { GetBomJobResultOutput } from "../types";

export async function getBomJobResult(jobId: string): Promise<GetBomJobResultOutput> {
  const found = getJob(jobId);
  if (!found) {
    throw new Error(`job 不存在: ${jobId}`);
  }
  const failedLines = found.job.status === "failed" ? found.job.inputMeta.lineCount : 0;
  const successLines = found.job.status === "succeeded" ? found.job.inputMeta.lineCount : 0;
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
