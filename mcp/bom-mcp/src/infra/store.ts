import type { BomLine, JobRecord, QuoteResult, SubmitBomInput } from "../types";

interface JobData {
  job: JobRecord;
  input: SubmitBomInput;
  lines: BomLine[];
  quote?: QuoteResult;
}

const jobs = new Map<string, JobData>();

export function createJob(data: JobData): void {
  jobs.set(data.job.jobId, data);
}

export function getJob(jobId: string): JobData | null {
  return jobs.get(jobId) || null;
}

export function updateJob(jobId: string, updater: (data: JobData) => JobData): JobData | null {
  const current = jobs.get(jobId);
  if (!current) {
    return null;
  }
  const next = updater(current);
  jobs.set(jobId, next);
  return next;
}
