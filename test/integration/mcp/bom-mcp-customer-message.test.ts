import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
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
});
