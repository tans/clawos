import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_QWCLI_EXE_PATH,
  buildQwGatewayStartArgs,
  buildQwGatewayStartCommand,
  resolveQwcliWorkingDirectory,
  resolveQwcliExePath,
} from "../../src/tasks/gateway";

const originalQwcliPathEnv = process.env.CLAWOS_QWCLI_EXE_PATH;

afterEach(() => {
  if (originalQwcliPathEnv === undefined) {
    delete process.env.CLAWOS_QWCLI_EXE_PATH;
    return;
  }
  process.env.CLAWOS_QWCLI_EXE_PATH = originalQwcliPathEnv;
});

describe("qw gateway restart command", () => {
  it("uses default exe path when env is not set", () => {
    delete process.env.CLAWOS_QWCLI_EXE_PATH;
    expect(resolveQwcliExePath()).toBe(DEFAULT_QWCLI_EXE_PATH);
  });

  it("uses env override path when provided", () => {
    process.env.CLAWOS_QWCLI_EXE_PATH = "D:\\tools\\qw\\cli.exe";
    expect(resolveQwcliExePath()).toBe("D:\\tools\\qw\\cli.exe");
  });

  it("builds powershell start command and args safely", () => {
    const exePath = "C:\\Program Files\\QW\\cli'svc.exe";
    const workingDirectory = resolveQwcliWorkingDirectory(exePath);
    const command = buildQwGatewayStartCommand(exePath, workingDirectory);
    const args = buildQwGatewayStartArgs(exePath, workingDirectory);

    expect(command).toBe(
      "Start-Process -FilePath 'C:\\Program Files\\QW\\cli''svc.exe' -WorkingDirectory 'C:\\Program Files\\QW' -WindowStyle Hidden"
    );
    expect(args).toEqual([
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "Start-Process -FilePath 'C:\\Program Files\\QW\\cli''svc.exe' -WorkingDirectory 'C:\\Program Files\\QW' -WindowStyle Hidden",
    ]);
  });
});
