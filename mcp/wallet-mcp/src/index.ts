import { generateAndSaveLocalWallet, readLocalWalletSummary } from "../../../app/server/config/local";
import { readWalletBalances } from "../../../app/server/system/wallet-balance";

type ToolName = "get_local_wallet" | "generate_local_wallet" | "get_local_wallet_balances";

interface ToolRequest {
  tool: ToolName;
  args?: Record<string, unknown>;
}

function readAddressArg(args: Record<string, unknown>, fallback: string): string {
  const value = typeof args.address === "string" ? args.address.trim() : "";
  return value || fallback;
}

export async function runTool(request: ToolRequest): Promise<unknown> {
  const args = request.args || {};
  switch (request.tool) {
    case "get_local_wallet": {
      return {
        wallet: readLocalWalletSummary(),
      };
    }
    case "generate_local_wallet": {
      const generated = generateAndSaveLocalWallet();
      return {
        wallet: generated.wallet,
        privateKey: generated.privateKey,
      };
    }
    case "get_local_wallet_balances": {
      const wallet = readLocalWalletSummary();
      const address = readAddressArg(args, wallet.address || "");
      if (!address) {
        throw new Error("未找到钱包地址，请先生成本地钱包。");
      }
      const balances = await readWalletBalances(address);
      return {
        wallet,
        balances,
      };
    }
    default:
      throw new Error(`未知 tool: ${String((request as { tool?: unknown }).tool || "")}`);
  }
}

if (import.meta.main) {
  const [tool, argsRaw] = process.argv.slice(2);
  if (!tool) {
    console.error("Usage: bun mcp/wallet-mcp/src/index.ts <tool> '<json-args>'");
    process.exit(1);
  }
  const args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
  runTool({ tool: tool as ToolName, args })
    .then((result) => {
      console.log(JSON.stringify({ ok: true, result }, null, 2));
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: (error as Error).message }, null, 2));
      process.exit(1);
    });
}
