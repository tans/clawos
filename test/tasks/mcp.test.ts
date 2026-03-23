import { describe, expect, it } from "bun:test";
import { startMcpBuildTask } from "../../app/server/tasks/mcp";

describe("startMcpBuildTask", () => {
  it("skips the legacy build flow for windows-mcp", () => {
    const { task, reused } = startMcpBuildTask("windows-mcp");

    expect(reused).toBe(false);
    expect(task.status).toBe("success");
    expect(task.logs.some((entry) => entry.message.includes("local service mode"))).toBe(true);
    expect(task.logs.some((entry) => entry.message.includes("Desktop Control MCP switch"))).toBe(true);
  });
});
