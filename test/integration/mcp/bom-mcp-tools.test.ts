import { describe, expect, it } from "bun:test";
import { runTool } from "../../../mcp/bom-mcp/src/index";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("bom-mcp tools", () => {
  it("supports submit -> query -> quote -> export workflow", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([
          { partNumber: "abc-001", quantity: 2, unitPrice: 3.5 },
          { partNumber: "xyz-002", quantity: 1, unitPrice: 10 },
        ]),
        quoteParams: { currency: "CNY", taxRate: 0.1 },
      },
    })) as { jobId: string };

    expect(submitResult.jobId.length).toBeGreaterThan(5);
    await sleep(10);

    const jobResult = (await runTool({
      tool: "get_bom_job_result",
      args: { jobId: submitResult.jobId },
    })) as { status: string; summary: { totalLines: number } };
    expect(jobResult.status).toBe("succeeded");
    expect(jobResult.summary.totalLines).toBe(2);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { totals: { grandTotal: number }; items: Array<unknown> };
    expect(quote.items).toHaveLength(2);
    expect(quote.totals.grandTotal).toBeGreaterThan(0);

    const exported = (await runTool({
      tool: "export_quote",
      args: { jobId: submitResult.jobId, format: "csv" },
    })) as { downloadUrl: string };
    expect(exported.downloadUrl).toContain(`${submitResult.jobId}.csv`);
  });

  it("supports csv fileUrl input and reports missing-price lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bom-mcp-"));
    try {
      const csvPath = join(dir, "bom.csv");
      await writeFile(
        csvPath,
        "partNumber,quantity,unitPrice,description\nP-001,3,,First\nP-002,1,5.5,Second\n",
        "utf-8",
      );

      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          fileUrl: csvPath,
          quoteParams: { currency: "CNY", taxRate: 0 },
        },
      })) as { jobId: string };
      await sleep(10);

      const jobResult = (await runTool({
        tool: "get_bom_job_result",
        args: { jobId: submitResult.jobId },
      })) as { summary: { failedLines: number } };
      expect(jobResult.summary.failedLines).toBe(1);

      const quote = (await runTool({
        tool: "get_quote",
        args: { jobId: submitResult.jobId },
      })) as { missingItems: Array<unknown>; warnings: Array<string> };
      expect(quote.missingItems).toHaveLength(1);
      expect(quote.warnings[0]).toContain("缺少有效单价");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
