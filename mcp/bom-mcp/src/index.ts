import { serveStdio } from "./stdio-server";
import { type ToolName, isToolName } from "./tool-spec";

interface ToolRequest {
  tool: ToolName;
  args: Record<string, unknown>;
}

export async function runTool(request: ToolRequest): Promise<unknown> {
  switch (request.tool) {
    case "submit_bom": {
      const { submitBom } = await import("./tools/submit-bom");
      return submitBom(request.args as Parameters<typeof submitBom>[0]);
    }
    case "get_bom_job_result":
    case "get_job_status": {
      const { getBomJobResult } = await import("./tools/get-bom-job-result");
      return getBomJobResult(String(request.args.jobId || ""));
    }
    case "get_quote": {
      const { getQuote } = await import("./tools/get-quote");
      return getQuote(String(request.args.jobId || ""));
    }
    case "export_quote": {
      const { exportQuote } = await import("./tools/export-quote");
      return exportQuote(
        String(request.args.jobId || ""),
        (request.args.format as Parameters<typeof exportQuote>[1]) || "json",
      );
    }
    case "export_customer_quote": {
      const { exportCustomerQuoteTool } = await import("./tools/export-customer-quote");
      return exportCustomerQuoteTool(request.args as Parameters<typeof exportCustomerQuoteTool>[0]);
    }
    case "apply_nl_price_update": {
      const { applyNlPriceUpdate } = await import("./tools/apply-nl-price-update");
      return applyNlPriceUpdate(request.args as Parameters<typeof applyNlPriceUpdate>[0]);
    }
    case "quote_customer_message": {
      const { quoteCustomerMessageTool } = await import("./tools/quote-customer-message");
      return quoteCustomerMessageTool(request.args as Parameters<typeof quoteCustomerMessageTool>[0]);
    }
    case "doctor": {
      const { doctorTool } = await import("./tools/doctor");
      return doctorTool();
    }
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
