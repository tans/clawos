import { access, mkdir, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, resolve } from "node:path";

interface BuildOptions {
  outfile: string;
  skipCss: boolean;
}

function printUsage(): void {
  console.log(`ClawOS 打包脚本\n\n用法:\n  bun run scripts/build-clawos.ts [options]\n\n选项:\n  --outfile <path>   输出路径，默认 ./dist/clawos.exe\n  --skip-css         跳过 Tailwind CSS 构建\n  -h, --help         显示帮助\n`);
}

function parseArgs(argv: string[]): BuildOptions {
  const options: BuildOptions = {
    outfile: resolve(process.cwd(), "dist/clawos.exe"),
    skipCss: false,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-css") {
      options.skipCss = true;
      continue;
    }

    if (arg === "--outfile") {
      const value = args.shift();
      if (!value) {
        throw new Error("--outfile 缺少路径参数");
      }
      options.outfile = resolve(process.cwd(), value);
      continue;
    }

    throw new Error(`未知参数: ${arg}`);
  }

  return options;
}

async function runStep(title: string, cmd: string[]): Promise<void> {
  console.log(`[build] ${title}`);
  const proc = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`${title} 失败，退出码 ${code}`);
  }
}

async function assertOutputFile(path: string): Promise<number> {
  await access(path, fsConstants.R_OK);
  const info = await stat(path);
  return info.size;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await mkdir(dirname(options.outfile), { recursive: true });

  console.log(`[build] 输出文件: ${options.outfile}`);

  if (!options.skipCss) {
    await runStep("构建 UI 样式", ["bun", "run", "tailwind:build"]);
  } else {
    console.log("[build] 跳过 UI 样式构建 (--skip-css)");
  }

  await runStep("编译 ClawOS 可执行文件", [
    "bun",
    "build",
    "src/server.ts",
    "--compile",
    "--outfile",
    options.outfile,
  ]);

  const size = await assertOutputFile(options.outfile);
  console.log(`[build] 打包完成: ${options.outfile}`);
  console.log(`[build] 文件大小: ${formatBytes(size)}`);
}

main().catch((error) => {
  console.error(`[build] 失败: ${(error as Error).message}`);
  process.exit(1);
});
