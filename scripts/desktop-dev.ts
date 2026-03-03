type ChildProcessHandle = {
  name: string;
  proc: Bun.Subprocess;
};

function spawnChild(name: string, cmd: string[], env?: Record<string, string>): ChildProcessHandle {
  console.log(`[desktop-dev] start ${name}: ${cmd.join(" ")}`);
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(env || {}),
    },
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
    child.proc.kill();
  } catch {
    // Ignore stop failures during shutdown.
  }
}

async function main(): Promise<void> {
  const children: ChildProcessHandle[] = [
    spawnChild("tailwind", ["bun", "run", "tailwind:watch"]),
    spawnChild("electrobun", ["bun", "x", "electrobun", "dev", "--watch"], { CLAWOS_DESKTOP_DEV: "1" }),
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
