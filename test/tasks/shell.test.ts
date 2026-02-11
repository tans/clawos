import { describe, expect, it } from "bun:test";
import { buildWslProcessArgs } from "../../src/tasks/shell";

describe("runWslScript shell mode", () => {
  it("uses interactive bash in windows path", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-ic", "openclaw --version"]);
  });

  it("uses non-interactive bash in non-windows path", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: false,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
    });

    expect(args).toEqual(["bash", "-lc", "openclaw --version"]);
  });
});
