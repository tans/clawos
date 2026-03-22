import { getJob } from "../infra/store";
import type { QuoteResult } from "../types";

export async function getQuote(jobId: string): Promise<QuoteResult> {
  const found = getJob(jobId);
  if (!found) {
    throw new Error(`job 不存在: ${jobId}`);
  }
  if (found.job.status !== "succeeded" || !found.quote) {
    throw new Error(`job 尚未完成: ${jobId}, status=${found.job.status}`);
  }
  return found.quote;
}
