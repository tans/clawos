import { describe, expect, it } from "bun:test";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { runTool } from "../../../mcp/bom-mcp/src/index";

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

    const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
    await access(filePath);
    expect(true).toBeTrue();
  });

  it("supports csv content input and reports missing-price lines", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nP-001,3,,First\nP-002,1,5.5,Second\n",
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
  });

  it("applies natural-language price update before quoting", async () => {
    await runTool({
      tool: "apply_nl_price_update",
      args: {
        partNumber: "STM32F103C8T6",
        unitPrice: 11.8,
        supplier: "LCSC",
        reason: "客户口头确认价格",
      },
    });

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nSTM32F103C8T6,2,,MCU\n",
        quoteParams: { currency: "CNY", taxRate: 0 },
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { items: Array<{ unitPrice: number }>; missingItems: Array<unknown> };

    expect(quote.items[0]?.unitPrice).toBe(11.8);
    expect(quote.missingItems).toHaveLength(0);
  });

  it("parses quoted csv fields with commas correctly", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content:
          'partNumber,quantity,unitPrice,description\nP-100,2,1.25,"Resistor, 10K 1%"\nP-200,1,3.5,Capacitor\n',
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { items: Array<{ description?: string }> };
    expect(quote.items[0]?.description).toBe("Resistor, 10K 1%");
  });

  it("supports get_job_status alias", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([{ partNumber: "ALIAS-001", quantity: 1, unitPrice: 1 }]),
      },
    })) as { jobId: string };
    await sleep(10);

    const statusResult = (await runTool({
      tool: "get_job_status",
      args: { jobId: submitResult.jobId },
    })) as { status: string };
    expect(statusResult.status).toBe("succeeded");
  });

  it("rejects unsafe local fileUrl path", async () => {
    await expect(
      runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          fileUrl: "/tmp/bom.csv",
        },
      }),
    ).rejects.toThrow("fileUrl 仅支持 http(s) 地址");
  });

  it("rejects invalid tax rate", async () => {
    await expect(
      runTool({
        tool: "submit_bom",
        args: {
          sourceType: "json",
          content: JSON.stringify([{ partNumber: "TAX-001", quantity: 1, unitPrice: 1 }]),
          quoteParams: { taxRate: 1.5 },
        },
      }),
    ).rejects.toThrow("quoteParams.taxRate 必须在 0 到 1 之间");
  });
});
