import { parseBom } from "../domain/bom-parser";
import { normalizeBomLines } from "../domain/normalizer";
import { buildQuoteResult } from "../domain/quote-builder";
import { enqueue } from "../infra/queue";
import { createJob, updateJob } from "../infra/store";
import { logInfo, logWarn } from "../infra/logger";
import { readFile } from "node:fs/promises";
import type { JobRecord, SubmitBomInput, SubmitBomOutput } from "../types";

function createJobId(): string {
  return `bom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadInputContent(input: SubmitBomInput): Promise<string> {
  if (input.content && input.content.trim()) {
    return input.content;
  }
  if (!input.fileUrl) {
    return "";
  }

  const url = input.fileUrl.trim();
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fileUrl 拉取失败: HTTP ${response.status}`);
    }
    return await response.text();
  }
  if (url.startsWith("file://")) {
    return readFile(new URL(url), "utf-8");
  }
  return readFile(url, "utf-8");
}

export async function submitBom(input: SubmitBomInput): Promise<SubmitBomOutput> {
  if (!input.content && !input.fileUrl) {
    throw new Error("submit_bom 缺少 content/fileUrl");
  }

  const acceptedAt = new Date().toISOString();
  const jobId = createJobId();
  const rawContent = await loadInputContent(input);
  const parsed = parseBom(input.sourceType, rawContent);
  const normalized = normalizeBomLines(parsed);
  if (normalized.length === 0) {
    throw new Error("BOM 解析后为空，请检查输入内容与字段");
  }

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
