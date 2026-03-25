import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { analyzeCustomerIntent } from "../../../mcp/bom-mcp/src/domain/intent-analyzer";
import { runTool } from "../../../mcp/bom-mcp/src/index";

async function waitForJobSucceeded(jobId: string, timeoutMs = 3000): Promise<{ totalLines: number }> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = (await runTool({
      tool: "get_job_status",
      args: { jobId },
    })) as { status: string; summary?: { totalLines: number } };

    if (status.status === "succeeded") {
      return { totalLines: status.summary?.totalLines ?? 0 };
    }

    if (status.status === "failed") {
      throw new Error(`job failed: ${jobId}`);
    }

    await Bun.sleep(30);
  }

  throw new Error(`job timeout: ${jobId}`);
}

describe("bom-mcp cases1 intent analysis", () => {
  it("splits real case1 into 3 bom tasks and waits async jobs to finish", async () => {
    const cases1 = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");

    const analysis = await analyzeCustomerIntent(cases1);
    expect(analysis.tasks).toHaveLength(3);
    expect(analysis.intentSummary).toContain("3 个 BOM 子任务");

    const jobIds: string[] = [];
    for (const task of analysis.tasks) {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: task.bomContent,
          quoteParams: { taxRate: 0.13, currency: "CNY" },
        },
      })) as { jobId: string };
      jobIds.push(submitResult.jobId);
    }

    for (const jobId of jobIds) {
      const result = await waitForJobSucceeded(jobId);
      expect(result.totalLines).toBe(4);
    }
  });
});
