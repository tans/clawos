import { exportQuote } from "./tools/export-quote";
import { getBomJobResult } from "./tools/get-bom-job-result";
import { getQuote } from "./tools/get-quote";
import { submitBom } from "./tools/submit-bom";
import { applyNlPriceUpdate } from "./tools/apply-nl-price-update";
import { quoteCustomerMessageTool } from "./tools/quote-customer-message";
import { exportCustomerQuoteTool } from "./tools/export-customer-quote";
import { serveStdio } from "./stdio-server";
import { type ToolName, isToolName } from "./tool-spec";

interface ToolRequest {
  tool: ToolName;
  args: Record<string, unknown>;
}

export async function runTool(request: ToolRequest): Promise<unknown> {
  switch (request.tool) {
    case "submit_bom":
      return submitBom(request.args as Parameters<typeof submitBom>[0]);
    case "get_bom_job_result":
    case "get_job_status":
      return getBomJobResult(String(request.args.jobId || ""));
    case "get_quote":
      return getQuote(String(request.args.jobId || ""));
    case "export_quote":
      return exportQuote(
        String(request.args.jobId || ""),
        (request.args.format as Parameters<typeof exportQuote>[1]) || "json",
      );
    case "export_customer_quote":
      return exportCustomerQuoteTool(request.args as Parameters<typeof exportCustomerQuoteTool>[0]);
    case "apply_nl_price_update":
      return applyNlPriceUpdate(request.args as Parameters<typeof applyNlPriceUpdate>[0]);
    case "quote_customer_message":
      return quoteCustomerMessageTool(request.args as Parameters<typeof quoteCustomerMessageTool>[0]);
    default:
      throw new Error(`未知 tool: ${request.tool}`);
  }
}

if (import.meta.main) {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: bun mcp/bom-mcp/src/index.ts <tool> '<json-args>'");
    console.error("   or: bun mcp/bom-mcp/src/index.ts serve --transport stdio");
    process.exit(1);
  }

  if (command === "serve") {
    const [transportFlag, transportValue] = rest;
    if (transportFlag !== "--transport" || transportValue !== "stdio") {
      console.error("Usage: bun mcp/bom-mcp/src/index.ts serve --transport stdio");
      process.exit(1);
    }
    serveStdio(runTool).catch((error) => {
      console.error(JSON.stringify({ ok: false, error: (error as Error).message }, null, 2));
      process.exit(1);
    });
  } else {
    if (!isToolName(command)) {
      console.error(JSON.stringify({ ok: false, error: `未知 tool: ${command}` }, null, 2));
      process.exit(1);
    }
    const [argsRaw] = rest;
    const args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
    runTool({ tool: command, args })
      .then((result) => {
        console.log(JSON.stringify({ ok: true, result }, null, 2));
      })
      .catch((error) => {
        console.error(JSON.stringify({ ok: false, error: (error as Error).message }, null, 2));
        process.exit(1);
      });
  }
}
