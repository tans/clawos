import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, resolve } from "node:path";

interface Options {
  baseUrl: string;
  token: string;
  installerPath: string;
  configPath: string;
  version?: string;
  skipInstaller: boolean;
  skipConfig: boolean;
}

function printUsage(): void {
  console.log(`ClawOS 发布脚本

用法:
  bun run scripts/publish-clawos.ts [options]

选项:
  --base-url <url>      发布站点，默认 https://clawos.minapp.xin
  --token <token>       上传 Token，默认读取 UPLOAD_TOKEN，未设置则使用 clawos
  --installer <path>    安装包路径，默认 ./dist/clawos.exe
  --config <path>       配置文件路径，默认 ./clawos_xiake.json
  --version <version>   安装包版本（可选）
  --skip-installer      跳过安装包上传
  --skip-config         跳过配置文件上传
  -h, --help            显示帮助
`);
}

function parseArgs(argv: string[]): Options {
  const args = [...argv];
  const opts: Options = {
    baseUrl: "https://clawos.minapp.xin",
    token: process.env.UPLOAD_TOKEN?.trim() || "clawos",
    installerPath: resolve(process.cwd(), "dist/clawos.exe"),
    configPath: resolve(process.cwd(), "clawos_xiake.json"),
    version: undefined,
    skipInstaller: false,
    skipConfig: false,
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--skip-installer") {
      opts.skipInstaller = true;
      continue;
    }

    if (arg === "--skip-config") {
      opts.skipConfig = true;
      continue;
    }

    const value = args.shift();
    if (!value) {
      throw new Error(`参数缺少值: ${arg}`);
    }

    switch (arg) {
      case "--base-url":
        opts.baseUrl = value.trim().replace(/\/+$/, "");
        break;
      case "--token":
        opts.token = value.trim();
        break;
      case "--installer":
        opts.installerPath = resolve(process.cwd(), value);
        break;
      case "--config":
        opts.configPath = resolve(process.cwd(), value);
        break;
      case "--version":
        opts.version = value.trim();
        break;
      default:
        throw new Error(`未知参数: ${arg}`);
    }
  }

  if (!opts.token) {
    throw new Error("UPLOAD_TOKEN 为空，请通过 --token 或环境变量设置。");
  }

  if (opts.skipInstaller && opts.skipConfig) {
    throw new Error("不能同时跳过 installer 和 config。");
  }

  return opts;
}

async function assertFileReadable(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw new Error(`${label}文件不可读或不存在: ${filePath}`);
  }
}

async function detectVersionFromPackageJson(): Promise<string | undefined> {
  try {
    const pkgRaw = await readFile(resolve(process.cwd(), "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function uploadFile(params: {
  endpoint: string;
  filePath: string;
  token: string;
  baseUrl: string;
  version?: string;
}): Promise<Record<string, unknown>> {
  const file = Bun.file(params.filePath);
  const form = new FormData();
  form.append("file", file, basename(params.filePath));
  if (params.version) {
    form.append("version", params.version);
  }

  const url = `${params.baseUrl}${params.endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
    },
    body: form,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`上传接口返回非 JSON: ${url}\n${text}`);
  }

  if (!res.ok || data.ok !== true) {
    const err = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(`上传失败: ${url}\n${err}`);
  }

  return data;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.version && !opts.skipInstaller) {
    opts.version = await detectVersionFromPackageJson();
  }

  console.log(`[publish] base url: ${opts.baseUrl}`);
  console.log(`[publish] token: ${opts.token === "clawos" ? "clawos (default)" : "***"}`);
  if (opts.version) {
    console.log(`[publish] version: ${opts.version}`);
  }

  if (!opts.skipInstaller) {
    await assertFileReadable(opts.installerPath, "安装包");
    console.log(`[publish] 上传安装包: ${opts.installerPath}`);
    const result = await uploadFile({
      endpoint: "/api/upload/installer",
      filePath: opts.installerPath,
      token: opts.token,
      baseUrl: opts.baseUrl,
      version: opts.version,
    });
    console.log(`[publish] 安装包上传成功: ${String(result.fileName || "unknown")}`);
  }

  if (!opts.skipConfig) {
    await assertFileReadable(opts.configPath, "配置");
    console.log(`[publish] 上传配置文件: ${opts.configPath}`);
    const result = await uploadFile({
      endpoint: "/api/upload/xiake-config",
      filePath: opts.configPath,
      token: opts.token,
      baseUrl: opts.baseUrl,
    });
    console.log(`[publish] 配置文件上传成功: ${String(result.fileName || "unknown")}`);
  }

  console.log("[publish] 发布完成。");
}

main().catch((error) => {
  console.error(`[publish] 失败: ${(error as Error).message}`);
  process.exit(1);
});
