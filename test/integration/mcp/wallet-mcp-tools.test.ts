import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("wallet-mcp tools", () => {
  it("supports get wallet + generate wallet workflow", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wallet-mcp-"));
    const localConfigPath = join(dir, "clawos.json");

    try {
      process.env.CLAWOS_LOCAL_CONFIG_PATH = localConfigPath;
      const { runTool } = await import(`../../../mcp/wallet-mcp/src/index?case=${Date.now()}`);

      const before = (await runTool({ tool: "get_local_wallet" })) as { wallet: { exists: boolean; address?: string } };
      expect(typeof before.wallet.exists).toBe("boolean");

      if (!before.wallet.exists) {
        const generated = (await runTool({ tool: "generate_local_wallet" })) as {
          wallet: { exists: boolean; address: string };
          privateKey: string;
        };
        expect(generated.wallet.exists).toBe(true);
        expect(generated.wallet.address.startsWith("0x")).toBe(true);
        expect(generated.privateKey.startsWith("0x")).toBe(true);
      }

      const after = (await runTool({ tool: "get_local_wallet" })) as {
        wallet: { exists: boolean; address: string };
      };
      expect(after.wallet.exists).toBe(true);
      expect(after.wallet.address.startsWith("0x")).toBe(true);
    } finally {
      delete process.env.CLAWOS_LOCAL_CONFIG_PATH;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
