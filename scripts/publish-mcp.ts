import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

type ReleaseChannel = "stable" | "beta";

interface McpManifest {
  schemaVersion: string;
  id: string;
  name: string;
  version: string;
  description?: string;
  displayName?: string;
  publisher?: {
    name?: string;
    website?: string;
  };
  platforms?: string[];
  [key: string]: unknown;
}

interface Options {
  mcpId: string;
  baseUrl: string;
  token: string;
  releaseChannel: ReleaseChannel;
  version?: string;
  writeManifest: boolean;
  timeoutMs: number;
  heartbeatMs: number;
}

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

function printUsage(): void {
  console.log(`Publish MCP

Usage:
  bun run scripts/publish-mcp.ts --mcp <mcp-id> [options]

Options:
  --mcp <id>                  MCP directory name under ./mcp
  --version <version>         Explicit version, otherwise auto-bump manifest patch
  --release-channel <name>    stable or beta, default stable
  --base-url <url>            Publish site, default https://clawos.minapp.xin
  --token <token>             Upload token, default from CLAWOS_UPLOAD_TOKEN/UPLOAD_TOKEN
  --no-write-manifest         Do not write bumped version back to mcp/<id>/manifest.json
  --timeout-ms <ms>           Upload timeout, default 600000
  --heartbeat-ms <ms>         Upload heartbeat log interval, default 15000
  -h, --help                  Show help
`);
}

function parseReleaseChannel(raw: string | undefined): ReleaseChannel {
  return (raw || "").trim().toLowerCase() === "beta" ? "beta" : "stable";
}

function parseArgs(argv: string[]): Options {
  const args = [...argv];
  const opts: Options = {
    mcpId: "",
    baseUrl: process.env.CLAWOS_PUBLISH_BASE_URL?.trim().replace(/\/+$/, "") || "https://clawos.minapp.xin",
    token: process.env.CLAWOS_UPLOAD_TOKEN?.trim() || process.env.UPLOAD_TOKEN?.trim() || "clawos",
    releaseChannel: parseReleaseChannel(process.env.CLAWOS_RELEASE_CHANNEL),
    version: process.env.CLAWOS_VERSION?.trim() || undefined,
    writeManifest: true,
    timeoutMs: Number.parseInt(process.env.UPLOAD_TIMEOUT_MS || "", 10) || 10 * 60 * 1000,
    heartbeatMs: Number.parseInt(process.env.UPLOAD_HEARTBEAT_MS || "", 10) || 15 * 1000,
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

    if (arg.startsWith("--mcp=")) {
      opts.mcpId = arg.slice("--mcp=".length).trim();
      continue;
    }
    if (arg.startsWith("--version=")) {
      opts.version = arg.slice("--version=".length).trim();
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      opts.baseUrl = arg.slice("--base-url=".length).trim().replace(/\/+$/, "");
      continue;
    }
    if (arg.startsWith("--token=")) {
      opts.token = arg.slice("--token=".length).trim();
      continue;
    }
    if (arg.startsWith("--release-channel=")) {
      opts.releaseChannel = parseReleaseChannel(arg.slice("--release-channel=".length));
      continue;
    }
    if (arg.startsWith("--timeout-ms=")) {
      opts.timeoutMs = Number.parseInt(arg.slice("--timeout-ms=".length), 10);
      continue;
    }
    if (arg.startsWith("--heartbeat-ms=")) {
      opts.heartbeatMs = Number.parseInt(arg.slice("--heartbeat-ms=".length), 10);
      continue;
    }
    if (arg === "--no-write-manifest") {
      opts.writeManifest = false;
      continue;
    }

    const value = args.shift();
    if (!value) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--mcp":
        opts.mcpId = value.trim();
        break;
      case "--version":
        opts.version = value.trim();
        break;
      case "--base-url":
        opts.baseUrl = value.trim().replace(/\/+$/, "");
        break;
      case "--token":
        opts.token = value.trim();
        break;
      case "--release-channel":
        opts.releaseChannel = parseReleaseChannel(value);
        break;
      case "--timeout-ms":
        opts.timeoutMs = Number.parseInt(value, 10);
        break;
      case "--heartbeat-ms":
        opts.heartbeatMs = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!opts.mcpId) {
    throw new Error("Missing --mcp <mcp-id>");
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout-ms: ${opts.timeoutMs}`);
  }
  if (!Number.isFinite(opts.heartbeatMs) || opts.heartbeatMs <= 0) {
    throw new Error(`Invalid --heartbeat-ms: ${opts.heartbeatMs}`);
  }

  return opts;
}

function getMcpDir(mcpId: string): string {
  return resolve(process.cwd(), "mcp", mcpId);
}

function getManifestPath(mcpId: string): string {
  return resolve(getMcpDir(mcpId), "manifest.json");
}

async function assertReadable(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function nextPatchVersion(version: string): string {
  const match = version.trim().match(SEMVER_PATTERN);
  if (!match) {
    return "0.1.0";
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
}

async function loadManifest(mcpId: string): Promise<McpManifest> {
  const manifestPath = getManifestPath(mcpId);

  try {
    const raw = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...parsed,
      schemaVersion:
        typeof parsed.schemaVersion === "string" && parsed.schemaVersion.trim() ? parsed.schemaVersion.trim() : "1.0",
      id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : mcpId,
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : typeof parsed.displayName === "string" && parsed.displayName.trim()
            ? parsed.displayName.trim()
            : mcpId,
      version: typeof parsed.version === "string" && parsed.version.trim() ? parsed.version.trim() : "0.0.0",
    };
  } catch {
    return {
      schemaVersion: "1.0",
      id: mcpId,
      name: mcpId,
      version: "0.0.0",
    };
  }
}

async function saveManifest(mcpId: string, manifest: McpManifest): Promise<void> {
  await writeFile(getManifestPath(mcpId), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

async function collectFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(nextPath);
      }
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => a.localeCompare(b));
}

function writeTarString(buffer: Buffer, value: string, offset: number, length: number): void {
  const content = Buffer.from(value, "utf-8");
  content.copy(buffer, offset, 0, Math.min(content.length, length));
}

function writeTarOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const octal = value.toString(8).padStart(length - 1, "0");
  writeTarString(buffer, `${octal}\0`, offset, length);
}

function createTarHeader(name: string, size: number, mode: number, mtime: number): Buffer {
  const header = Buffer.alloc(512, 0);
  writeTarString(header, name, 0, 100);
  writeTarOctal(header, mode, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, mtime, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarString(header, "ustar", 257, 6);
  writeTarString(header, "00", 263, 2);

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  const checksumValue = checksum.toString(8).padStart(6, "0");
  writeTarString(header, `${checksumValue}\0 `, 148, 8);

  return header;
}

async function createTgzPackage(mcpId: string, version: string): Promise<string> {
  const sourceDir = getMcpDir(mcpId);
  const outputDir = resolve(process.cwd(), "artifacts", "mcp", mcpId);
  await mkdir(outputDir, { recursive: true });
  const packagePath = resolve(outputDir, `${mcpId}-${version}.tgz`);
  const files = await collectFiles(sourceDir);
  const chunks: Buffer[] = [];

  for (const filePath of files) {
    const info = await stat(filePath);
    const content = Buffer.from(await readFile(filePath));
    const relativePath = filePath.slice(sourceDir.length + 1).replaceAll("\\", "/");
    const tarPath = `${mcpId}/${relativePath}`;
    chunks.push(createTarHeader(tarPath, content.length, 0o644, Math.floor(info.mtimeMs / 1000)));
    chunks.push(content);
    const remainder = content.length % 512;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  chunks.push(Buffer.alloc(1024, 0));
  const tarBuffer = Buffer.concat(chunks);
  await writeFile(packagePath, gzipSync(tarBuffer));
  return packagePath;
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
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${seconds}s`;
}

async function uploadMcpPackage(params: {
  filePath: string;
  mcpId: string;
  version: string;
  manifest: McpManifest;
  token: string;
  baseUrl: string;
  releaseChannel: ReleaseChannel;
  timeoutMs: number;
  heartbeatMs: number;
}): Promise<Record<string, unknown>> {
  const file = Bun.file(params.filePath);
  const form = new FormData();
  form.append("file", file, basename(params.filePath));
  form.append("mcpId", params.mcpId);
  form.append("version", params.version);
  form.append("channel", params.releaseChannel);
  form.append("manifest", JSON.stringify(params.manifest));

  const url = `${params.baseUrl}/api/upload/mcp?channel=${encodeURIComponent(params.releaseChannel)}`;
  const startedAt = Date.now();
  console.log(`[publish:mcp] uploading ${basename(params.filePath)} (${formatBytes(file.size)}) -> ${url}`);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);
  const heartbeatHandle = setInterval(() => {
    console.log(
      `[publish:mcp] uploading ${basename(params.filePath)}, elapsed ${formatDuration(Date.now() - startedAt)}...`
    );
  }, params.heartbeatMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "x-channel": params.releaseChannel,
      },
      body: form,
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok || data.ok !== true) {
      throw new Error(typeof data.error === "string" ? data.error : `HTTP ${response.status}`);
    }

    console.log(
      `[publish:mcp] upload complete ${basename(params.filePath)}, elapsed ${formatDuration(Date.now() - startedAt)}`
    );
    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Upload timeout after ${formatDuration(params.timeoutMs)}: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
    clearInterval(heartbeatHandle);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const mcpDir = getMcpDir(opts.mcpId);
  await assertReadable(mcpDir, "MCP directory");

  const manifest = await loadManifest(opts.mcpId);
  const version = opts.version?.trim() || nextPatchVersion(manifest.version);
  manifest.id = opts.mcpId;
  manifest.version = version;
  manifest.schemaVersion = manifest.schemaVersion || "1.0";
  manifest.name = manifest.name || opts.mcpId;
  if (opts.writeManifest) {
    await saveManifest(opts.mcpId, manifest);
  } else {
    console.log("[publish:mcp] --no-write-manifest enabled, manifest.json will not be modified.");
  }

  console.log(`[publish:mcp] mcp: ${opts.mcpId}`);
  console.log(`[publish:mcp] version: ${version}`);
  console.log(`[publish:mcp] channel: ${opts.releaseChannel}`);

  const zipPath = await createTgzPackage(opts.mcpId, version);
  await assertReadable(zipPath, "MCP package");

  const result = await uploadMcpPackage({
    filePath: zipPath,
    mcpId: opts.mcpId,
    version,
    manifest,
    token: opts.token,
    baseUrl: opts.baseUrl,
    releaseChannel: opts.releaseChannel,
    timeoutMs: opts.timeoutMs,
    heartbeatMs: opts.heartbeatMs,
  });

  console.log(
    `[publish:mcp] published ${opts.mcpId}@${version} -> ${String(result.url || `/downloads/mcp/${opts.mcpId}/latest`)}`
  );
}

main().catch((error) => {
  console.error(`[publish:mcp] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
