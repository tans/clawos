import { existsSync, rmSync, statSync, watch, type FSWatcher } from "node:fs";
import { join, relative } from "node:path";

type ChildProcessHandle = {
  name: string;
  proc: Bun.Subprocess;
};

type WatchTarget = {
  label: string;
  path: string;
  recursive?: boolean;
};

const BUN_EXECUTABLE = process.execPath;
const WATCH_DEBOUNCE_MS = 450;
const WATCH_STARTUP_IGNORE_MS = 3_000;
const WEBVIEW_BUILD_OUTPUTS = [
  join(process.cwd(), "webview-dist", "assets", "app.css"),
  join(process.cwd(), "webview-dist", "assets", "react-app.js"),
];
const WATCH_TARGETS: WatchTarget[] = [
  { label: "main", path: join(process.cwd(), "main"), recursive: true },
  { label: "server", path: join(process.cwd(), "server"), recursive: true },
  { label: "shared", path: join(process.cwd(), "shared"), recursive: true },
  { label: "webview", path: join(process.cwd(), "webview"), recursive: true },
  { label: "crm-mcp", path: join(process.cwd(), "..", "mcp", "crm-mcp"), recursive: true },
  { label: "wechat-mcp", path: join(process.cwd(), "..", "mcp", "wechat-mcp"), recursive: true },
  { label: "windows-mcp", path: join(process.cwd(), "..", "mcp", "windows-mcp"), recursive: true },
  { label: "yingdao-mcp", path: join(process.cwd(), "..", "mcp", "yingdao-mcp"), recursive: true },
  { label: "web-public", path: join(process.cwd(), "..", "web", "public"), recursive: true },
];

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

async function runRequiredCommand(name: string, cmd: string[]): Promise<void> {
  console.log(`[desktop-dev] run ${name}: ${cmd.join(" ")}`);
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}`);
  }
}

function assertWebviewBuildOutputs(): void {
  const missing = WEBVIEW_BUILD_OUTPUTS.filter((filePath) => !existsSync(filePath));
  if (missing.length > 0) {
    throw new Error(`webview build outputs are missing: ${missing.join(", ")}`);
  }
}

function readOldestWebviewOutputMtimeMs(): number | null {
  if (WEBVIEW_BUILD_OUTPUTS.some((filePath) => !existsSync(filePath))) {
    return null;
  }

  let oldestMtime = Number.POSITIVE_INFINITY;
  for (const filePath of WEBVIEW_BUILD_OUTPUTS) {
    const mtimeMs = statSync(filePath).mtimeMs;
    if (!Number.isFinite(mtimeMs)) {
      return null;
    }
    oldestMtime = Math.min(oldestMtime, mtimeMs);
  }

  return Number.isFinite(oldestMtime) ? oldestMtime : null;
}

async function waitForWebviewBuildOutputs(afterMs?: number, timeoutMs = 20_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const oldestMtime = readOldestWebviewOutputMtimeMs();
    if (oldestMtime !== null && (afterMs === undefined || oldestMtime >= afterMs)) {
      return;
    }
    await Bun.sleep(200);
  }

  assertWebviewBuildOutputs();
}

async function ensureInitialWebviewBuild(): Promise<void> {
  await runRequiredCommand("initial webview build", [BUN_EXECUTABLE, "run", "webview:build"]);
  assertWebviewBuildOutputs();
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

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      rmSync(devBuildDir, { recursive: true, force: true });
      console.log(`[desktop-dev] cleaned ${devBuildDir}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 6) {
        console.warn(`[desktop-dev] failed to clean ${devBuildDir}: ${message}`);
        return;
      }
      await Bun.sleep(250 * attempt);
    }
  }
}

function watchPath(target: WatchTarget, onChange: (reason: string) => void): FSWatcher | null {
  if (!existsSync(target.path)) {
    console.warn(`[desktop-dev] watch skipped (${target.label}): ${target.path}`);
    return null;
  }

  try {
    const watcher = watch(
      target.path,
      { recursive: target.recursive === true },
      (_eventType, filename) => {
        const suffix = typeof filename === "string" && filename.trim() ? `/${filename.replace(/\\/g, "/")}` : "";
        const displayRoot = relative(process.cwd(), target.path).replace(/\\/g, "/") || ".";
        onChange(`${target.label}:${displayRoot}${suffix}`);
      }
    );
    watcher.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[desktop-dev] watch runtime error (${target.label}): ${message}`);
      try {
        watcher.close();
      } catch {
        // ignore
      }
    });
    return watcher;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop-dev] watch failed (${target.label}): ${message}`);
    return null;
  }
}

async function main(): Promise<void> {
  await cleanupWindowsDevBuild();
  await ensureInitialWebviewBuild();

  const webviewChild = spawnChild("webview", [BUN_EXECUTABLE, "run", "webview:watch"]);
  const children = new Set<ChildProcessHandle>([webviewChild]);
  const watchers: FSWatcher[] = [];

  let electrobunChild: ChildProcessHandle | null = null;
  let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let isRebuilding = false;
  let shuttingDown = false;
  let expectedElectrobunExitPid: number | null = null;
  const queuedReasons = new Set<string>();
  let watchEventsEnabledAt = Number.POSITIVE_INFINITY;
  let pendingWebviewBuildSince: number | null = null;

  const shutdown = (reason: string, exitCode = 0): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[desktop-dev] stopping children (${reason})`);
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }
    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore watcher close failures during shutdown.
      }
    }
    for (const child of children) {
      stopChild(child);
    }
    process.exit(exitCode);
  };

  const monitorChild = (child: ChildProcessHandle): void => {
    void child.proc.exited.then((code) => {
      children.delete(child);

      if (shuttingDown) {
        return;
      }

      if (child.name === "electrobun") {
        if (electrobunChild?.proc.pid === child.proc.pid) {
          electrobunChild = null;
        }
        if (expectedElectrobunExitPid !== null && child.proc.pid === expectedElectrobunExitPid) {
          expectedElectrobunExitPid = null;
          return;
        }
        console.error(`[desktop-dev] electrobun exited unexpectedly with code ${code}`);
        shutdown("electrobun exited unexpectedly", code ?? 1);
        return;
      }

      console.error(`[desktop-dev] ${child.name} exited unexpectedly with code ${code}`);
      shutdown(`${child.name} exited unexpectedly`, code ?? 1);
    });
  };

  const startElectrobun = async (): Promise<void> => {
    await waitForWebviewBuildOutputs(pendingWebviewBuildSince ?? undefined);
    pendingWebviewBuildSince = null;
    const child = spawnChild(
      "electrobun",
      [BUN_EXECUTABLE, "run", "scripts/electrobun.ts", "dev"],
      {
        CLAWOS_DESKTOP_DEV: "1",
        CLAWOS_WIN_ICON: "0",
      }
    );
    electrobunChild = child;
    children.add(child);
    monitorChild(child);
  };

  const rebuildDesktop = async (): Promise<void> => {
    if (shuttingDown || isRebuilding) {
      return;
    }

    isRebuilding = true;
    const reasons = Array.from(queuedReasons);
    queuedReasons.clear();
    console.log(`[desktop-dev] rebuilding desktop (${reasons.join(", ")})`);

    try {
      if (electrobunChild) {
        expectedElectrobunExitPid = electrobunChild.proc.pid ?? null;
        stopChild(electrobunChild);
        await Promise.race([electrobunChild.proc.exited, Bun.sleep(8_000)]);
      }

      await cleanupWindowsDevBuild();
      await startElectrobun();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[desktop-dev] rebuild failed: ${message}`);
    } finally {
      isRebuilding = false;
      if (!shuttingDown && queuedReasons.size > 0) {
        if (rebuildTimer) {
          clearTimeout(rebuildTimer);
        }
        rebuildTimer = setTimeout(() => {
          rebuildTimer = null;
          void rebuildDesktop();
        }, WATCH_DEBOUNCE_MS);
      }
    }
  };

  const scheduleRebuild = (reason: string): void => {
    if (shuttingDown) {
      return;
    }
    if (Date.now() < watchEventsEnabledAt) {
      return;
    }
    if (reason.startsWith("webview:")) {
      pendingWebviewBuildSince = Date.now();
    }
    queuedReasons.add(reason);
    if (rebuildTimer || isRebuilding) {
      return;
    }
    rebuildTimer = setTimeout(() => {
      rebuildTimer = null;
      void rebuildDesktop();
    }, WATCH_DEBOUNCE_MS);
  };

  monitorChild(webviewChild);

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  await startElectrobun();
  for (const target of WATCH_TARGETS) {
    const watcher = watchPath(target, scheduleRebuild);
    if (watcher) {
      watchers.push(watcher);
    }
  }
  watchEventsEnabledAt = Date.now() + WATCH_STARTUP_IGNORE_MS;
  await new Promise(() => {
    // Keep the script alive until a child exits or a signal arrives.
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop-dev] fatal error: ${message}`);
  process.exit(1);
});
