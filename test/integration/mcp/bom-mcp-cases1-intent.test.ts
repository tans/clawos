import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { analyzeCustomerIntent } from "../../../mcp/bom-mcp/src/domain/intent-analyzer";
import { runTool } from "../../../mcp/bom-mcp/src/index";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("bom-mcp cases1 intent analysis", () => {
  it("splits cases1 into 3 bom tasks and submits 3 jobs", async () => {
    const cases1 = await readFile("test/fixtures/mcp/bom/cases1.md", "utf-8");

    const analysis = await analyzeCustomerIntent(cases1);
    expect(analysis.tasks).toHaveLength(3);
    expect(analysis.intentSummary).toContain("3 个 BOM 子任务");
    expect(analysis.intentSummary).toContain("紧急交期诉求");

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

    await sleep(20);

    for (const jobId of jobIds) {
      const status = (await runTool({
        tool: "get_job_status",
        args: { jobId },
      })) as { status: string; summary: { totalLines: number } };
      expect(status.status).toBe("succeeded");
      expect(status.summary.totalLines).toBe(2);
    }
  });

  it("supports llm extractor path for intent decomposition", async () => {
    const cases1 = await readFile("test/fixtures/mcp/bom/cases1.md", "utf-8");
    let called = false;

    const analysis = await analyzeCustomerIntent(cases1, {
      llmExtractBomBlocks: async (message) => {
        called = true;
        expect(message.length).toBeGreaterThan(50);
        return [
          "partNumber,quantity,unitPrice,description\nA-1,1,1,Demo",
          "partNumber,quantity,unitPrice,description\nB-1,2,2,Demo",
          "partNumber,quantity,unitPrice,description\nC-1,3,3,Demo",
        ];
      },
    });

    expect(called).toBeTrue();
    expect(analysis.tasks).toHaveLength(3);
    expect(analysis.tasks[0]?.taskName).toBe("bom_task_1");
  });
});
