import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { parseBom } from "../../../mcp/bom-mcp/src/domain/bom-parser";

describe("bom-mcp xlsx parsing", () => {
  it("reads xlsx rows with description, designator, manufacturer, and mpn", async () => {
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    const lines = await parseBom("xlsx", workbook);

    expect(lines[0]?.partNumber).toBe("CC0402KRX7R7BB224");
    expect(lines[0]?.description).toBe("220n 16V X7R");
    expect(lines[0]?.designator).toBe("C1, C2, C3, C4");
    expect(lines[0]?.manufacturer).toBe("Yageo");
    expect(lines[0]?.quantity).toBe(4);
    expect(lines[0]?.lineNo).toBe(9);
    expect(lines[0]?.rawText).toContain("CC0402KRX7R7BB224");
  });

  it("accepts Manufacturer Part Number 1 / Manufacturer 1 / Quantity headers", async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Manufacturer Part Number 1", "Manufacturer 1", "Quantity", "Description", "Designator"],
      ["MCP123", "Acme", 12, "Test Part", "R1"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const lines = await parseBom("xlsx", data);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.partNumber).toBe("MCP123");
    expect(lines[0]?.manufacturer).toBe("Acme");
    expect(lines[0]?.quantity).toBe(12);
    expect(lines[0]?.description).toBe("Test Part");
    expect(lines[0]?.designator).toBe("R1");
    expect(lines[0]?.lineNo).toBe(2);
    expect(lines[0]?.rawText).toContain("Manufacturer Part Number 1: MCP123");
  });

  it("preserves rawText for csv rows", () => {
    const lines = parseBom(
      "csv",
      'partNumber,quantity,description,designator,manufacturer\nP-100,2,"Resistor, 10K 1%","R1, R2",Yageo\n',
    );

    expect(lines[0]?.rawText).toBe('P-100,2,"Resistor, 10K 1%","R1, R2",Yageo');
  });
});
