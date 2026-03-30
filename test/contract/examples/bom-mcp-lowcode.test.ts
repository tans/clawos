import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

describe("bom-mcp lowcode example contract", () => {
  it("exists with the expected MCP panel structure", async () => {
    const example = await readFile("examples/mcp/bom-mcp.lowcode.yaml", "utf-8");

    expect(example).toContain("kind: MCPPanel");
    expect(example).toContain("name: bom-mcp");
    expect(example).toContain("executor: mcp_runtime.start");
    expect(example).toContain("executor: mcp_runtime.stop");
    expect(example).toContain("executor: mcp_runtime.reload");
    expect(example).toContain("executor: mcp_observe.healthcheck");
    expect(example).toContain("BOM_MCP_STATE_DIR");
    expect(example).toContain("BOM_MCP_EXPORT_DIR");
    expect(example).toContain("BOM_MCP_CACHE_DIR");
  });
});
