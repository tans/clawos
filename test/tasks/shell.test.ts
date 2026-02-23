import { describe, expect, it } from "bun:test";
import {
  buildWslProcessArgs,
  parseWslDistroList,
  selectPreferredWslDistro,
} from "../../src/tasks/shell";

describe("runWslScript shell mode", () => {
  it("uses interactive bash in windows path", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lic", "openclaw --version"]);
  });

  it("uses non-login bash in windows path when loginShell is false", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
      loginShell: false,
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", "openclaw --version"]);
  });

  it("uses interactive bash in windows path when shellMode is interactive", () => {
    const args = buildWslProcessArgs("command -v git", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
      shellMode: "interactive",
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-ic", "command -v git"]);
  });

  it("uses clean bash in windows path when shellMode is clean", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
      shellMode: "clean",
    });

    expect(args).toEqual([
      "wsl.exe",
      "-d",
      "Ubuntu",
      "--",
      "bash",
      "--noprofile",
      "--norc",
      "-c",
      "openclaw --version",
    ]);
  });

  it("uses non-interactive bash in non-windows path", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: false,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
    });

    expect(args).toEqual(["bash", "-lc", "openclaw --version"]);
  });

  it("uses clean bash in non-windows path when shellMode is clean", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: false,
      shellMode: "clean",
    });

    expect(args).toEqual(["bash", "--noprofile", "--norc", "-c", "openclaw --version"]);
  });

  it("uses interactive bash in non-windows path when shellMode is interactive", () => {
    const args = buildWslProcessArgs("command -v git", {
      isWindows: false,
      shellMode: "interactive",
    });

    expect(args).toEqual(["bash", "-ic", "command -v git"]);
  });

  it("parses wsl distro list output", () => {
    const list = parseWslDistroList("Ubuntu\r\nUbuntu-22.04\r\n\r\n");
    expect(list).toEqual(["Ubuntu", "Ubuntu-22.04"]);
  });

  it("prefers Ubuntu distro when multiple distros exist", () => {
    expect(selectPreferredWslDistro(["Debian", "Ubuntu", "Arch"])).toBe("Ubuntu");
  });

  it("prefers Ubuntu family distro when exact Ubuntu does not exist", () => {
    expect(selectPreferredWslDistro(["Debian", "Ubuntu-22.04", "Arch"])).toBe("Ubuntu-22.04");
  });

  it("falls back to the only distro when exactly one exists", () => {
    expect(selectPreferredWslDistro(["Debian"])).toBe("Debian");
  });
});
