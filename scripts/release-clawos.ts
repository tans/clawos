import { spawn } from "node:child_process";

type BuildEnv = "dev" | "canary" | "stable";

type Options = {
  env: BuildEnv;
  skipBuild: boolean;
  skipPublish: boolean;
  publishArgs: string[];
};

function parseEnv(raw: string | undefined): BuildEnv {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "dev" || value === "canary" || value === "stable") {
    return value;
  }
  return "stable";
}

function printUsage(): void {
  console.log(`ClawOS Electrobun 一键构建发布

用法:
  bun run scripts/release-clawos.ts [options] [-- <publish args>]

选项:
  --env <env>        构建环境: dev/canary/stable，默认 stable
  --skip-build       跳过构建，仅执行发布
  --skip-publish     仅构建不发布
  -h, --help         显示帮助

示例:
  bun run scripts/release-clawos.ts --env=stable
  bun run scripts/release-clawos.ts --env=stable -- --skip-config
  bun run scripts/release-clawos.ts --skip-build -- --installer artifacts/stable-win-x64-ClawOS-Setup.zip
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    env: parseEnv(process.env.CLAWOS_BUILD_ENV),
    skipBuild: false,
    skipPublish: false,
    publishArgs: [],
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "--") {
      options.publishArgs.push(...args);
      break;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-build") {
      options.skipBuild = true;
      continue;
    }

    if (arg === "--skip-publish") {
      options.skipPublish = true;
      continue;
    }

    if (arg.startsWith("--env=")) {
      options.env = parseEnv(arg.slice("--env=".length));
      continue;
    }

    if (arg === "--env") {
      const value = args.shift();
      if (!value) {
        throw new Error("--env 缺少参数");
      }
      options.env = parseEnv(value);
      continue;
    }

    options.publishArgs.push(arg);
  }

  return options;
}

async function runStep(name: string, cmd: string[]): Promise<void> {
  console.log(`[release] ${name}`);
  console.log(`[release] cmd: ${cmd.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} 失败，退出码 ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log(`[release] build env: ${options.env}`);
  if (options.skipBuild) {
    console.log("[release] 跳过构建 (--skip-build)");
  }
  if (options.skipPublish) {
    console.log("[release] 跳过发布 (--skip-publish)");
  }

  if (!options.skipBuild) {
    await runStep("构建 UI 样式", ["bun", "run", "tailwind:build"]);
    await runStep("构建 Electrobun", ["bun", "run", "scripts/electrobun.ts", "build", `--env=${options.env}`]);
  }

  if (!options.skipPublish) {
    const publishCmd = ["bun", "run", "scripts/publish-clawos.ts", `--build-env=${options.env}`, ...options.publishArgs];
    await runStep("发布安装包和配置", publishCmd);
  }

  console.log("[release] 完成。");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release] 失败: ${message}`);
  process.exit(1);
});
