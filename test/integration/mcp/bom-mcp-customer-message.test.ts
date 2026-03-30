import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const BOM_MCP_TEST_STATE_DIR = resolve(process.cwd(), "artifacts", "mcp", "bom-mcp");

let bomMcpCustomerToolsPromise:
  | Promise<{ runTool: typeof import("../../../mcp/bom-mcp/src/index").runTool }>
  | undefined;

async function loadBomMcpCustomerTools() {
  process.env.BOM_MCP_STATE_DIR ??= BOM_MCP_TEST_STATE_DIR;
  bomMcpCustomerToolsPromise ??= import("../../../mcp/bom-mcp/src/index").then((module) => ({
    runTool: module.runTool,
  }));
  return bomMcpCustomerToolsPromise;
}

type FileFirstExportResult = {
  filePath: string;
  fileName: string;
  format: "json" | "csv" | "xlsx";
  mimeType: string;
  expiresAt: string;
  downloadUrl?: string;
};

async function runTool(request: Parameters<typeof import("../../../mcp/bom-mcp/src/index").runTool>[0]) {
  const tools = await loadBomMcpCustomerTools();
  return tools.runTool(request);
}

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
    const invalidMessage = [
      "请报价",
      "```csv",
      "partNumber,quantity",
      "STM32F103C8T6,2",
      "```",
    ].join("\n");

    await expect(
      runTool({
        tool: "quote_customer_message" as never,
        args: {
          message: invalidMessage,
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
    })) as FileFirstExportResult;

    expect(exported.fileName).toMatch(/\.csv$/);
    expect(exported.format).toBe("csv");
    expect(exported.mimeType).toBe("text/csv; charset=utf-8");
    expect(exported.downloadUrl).toBeUndefined();

    const csv = await readFile(exported.filePath, "utf-8");

    expect(csv).toContain("bomName");
    expect(csv).toContain("PGE22001.052.000-02");
    expect(csv).toContain("sourceRecordedAt");
    expect(csv).toContain("pricingState");
  });

  it("includes downloadUrl when customer exports run with publicBaseUrl", async () => {
    const prev = process.env.BOM_MCP_PUBLIC_BASE_URL;
    process.env.BOM_MCP_PUBLIC_BASE_URL = "https://public.example/customer";
    try {
      const message = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");
      const exported = (await runTool({
        tool: "export_customer_quote" as never,
        args: { message, currency: "CNY", taxRate: 0.13, format: "csv" },
      })) as FileFirstExportResult;
      expect(exported.downloadUrl).toBe(
        `https://public.example/customer/${encodeURIComponent(exported.fileName)}`,
      );
    } finally {
      if (prev === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = prev;
      }
    }
  });

  it("exports aggregated multi-bom xlsx with BOM and line sheets", async () => {
    const message = await readFile("mcp/bom-mcp/cases/multibom/case1.md", "utf-8");

    const exported = (await runTool({
      tool: "export_customer_quote" as never,
      args: { message, currency: "CNY", taxRate: 0.13, format: "xlsx" },
    })) as FileFirstExportResult;

    expect(exported.fileName).toMatch(/\.xlsx$/);
    expect(exported.format).toBe("xlsx");
    expect(exported.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(exported.downloadUrl).toBeUndefined();

    const workbook = XLSX.read(await readFile(exported.filePath), { type: "buffer" });

    expect(workbook.SheetNames).toContain("Summary");
    expect(workbook.SheetNames).toContain("BOMs");
    expect(workbook.SheetNames).toContain("Lines");

    const bomRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.BOMs, {
      defval: "",
    });
    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Lines, {
      defval: "",
    });

    expect(bomRows[0]?.bomName).toBe("BOM-1 (PGE22001.052.000-02)");
    expect(Object.keys(lineRows[0] || {})).toContain("sourceRecordedAt");
    expect(Object.keys(lineRows[0] || {})).toContain("pricingState");
  });
});
