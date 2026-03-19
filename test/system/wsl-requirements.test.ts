import { describe, expect, it } from "bun:test";
import type { CommandResult } from "../../app/src/tasks/shell";
import {
  REQUIRED_WSL_COMMANDS,
  buildWslCommandProbeScript,
  checkWslCommandRequirements,
  parseWslCommandProbeOutput,
} from "../../app/src/system/wsl-requirements";

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
    expect(script).toContain("while IFS= read -r cmd; do");
    expect(script).toContain("__CLAWOS_WSL_CMD_LIST__");
    expect(script).toContain("\nopenclaw\n");
    expect(script).toContain("\ngit\n");
    expect(script).toContain("\npnpm\n");
    expect(script).toContain("\nnrm\n");
    expect(script).toContain('path="$(type -P "$cmd" 2>/dev/null | head -n 1)"');
    expect(script).toContain(`printf "__CLAWOS_WSL_CMD_OK__:%s:%s\\n" "$cmd" "$path"`);
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

  it("parses probe output with shell noise and ansi prefix", () => {
    const statuses = parseWslCommandProbeOutput(
      [
        "logout",
        "\u001b[0m__CLAWOS_WSL_CMD_OK__:git:/usr/bin/git",
        "__CLAWOS_WSL_CMD_MISSING__:nrm",
      ].join("\n"),
      ["git", "nrm"]
    );

    expect(statuses).toEqual([
      { command: "git", exists: true, path: "/usr/bin/git" },
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
    expect(result.stdout).toContain("__CLAWOS_WSL_CMD_OK__:pnpm:/usr/local/bin/pnpm");
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

  it("flags probe output anomaly when no marker lines are present", async () => {
    const result = await checkWslCommandRequirements(["git"], async () =>
      runnerResult({
        ok: true,
        stdout: "logout",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.stderr).toContain("未收到探测标记行");
  });

  it("filters benign logout noise from anomaly stderr", async () => {
    const result = await checkWslCommandRequirements(["git"], async () =>
      runnerResult({
        ok: true,
        stdout: "",
        stderr: "logout",
      })
    );

    expect(result.ok).toBe(false);
    expect(result.stderr).not.toContain("logout");
    expect(result.stderr).toContain("未收到探测标记行");
  });

  it("flags probe output anomaly when marker lines have empty command names", async () => {
    const result = await checkWslCommandRequirements(
      ["openclaw", "git", "pnpm", "nrm"],
      async () =>
        runnerResult({
          ok: true,
          stdout: [
            "__CLAWOS_WSL_CMD_MISSING__:",
            "__CLAWOS_WSL_CMD_MISSING__:",
            "__CLAWOS_WSL_CMD_MISSING__:",
            "__CLAWOS_WSL_CMD_MISSING__:",
          ].join("\n"),
        })
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.stderr).toContain("探测标记不完整或命令名缺失");
  });

  it("falls back to non-login probe when primary output is anomalous", async () => {
    const result = await checkWslCommandRequirements(
      ["openclaw", "git"],
      async () =>
        runnerResult({
          ok: true,
          stdout: "logout",
          stderr: "logout",
          command: "wsl.exe ... bash -lic ...",
        }),
      async () =>
        runnerResult({
          ok: true,
          stdout: [
            "__CLAWOS_WSL_CMD_OK__:openclaw:/usr/local/bin/openclaw",
            "__CLAWOS_WSL_CMD_OK__:git:/usr/bin/git",
          ].join("\n"),
          command: "wsl.exe ... bash -lc ...",
        })
    );

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.command).toContain("bash -lc");
    expect(result.commands).toEqual([
      { command: "openclaw", exists: true, path: "/usr/local/bin/openclaw" },
      { command: "git", exists: true, path: "/usr/bin/git" },
    ]);
  });
});
