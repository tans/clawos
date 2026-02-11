import { describe, expect, it } from "bun:test";
import type { CommandResult } from "../../src/tasks/shell";
import {
  REQUIRED_WSL_COMMANDS,
  buildWslCommandProbeScript,
  checkWslCommandRequirements,
  parseWslCommandProbeOutput,
} from "../../src/system/wsl-requirements";

function runnerResult(partial: Partial<CommandResult>): CommandResult {
  return {
    ok: partial.ok ?? true,
    code: partial.code ?? 0,
    stdout: partial.stdout ?? "",
    stderr: partial.stderr ?? "",
    command: partial.command ?? "bash -lc probe",
  };
}

describe("wsl command requirements", () => {
  it("includes required commands for update flow", () => {
    expect(Array.from(REQUIRED_WSL_COMMANDS)).toEqual(["openclaw", "git", "pnpm", "nrm"]);
  });

  it("builds probe script with all required commands", () => {
    const script = buildWslCommandProbeScript();
    expect(script).toContain("for cmd in 'openclaw' 'git' 'pnpm' 'nrm'; do");
    expect(script).toContain('path="$(command -v "$cmd" 2>/dev/null | head -n 1)"');
    expect(script).toContain("command -v \"$cmd\"");
  });

  it("parses probe output for existing and missing commands", () => {
    const statuses = parseWslCommandProbeOutput(
      [
        "__CLAWOS_WSL_CMD_OK__:openclaw:/usr/local/bin/openclaw",
        "__CLAWOS_WSL_CMD_OK__:git:/usr/bin/git",
        "__CLAWOS_WSL_CMD_MISSING__:pnpm",
        "__CLAWOS_WSL_CMD_MISSING__:nrm",
      ].join("\n")
    );

    expect(statuses).toEqual([
      { command: "openclaw", exists: true, path: "/usr/local/bin/openclaw" },
      { command: "git", exists: true, path: "/usr/bin/git" },
      { command: "pnpm", exists: false },
      { command: "nrm", exists: false },
    ]);
  });

  it("returns missing commands from runner output", async () => {
    const result = await checkWslCommandRequirements(
      ["openclaw", "git", "pnpm", "nrm"],
      async () =>
        runnerResult({
          ok: true,
          stdout: [
            "__CLAWOS_WSL_CMD_OK__:openclaw:/usr/local/bin/openclaw",
            "__CLAWOS_WSL_CMD_OK__:git:/usr/bin/git",
            "__CLAWOS_WSL_CMD_OK__:pnpm:/usr/local/bin/pnpm",
            "__CLAWOS_WSL_CMD_MISSING__:nrm",
          ].join("\n"),
        })
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["nrm"]);
    expect(result.commands.find((item) => item.command === "pnpm")).toEqual({
      command: "pnpm",
      exists: true,
      path: "/usr/local/bin/pnpm",
    });
  });

  it("returns failed status when runner execution fails", async () => {
    const result = await checkWslCommandRequirements(
      ["openclaw", "git"],
      async () =>
        runnerResult({
          ok: false,
          code: 127,
          stderr: "wsl.exe not found",
          stdout: "",
        })
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe(127);
    expect(result.missing).toEqual(["openclaw", "git"]);
    expect(result.stderr).toBe("wsl.exe not found");
  });
});
