export type PlatformShellMode = "login" | "interactive" | "non-login" | "clean";

export function isWindowsPlatform(): boolean {
  return process.platform === "win32";
}

export function buildUnixBashArgs(script: string, shellMode: PlatformShellMode): string[] {
  if (shellMode === "interactive") {
    return ["bash", "-ic", script];
  }
  if (shellMode === "clean") {
    return ["bash", "--noprofile", "--norc", "-c", script];
  }
  return ["bash", "-lc", script];
}

export function buildWindowsWslArgs(options: {
  script: string;
  shellMode: PlatformShellMode;
  preferStdin: boolean;
  distro?: string;
  wslBin?: string;
}): string[] {
  const wslBin = options.wslBin?.trim() || "wsl.exe";
  const distro = options.distro?.trim();

  if (options.preferStdin) {
    if (options.shellMode === "interactive") {
      return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", "-is"];
    }
    if (options.shellMode === "clean") {
      return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", "--noprofile", "--norc", "-s"];
    }

    const shellFlag = options.shellMode === "non-login" ? "-s" : "-lis";
    return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", shellFlag];
  }

  if (options.shellMode === "interactive") {
    return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", "-ic", options.script];
  }
  if (options.shellMode === "clean") {
    return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", "--noprofile", "--norc", "-c", options.script];
  }

  const shellFlag = options.shellMode === "non-login" ? "-lc" : "-lic";
  return [wslBin, ...(distro ? ["-d", distro] : []), "--", "bash", shellFlag, options.script];
}

export function buildKillProcessArgs(pid: number): string[] {
  return isWindowsPlatform()
    ? ["cmd.exe", "/d", "/c", `taskkill /PID ${pid} /T /F`]
    : ["kill", "-9", String(pid)];
}
