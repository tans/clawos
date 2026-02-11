import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VERSION } from "../app.constants";

const IS_WINDOWS = process.platform === "win32";
const DEFAULT_MANIFEST_URL = "https://minapp.xin/clawos_xiake.json";
const MANIFEST_TIMEOUT_MS = 10_000;
const MANIFEST_CACHE_TTL_MS = 60_000;

type UpdateManifest = {
  version: string;
  force: boolean;
  url: string;
};

export type SelfUpdateStatus = {
  supported: boolean;
  reason: string | null;
  manifestUrl: string;
  currentVersion: string;
  remoteVersion: string | null;
  force: boolean;
  downloadUrl: string | null;
  hasUpdate: boolean;
  checkedAt: string;
  error: string | null;
};

export type DownloadedUpdate = {
  filePath: string;
  sizeBytes: number;
};

export type ReplacementPlan = {
  targetPath: string;
  backupPath: string;
  tempPath: string;
  scriptPath: string;
};

let cachedStatus: { expiresAt: number; value: SelfUpdateStatus } | null = null;

function resolveManifestUrl(): string {
  const fromEnv = process.env.CLAWOS_UPDATE_MANIFEST_URL?.trim();
  return fromEnv || DEFAULT_MANIFEST_URL;
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "");
}

function versionParts(value: string): number[] | null {
  const normalized = normalizeVersion(value);
  if (!/^\d+(\.\d+)*$/.test(normalized)) {
    return null;
  }
  return normalized.split(".").map((part) => Number.parseInt(part, 10));
}

function isVersionDifferent(a: string, b: string): boolean {
  const aParts = versionParts(a);
  const bParts = versionParts(b);

  if (!aParts || !bParts) {
    return normalizeVersion(a) !== normalizeVersion(b);
  }

  const maxLength = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = aParts[index] ?? 0;
    const right = bParts[index] ?? 0;
    if (left !== right) {
      return true;
    }
  }

  return false;
}

function validateManifest(raw: unknown): UpdateManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("更新清单格式错误：必须是对象。");
  }

  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === "string" ? obj.version.trim() : "";
  const force = typeof obj.force === "boolean" ? obj.force : false;
  const url = typeof obj.url === "string" ? obj.url.trim() : "";

  if (!version) {
    throw new Error("更新清单缺少 version。");
  }
  if (!url) {
    throw new Error("更新清单缺少 url。");
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("更新地址仅支持 http/https。");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`更新清单中的 url 不合法：${message}`);
  }

  return { version, force, url };
}

function resolveSelfExecutablePath(): { path: string | null; reason: string | null } {
  if (!IS_WINDOWS) {
    return { path: null, reason: "当前系统不是 Windows，无法执行自更新。" };
  }

  const executablePath = process.execPath;
  const lowerName = path.basename(executablePath).toLowerCase();

  if (!lowerName.endsWith(".exe")) {
    return { path: null, reason: "当前进程不是 .exe 可执行文件，无法执行自更新。" };
  }

  if (!lowerName.includes("clawos") && process.env.CLAWOS_ALLOW_ANY_EXE_UPDATE !== "1") {
    return { path: null, reason: "当前不是 ClawOS 可执行文件，已阻止更新。" };
  }

  return { path: executablePath, reason: null };
}

async function fetchManifest(): Promise<UpdateManifest> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), MANIFEST_TIMEOUT_MS);
  const manifestUrl = resolveManifestUrl();

  try {
    const response = await fetch(manifestUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`拉取更新清单失败（HTTP ${response.status}）。`);
    }

    const payload = await response.json().catch(() => {
      throw new Error("更新清单不是合法 JSON。");
    });

    return validateManifest(payload);
  } finally {
    clearTimeout(timeout);
  }
}

function buildStatusBase(): SelfUpdateStatus {
  return {
    supported: true,
    reason: null,
    manifestUrl: resolveManifestUrl(),
    currentVersion: VERSION,
    remoteVersion: null,
    force: false,
    downloadUrl: null,
    hasUpdate: false,
    checkedAt: new Date().toISOString(),
    error: null,
  };
}

export async function getSelfUpdateStatus(refresh = false): Promise<SelfUpdateStatus> {
  const now = Date.now();
  if (!refresh && cachedStatus && now < cachedStatus.expiresAt) {
    return cachedStatus.value;
  }

  const base = buildStatusBase();
  const executable = resolveSelfExecutablePath();
  if (!executable.path) {
    const status: SelfUpdateStatus = {
      ...base,
      supported: false,
      reason: executable.reason,
      checkedAt: new Date().toISOString(),
    };
    cachedStatus = { expiresAt: now + MANIFEST_CACHE_TTL_MS, value: status };
    return status;
  }

  try {
    const manifest = await fetchManifest();
    const status: SelfUpdateStatus = {
      ...base,
      remoteVersion: manifest.version,
      force: manifest.force,
      downloadUrl: manifest.url,
      hasUpdate: isVersionDifferent(VERSION, manifest.version),
      checkedAt: new Date().toISOString(),
      error: null,
    };

    cachedStatus = { expiresAt: now + MANIFEST_CACHE_TTL_MS, value: status };
    return status;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: SelfUpdateStatus = {
      ...base,
      checkedAt: new Date().toISOString(),
      error: message,
    };

    cachedStatus = { expiresAt: now + 10_000, value: status };
    return status;
  }
}

function ensureDirExists(dirPath: string): void {
  if (existsSync(dirPath)) {
    return;
  }
  mkdirSync(dirPath, { recursive: true });
}

function ensureDownloadedFile(filePath: string): number {
  if (!existsSync(filePath)) {
    throw new Error("更新文件不存在。");
  }

  const stat = statSync(filePath);
  if (!stat.isFile() || stat.size <= 0) {
    throw new Error("更新文件无效：文件为空或不可读。");
  }

  return stat.size;
}

export async function downloadUpdateExecutable(downloadUrl: string, targetExecutablePath: string): Promise<DownloadedUpdate> {
  const targetDir = path.dirname(targetExecutablePath);
  ensureDirExists(targetDir);

  const tempName = `${path.basename(targetExecutablePath)}.download-${Date.now()}.exe`;
  const tempPath = path.join(targetDir, tempName);

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      accept: "application/octet-stream,application/x-msdownload,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`下载更新文件失败（HTTP ${response.status}）。`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("下载更新文件失败：返回内容为空。");
  }

  writeFileSync(tempPath, buffer);
  const sizeBytes = ensureDownloadedFile(tempPath);

  return {
    filePath: tempPath,
    sizeBytes,
  };
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function writeReplacementScript(plan: ReplacementPlan, ownerPid: number): void {
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$target = '${escapePowerShellLiteral(plan.targetPath)}'`,
    `$backup = '${escapePowerShellLiteral(plan.backupPath)}'`,
    `$incoming = '${escapePowerShellLiteral(plan.tempPath)}'`,
    `$scriptPath = '${escapePowerShellLiteral(plan.scriptPath)}'`,
    `$ownerPid = ${ownerPid}`,
    "$updated = $false",
    "for ($i = 0; $i -lt 240; $i++) {",
    "  $owner = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue",
    "  if (-not $owner) {",
    "    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue }",
    "    if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup -Force -ErrorAction SilentlyContinue }",
    "    if (Test-Path -LiteralPath $incoming) {",
    "      Move-Item -LiteralPath $incoming -Destination $target -Force -ErrorAction SilentlyContinue",
    "      if (Test-Path -LiteralPath $target) {",
    "        Start-Process -FilePath $target | Out-Null",
    "        $updated = $true",
    "      }",
    "    }",
    "    break",
    "  }",
    "  Start-Sleep -Milliseconds 500",
    "}",
    "if (-not $updated -and (Test-Path -LiteralPath $incoming)) {",
    "  # 下载文件保留在原目录，方便人工处理",
    "}",
    "Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue",
    "exit 0",
    "",
  ].join("\r\n");

  writeFileSync(plan.scriptPath, script, "utf-8");
}

export function scheduleWindowsExecutableReplacement(
  tempExecutablePath: string,
  targetExecutablePath: string,
  ownerPid: number
): ReplacementPlan {
  if (!IS_WINDOWS) {
    throw new Error("当前系统不是 Windows，无法执行自更新。");
  }

  const normalizedTarget = path.resolve(targetExecutablePath);
  const normalizedTemp = path.resolve(tempExecutablePath);
  const backupPath = `${normalizedTarget}.old`;
  const scriptPath = path.join(tmpdir(), `clawos-self-update-${Date.now()}.ps1`);

  const plan: ReplacementPlan = {
    targetPath: normalizedTarget,
    backupPath,
    tempPath: normalizedTemp,
    scriptPath,
  };

  writeReplacementScript(plan, ownerPid);

  try {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", plan.scriptPath],
      {
        detached: true,
        stdio: "ignore",
      }
    );
    child.unref();
  } catch (error) {
    try {
      unlinkSync(plan.scriptPath);
    } catch {
      // ignore
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`启动更新脚本失败：${message}`);
  }

  return plan;
}

export function resolveSelfExecutableOrThrow(): string {
  const resolved = resolveSelfExecutablePath();
  if (!resolved.path) {
    throw new Error(resolved.reason || "当前环境不支持自更新。");
  }
  return resolved.path;
}

export function clearSelfUpdateStatusCache(): void {
  cachedStatus = null;
}
