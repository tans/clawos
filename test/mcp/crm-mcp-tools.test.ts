import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTool } from "../../mcp/crm-mcp/src/index";

describe("crm-mcp tools", () => {
  it("supports customer/deal/interaction and csv export", async () => {
    const dir = await mkdtemp(join(tmpdir(), "crm-mcp-"));
    const dbPath = join(dir, "crm.sqlite");
    const csvPath = join(dir, "customers.csv");

    try {
      const created = (await runTool({
        tool: "create_customer",
        dbPath,
        args: {
          name: "Alice",
          email: "alice@example.com",
          company: "Acme",
        },
      })) as { id: number; name: string };

      expect(created.id).toBeGreaterThan(0);
      expect(created.name).toBe("Alice");

      await runTool({
        tool: "create_interaction",
        dbPath,
        args: {
          customerId: created.id,
          note: "First call",
          channel: "phone",
        },
      });

      await runTool({
        tool: "create_deal",
        dbPath,
        args: {
          customerId: created.id,
          title: "Annual Contract",
          amount: 12000,
          stage: "proposal",
        },
      });

      const customers = (await runTool({
        tool: "list_customers",
        dbPath,
        args: { limit: 10 },
      })) as Array<{ id: number; name: string }>;

      expect(customers.length).toBe(1);
      expect(customers[0]?.name).toBe("Alice");

      const exported = (await runTool({
        tool: "export_customers_csv",
        dbPath,
        args: { filePath: csvPath },
      })) as { filePath: string; count: number };

      expect(exported.count).toBe(1);
      const csv = await readFile(exported.filePath, "utf-8");
      expect(csv).toContain("name,email");
      expect(csv).toContain("Alice,alice@example.com");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
