import { describe, expect, it } from "bun:test";
import {
  DEFAULT_QWCLI_EXE_PATH,
  buildQwGatewayStartArgs,
  buildQwGatewayStartCommand,
  resolveQwcliWorkingDirectory,
  resolveQwcliExePath,
} from "../../app/src/tasks/gateway";

describe("qw gateway restart command", () => {
  it("always uses managed default exe path", () => {
    expect(resolveQwcliExePath()).toBe(DEFAULT_QWCLI_EXE_PATH);
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
