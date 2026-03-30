import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

describe("bom-quote skill contract", () => {
  it("exists with frontmatter and references bom-mcp tools", async () => {
    const skill = await readFile("skills/bom-quote/SKILL.md", "utf-8");

    expect(skill.startsWith("---\n")).toBeTrue();
    expect(skill).toContain("name: bom-quote");
    expect(skill).toContain("description: Use when");
    expect(skill).toContain("bom-mcp");
    expect(skill).toContain("quote_customer_message");
    expect(skill).toContain("export_quote");
  });
});
