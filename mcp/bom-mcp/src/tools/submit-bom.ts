import { parseBom } from "../domain/bom-parser";
import { normalizeBomLines } from "../domain/normalizer";
import { buildQuoteResult } from "../domain/quote-builder";
import { enqueue } from "../infra/queue";
import { createJob, updateJob } from "../infra/store";
import { logInfo, logWarn } from "../infra/logger";
import type { JobRecord, SubmitBomInput, SubmitBomOutput } from "../types";

function createJobId(): string {
  return `bom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function submitBom(input: SubmitBomInput): Promise<SubmitBomOutput> {
  if (!input.content && !input.fileUrl) {
    throw new Error("submit_bom 缺少 content/fileUrl");
  }

  const acceptedAt = new Date().toISOString();
  const jobId = createJobId();
  const rawContent = input.content || "";
  const parsed = parseBom(input.sourceType, rawContent);
  const normalized = normalizeBomLines(parsed);

  const job: JobRecord = {
    jobId,
    status: "queued",
    createdAt: acceptedAt,
    updatedAt: acceptedAt,
    progress: 0,
    inputMeta: {
      sourceType: input.sourceType,
      lineCount: normalized.length,
      customer: input.customer,
    },
  };

  createJob({
    job,
    input,
    lines: normalized,
  });

  enqueue(async () => {
    updateJob(jobId, (current) => ({
      ...current,
      job: {
        ...current.job,
        status: "running",
        progress: 20,
        updatedAt: new Date().toISOString(),
      },
    }));

    try {
      const result = buildQuoteResult({
        jobId,
        currency: input.quoteParams?.currency,
        taxRate: input.quoteParams?.taxRate,
        lines: normalized,
      });
      updateJob(jobId, (current) => ({
        ...current,
        quote: result,
        job: {
          ...current.job,
          status: "succeeded",
          progress: 100,
          updatedAt: new Date().toISOString(),
        },
      }));
      logInfo("submit_bom.completed", { jobId, lines: normalized.length });
    } catch (error) {
      const message = (error as Error).message;
      updateJob(jobId, (current) => ({
        ...current,
        job: {
          ...current.job,
          status: "failed",
          progress: current.job.progress,
          updatedAt: new Date().toISOString(),
          error: message,
        },
      }));
      logWarn("submit_bom.failed", { jobId, error: message });
    }
  });

  return { jobId, acceptedAt, status: "queued" };
}
