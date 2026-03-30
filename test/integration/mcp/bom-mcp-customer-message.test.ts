import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { runTool } from "../../../mcp/bom-mcp/src/index";

describe("bom-mcp quote_customer_message", () => {
  it("returns one aggregated result containing three BOM summaries", async () => {
    const message = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");

    const result = (await runTool({
      tool: "quote_customer_message" as never,
      args: { message, currency: "CNY", taxRate: 0.13 },
    })) as {
      summary: { bomCount: number; totalLines: number };
      boms: Array<{ bomName: string; summary: { totalLines: number } }>;
    };

    expect(result.summary.bomCount).toBe(3);
    expect(result.summary.totalLines).toBe(12);
    expect(result.boms).toHaveLength(3);
    expect(result.boms[0]?.bomName).toContain("PGE22001.052.000-02");
    expect(result.boms[0]?.summary.totalLines).toBe(4);
    expect(result.boms[1]?.summary.totalLines).toBe(4);
    expect(result.boms[2]?.summary.totalLines).toBe(4);
  });

  it("rejects customer messages with no BOM blocks", async () => {
    await expect(
      runTool({
        tool: "quote_customer_message" as never,
        args: { message: "请尽快报价，谢谢" },
      }),
    ).rejects.toThrow("message 中未识别到有效 BOM");
  });

  it("rejects invalid top-level taxRate", async () => {
    await expect(
      runTool({
        tool: "quote_customer_message" as never,
        args: {
          message: `
请报价
\`\`\`csv
partNumber,quantity
STM32F103C8T6,2
\`\`\`
`,
          taxRate: -0.5,
        },
      }),
    ).rejects.toThrow("taxRate 必须在 0 到 1 之间");
  });

  it("exports aggregated multi-bom csv with bom-level columns", async () => {
    const message = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");

    const exported = (await runTool({
      tool: "export_customer_quote" as never,
      args: { message, currency: "CNY", taxRate: 0.13, format: "csv" },
    })) as { downloadUrl: string };

    const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
    const csv = await readFile(filePath, "utf-8");

    expect(csv).toContain("bomName");
    expect(csv).toContain("PGE22001.052.000-02");
    expect(csv).toContain("sourceRecordedAt");
    expect(csv).toContain("pricingState");
  });

  it("exports aggregated multi-bom xlsx with BOM and line sheets", async () => {
    const message = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");

    const exported = (await runTool({
      tool: "export_customer_quote" as never,
      args: { message, currency: "CNY", taxRate: 0.13, format: "xlsx" },
    })) as { downloadUrl: string };

    const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
    const workbook = XLSX.read(await readFile(filePath), { type: "buffer" });

    expect(workbook.SheetNames).toContain("Summary");
    expect(workbook.SheetNames).toContain("BOMs");
    expect(workbook.SheetNames).toContain("Lines");

    const bomRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.BOMs, { defval: "" });
    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Lines, { defval: "" });

    expect(bomRows[0]?.bomName).toBe("BOM-1 (PGE22001.052.000-02)");
    expect(Object.keys(lineRows[0] || {})).toContain("sourceRecordedAt");
    expect(Object.keys(lineRows[0] || {})).toContain("pricingState");
  });
});
