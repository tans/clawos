import { resolve } from "node:path";
import { createCrmStore } from "./crm";
import type { CustomerInput, DealInput, InteractionInput } from "./types";

type ToolName =
  | "init"
  | "create_customer"
  | "list_customers"
  | "create_interaction"
  | "create_deal"
  | "list_deals"
  | "export_customers_csv";

interface ToolRequest {
  tool: ToolName;
  args?: Record<string, unknown>;
  dbPath?: string;
}

function readNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export async function runTool(request: ToolRequest): Promise<unknown> {
  const args = request.args || {};
  const store = createCrmStore(request.dbPath);
  try {
    switch (request.tool) {
      case "init":
        return { ok: true };
      case "create_customer":
        return store.createCustomer(args as unknown as CustomerInput);
      case "list_customers":
        return store.listCustomers(readNumber(args.limit, 50));
      case "create_interaction":
        return store.createInteraction({
          customerId: readNumber(args.customerId),
          note: String(args.note || ""),
          channel: typeof args.channel === "string" ? args.channel : undefined,
        } as InteractionInput);
      case "create_deal":
        return store.createDeal({
          customerId: readNumber(args.customerId),
          title: String(args.title || ""),
          amount: readNumber(args.amount, 0),
          stage: typeof args.stage === "string" ? args.stage : undefined,
        } as DealInput);
      case "list_deals": {
        const customerId = args.customerId == null ? undefined : readNumber(args.customerId);
        return store.listDeals(customerId);
      }
      case "export_customers_csv": {
        const output = typeof args.filePath === "string" && args.filePath.trim()
          ? resolve(args.filePath)
          : resolve(import.meta.dir, "..", "exports", `customers-${Date.now()}.csv`);
        return await store.exportCustomersCsv(output);
      }
      default:
        throw new Error(`未知 tool: ${String((request as { tool?: unknown }).tool || "")}`);
    }
  } finally {
    store.close();
  }
}

if (import.meta.main) {
  const [tool, argsRaw, dbPathRaw] = process.argv.slice(2);
  if (!tool) {
    console.error("Usage: bun mcp/crm-mcp/src/index.ts <tool> '<json-args>' [dbPath]");
    process.exit(1);
  }
  const args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
  runTool({ tool: tool as ToolName, args, dbPath: dbPathRaw || undefined })
    .then((result) => {
      console.log(JSON.stringify({ ok: true, result }, null, 2));
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: (error as Error).message }, null, 2));
      process.exit(1);
    });
}
