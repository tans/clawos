import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

type ChildProcessHandle = {
  name: string;
  proc: Bun.Subprocess;
};

const BUN_EXECUTABLE = process.execPath;

function spawnChild(name: string, cmd: string[], env?: Record<string, string>): ChildProcessHandle {
  console.log(`[desktop-dev] start ${name}: ${cmd.join(" ")}`);
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(env || {}),
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return { name, proc };
}

function stopChild(child: ChildProcessHandle): void {
  if (child.proc.killed || child.proc.exitCode !== null) {
    return;
  }
  try {
    if (process.platform === "win32" && typeof child.proc.pid === "number") {
      runBestEffortCommand(`stop ${child.name} process tree`, [
        "cmd",
        "/c",
        `taskkill /PID ${child.proc.pid} /T /F`,
      ]);
      return;
    }
    child.proc.kill();
  } catch {
    // Ignore stop failures during shutdown.
  }
}

function runBestEffortCommand(name: string, cmd: string[]): void {
  try {
    const result = Bun.spawnSync({
      cmd,
      cwd: process.cwd(),
      env: process.env,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "pipe",
    });
    if (result.exitCode !== 0 && result.exitCode !== null) {
      const stderrText =
        result.stderr && result.stderr.length > 0
          ? new TextDecoder().decode(result.stderr).trim()
          : "";
      if (stderrText) {
        console.warn(`[desktop-dev] ${name} returned ${result.exitCode}: ${stderrText}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop-dev] ${name} skipped: ${message}`);
  }
}

async function cleanupWindowsDevBuild(): Promise<void> {
  if (process.platform !== "win32") {
    return;
  }

  const devBuildDir = join(process.cwd(), "build", "dev-win-x64");
  const killScript =
    "$ErrorActionPreference='SilentlyContinue'; " +
    "Get-CimInstance Win32_Process | " +
    "Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -like '*\\build\\dev-win-x64\\ClawOS-dev\\bin\\launcher.exe' -or $_.ExecutablePath -like '*\\build\\dev-win-x64\\ClawOS-dev\\bin\\ClawOS-dev.exe' -or $_.ExecutablePath -like '*\\build\\dev-win-x64\\ClawOS-dev\\bin\\bun.exe') } | " +
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";

  runBestEffortCommand("cleanup stale ClawOS-dev processes", [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    killScript,
  ]);
  runBestEffortCommand("cleanup stale ClawOS-dev.exe", [
    "cmd",
    "/c",
    "taskkill /F /IM ClawOS-dev.exe /T",
  ]);
  runBestEffortCommand("cleanup stale launcher.exe", [
    "cmd",
    "/c",
    "taskkill /F /IM launcher.exe /T",
  ]);
  runBestEffortCommand("cleanup stale dev bun.exe", [
    "powershell.exe",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "$ErrorActionPreference='SilentlyContinue'; " +
      "Get-CimInstance Win32_Process | " +
      "Where-Object { $_.ExecutablePath -and $_.ExecutablePath -like '*\\build\\dev-win-x64\\ClawOS-dev\\bin\\bun.exe' } | " +
      "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }",
  ]);

  if (!existsSync(devBuildDir)) {
    return;
  }

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      rmSync(devBuildDir, { recursive: true, force: true });
      console.log(`[desktop-dev] cleaned ${devBuildDir}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 4) {
        console.warn(`[desktop-dev] failed to clean ${devBuildDir}: ${message}`);
        return;
      }
      await Bun.sleep(250 * attempt);
    }
  }
}

async function main(): Promise<void> {
  await cleanupWindowsDevBuild();

  const children: ChildProcessHandle[] = [
    spawnChild("tailwind", [BUN_EXECUTABLE, "run", "tailwind:watch"]),
    spawnChild("electrobun", [BUN_EXECUTABLE, "run", "scripts/electrobun.ts", "dev", "--watch"], {
      CLAWOS_DESKTOP_DEV: "1",
    }),
  ];

  let shuttingDown = false;
  const shutdown = (reason: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[desktop-dev] stopping children (${reason})`);
    for (const child of children) {
      stopChild(child);
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  const exit = await Promise.race(
    children.map(async (child) => {
      const code = await child.proc.exited;
      return { name: child.name, code };
    })
  );

  shutdown(`${exit.name} exited with code ${exit.code}`);
  await Promise.allSettled(children.map(async (child) => child.proc.exited));

  if (exit.code !== 0) {
    console.error(`[desktop-dev] ${exit.name} failed with exit code ${exit.code}`);
  }
  process.exit(exit.code);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop-dev] fatal error: ${message}`);
  process.exit(1);
});
