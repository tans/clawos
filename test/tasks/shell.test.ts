import { describe, expect, it } from "bun:test";
import {
  buildWslProcessArgs,
  decodeProcessOutput,
  parseWslDistroList,
  selectPreferredWslDistro,
} from "../../app/src/tasks/shell";

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

  it("uses stdin script mode in windows path when preferStdin is true", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
      preferStdin: true,
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lis"]);
  });

  it("uses clean stdin script mode in windows path when preferStdin is true", () => {
    const args = buildWslProcessArgs("openclaw --version", {
      isWindows: true,
      distro: "Ubuntu",
      wslBin: "wsl.exe",
      shellMode: "clean",
      preferStdin: true,
    });

    expect(args).toEqual(["wsl.exe", "-d", "Ubuntu", "--", "bash", "--noprofile", "--norc", "-s"]);
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

  it("decodes utf-8 process output", () => {
    const bytes = new TextEncoder().encode("中文 output");
    expect(decodeProcessOutput(bytes)).toBe("中文 output");
  });

  it("decodes utf-16le output with BOM", () => {
    const payload = Buffer.from("中文输出", "utf16le");
    const bytes = new Uint8Array(payload.length + 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    bytes.set(payload, 2);
    expect(decodeProcessOutput(bytes)).toBe("中文输出");
  });

  it("decodes utf-16le output without BOM when null-pattern is detected", () => {
    const bytes = new Uint8Array(Buffer.from("Hello 中文", "utf16le"));
    expect(decodeProcessOutput(bytes)).toBe("Hello 中文");
  });
});
