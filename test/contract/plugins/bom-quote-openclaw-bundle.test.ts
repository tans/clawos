import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

const BUNDLE_ROOT = "plugins/bom-quote-openclaw";

describe("bom-quote OpenClaw bundle contract", () => {
  it("ships a plugin manifest, bundled skill, and MCP server config", async () => {
    const [pluginManifest, bundleSkill, mcpConfig] = await Promise.all([
      readFile(`${BUNDLE_ROOT}/.codex-plugin/plugin.json`, "utf-8"),
      readFile(`${BUNDLE_ROOT}/skills/bom-quote/SKILL.md`, "utf-8"),
      readFile(`${BUNDLE_ROOT}/.mcp.json`, "utf-8"),
    ]);

    expect(pluginManifest).toContain('"name": "bom-quote-openclaw"');
    expect(pluginManifest).toContain('"skills": "./skills/"');
    expect(pluginManifest).toContain('"mcpServers": "./.mcp.json"');

    expect(bundleSkill).toContain("name: bom-quote");
    expect(bundleSkill).toContain("quote_customer_message");
    expect(bundleSkill).toContain("export_customer_quote");

    expect(mcpConfig).toContain('"mcpServers"');
    expect(mcpConfig).toContain('"bom-mcp"');
    expect(mcpConfig).toContain('"command"');
    expect(mcpConfig).toContain('"bun"');
    expect(mcpConfig).toContain('"serve"');
    expect(mcpConfig).toContain('"stdio"');
  });
});
