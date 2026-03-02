import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VERSION } from "../app.constants";

const IS_WINDOWS = process.platform === "win32";
const DEFAULT_MANIFEST_URL = "https://clawos.minapp.xin/downloads/clawos_xiake.json";
const MANIFEST_TIMEOUT_MS = 10_000;
const MANIFEST_CACHE_TTL_MS = 60_000;

type UpdateManifest = {
  version: string;
  force: boolean;
  url: string;
};

class UpdateManifestNotFoundError extends Error {}

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

export type DownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

type DownloadUpdateOptions = {
  onProgress?: (progress: DownloadProgress) => void;
};

export type ReplacementPlan = {
  targetPath: string;
  backupPath: string;
  tempPath: string;
  scriptPath: string;
  logPath: string;
};

let cachedStatus: { expiresAt: number; value: SelfUpdateStatus } | null = null;
let pendingReplacementPlan: ReplacementPlan | null = null;

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

function resolveManifestDownloadUrl(raw: string, manifestUrl: string): string {
  try {
    return new URL(raw, manifestUrl).toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`更新清单中的 url 不合法：${message}`);
  }
}

function validateManifest(raw: unknown, manifestUrl: string): UpdateManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("更新清单格式错误：必须是对象。");
  }

  const obj = raw as Record<string, unknown>;
  const force = typeof obj.force === "boolean" ? obj.force : false;

  const legacyVersion = typeof obj.version === "string" ? obj.version.trim() : "";
  const legacyUrl = typeof obj.url === "string" ? obj.url.trim() : "";
  if (legacyVersion && legacyUrl) {
    const resolved = resolveManifestDownloadUrl(legacyUrl, manifestUrl);
    const parsed = new URL(resolved);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("更新地址仅支持 http/https。");
    }
    return { version: legacyVersion, force, url: resolved };
  }

  const release = obj.release && typeof obj.release === "object" && !Array.isArray(obj.release)
    ? (obj.release as Record<string, unknown>)
    : null;
  const links = obj.links && typeof obj.links === "object" && !Array.isArray(obj.links)
    ? (obj.links as Record<string, unknown>)
    : null;
  const releaseVersion = typeof release?.version === "string" ? release.version.trim() : "";
  const installerLatest = typeof links?.installerLatest === "string" ? links.installerLatest.trim() : "";
  if (releaseVersion && installerLatest) {
    const resolved = resolveManifestDownloadUrl(installerLatest, manifestUrl);
    const parsed = new URL(resolved);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("更新地址仅支持 http/https。");
    }
    return { version: releaseVersion, force, url: resolved };
  }

  throw new Error("更新清单缺少 version/url（或 release.version + links.installerLatest）。");
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
      if (response.status === 404) {
        throw new UpdateManifestNotFoundError("暂无发布版本。");
      }

      let bodyMessage = "";
      try {
        const body = await response.json();
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const errorText = (body as Record<string, unknown>).error;
          if (typeof errorText === "string" && errorText.trim()) {
            bodyMessage = `：${errorText.trim()}`;
          }
        }
      } catch {
        // ignore non-json body
      }

      throw new Error(`拉取更新清单失败（HTTP ${response.status}）${bodyMessage}`);
    }

    const payload = await response.json().catch(() => {
      throw new Error("更新清单不是合法 JSON。");
    });

    return validateManifest(payload, manifestUrl);
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
    if (error instanceof UpdateManifestNotFoundError) {
      const status: SelfUpdateStatus = {
        ...base,
        checkedAt: new Date().toISOString(),
        error: null,
      };
      cachedStatus = { expiresAt: now + 30_000, value: status };
      return status;
    }

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

function parseContentLength(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function notifyDownloadProgress(options: DownloadUpdateOptions | undefined, progress: DownloadProgress): void {
  if (!options?.onProgress) {
    return;
  }

  try {
    options.onProgress(progress);
  } catch {
    // ignore callback failures to avoid interrupting download
  }
}

function buildDownloadProgress(receivedBytes: number, totalBytes: number | null): DownloadProgress {
  if (!totalBytes || totalBytes <= 0) {
    return {
      receivedBytes,
      totalBytes: null,
      percent: null,
    };
  }

  const ratio = receivedBytes / totalBytes;
  const percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
  return {
    receivedBytes,
    totalBytes,
    percent,
  };
}

export async function downloadUpdateExecutable(
  downloadUrl: string,
  targetExecutablePath: string,
  options?: DownloadUpdateOptions
): Promise<DownloadedUpdate> {
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

  if (!response.body) {
    throw new Error("下载更新文件失败：返回内容为空。");
  }

  const totalBytes = parseContentLength(response.headers.get("content-length"));
  const reader = response.body.getReader();
  const output = createWriteStream(tempPath, { flags: "w" });
  let receivedBytes = 0;

  notifyDownloadProgress(options, buildDownloadProgress(0, totalBytes));

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value || value.byteLength === 0) {
        continue;
      }

      receivedBytes += value.byteLength;
      if (!output.write(Buffer.from(value))) {
        await once(output, "drain");
      }
      notifyDownloadProgress(options, buildDownloadProgress(receivedBytes, totalBytes));
    }

    output.end();
    await new Promise<void>((resolve, reject) => {
      output.once("finish", () => resolve());
      output.once("error", (err) => reject(err));
    });
  } catch (error) {
    output.destroy();
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`下载更新文件失败：${message}`);
  } finally {
    reader.releaseLock();
  }

  const sizeBytes = ensureDownloadedFile(tempPath);
  notifyDownloadProgress(options, buildDownloadProgress(sizeBytes, totalBytes ?? sizeBytes));

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
    "$ErrorActionPreference = 'Stop'",
    `$target = '${escapePowerShellLiteral(plan.targetPath)}'`,
    `$backup = '${escapePowerShellLiteral(plan.backupPath)}'`,
    `$incoming = '${escapePowerShellLiteral(plan.tempPath)}'`,
    `$scriptPath = '${escapePowerShellLiteral(plan.scriptPath)}'`,
    `$logPath = '${escapePowerShellLiteral(plan.logPath)}'`,
    `$ownerPid = ${ownerPid}`,
    "$replaced = $false",
    "$incomingSize = 0",
    "if (Test-Path -LiteralPath $incoming) {",
    "  $incomingSize = (Get-Item -LiteralPath $incoming).Length",
    "}",
    "function Write-UpdateLog([string]$message) {",
    "  try {",
    "    Add-Content -LiteralPath $logPath -Value (\"[{0}] {1}\" -f (Get-Date -Format o), $message) -Encoding UTF8",
    "  } catch {",
    "    # ignore logging failures",
    "  }",
    "}",
    "Write-UpdateLog (\"Self-update script started. incoming={0}; target={1}\" -f $incoming, $target)",
    "for ($i = 0; $i -lt 240; $i++) {",
    "  $owner = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue",
    "  if ($owner) {",
    "    Start-Sleep -Milliseconds 500",
    "    continue",
    "  }",
    "  try {",
    "    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force -ErrorAction Stop }",
    "    if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup -Force -ErrorAction Stop }",
    "    if (-not (Test-Path -LiteralPath $incoming)) {",
    "      throw 'incoming update file missing before replacement'",
    "    }",
    "    Move-Item -LiteralPath $incoming -Destination $target -Force -ErrorAction Stop",
    "    if (Test-Path -LiteralPath $incoming) {",
    "      throw 'incoming update file still exists after move'",
    "    }",
    "    if (-not (Test-Path -LiteralPath $target)) {",
    "      throw 'target executable missing after replacement'",
    "    }",
    "    $targetSize = (Get-Item -LiteralPath $target).Length",
    "    if ($incomingSize -gt 0 -and $targetSize -lt $incomingSize) {",
    "      throw ('target executable size mismatch after replacement: target=' + $targetSize + ', incoming=' + $incomingSize)",
    "    }",
    "    $replaced = $true",
    "    Write-UpdateLog (\"Replacement succeeded on attempt {0}. targetSize={1}\" -f ($i + 1), $targetSize)",
    "    break",
    "  } catch {",
    "    Write-UpdateLog (\"Replacement attempt {0} failed: {1}\" -f ($i + 1), $_.Exception.Message)",
    "    if (-not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $backup)) {",
    "      Move-Item -LiteralPath $backup -Destination $target -Force -ErrorAction SilentlyContinue",
    "    }",
    "    Start-Sleep -Milliseconds 500",
    "  }",
    "}",
    "if (-not $replaced -and (Test-Path -LiteralPath $incoming)) {",
    "  Write-UpdateLog (\"Replacement did not complete. Incoming file kept: {0}\" -f $incoming)",
    "}",
    "if (-not $replaced) {",
    "  Write-UpdateLog 'Self-update replacement failed after timeout.'",
    "}",
    "Write-UpdateLog 'Self-update script finished.'",
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
  const stamp = Date.now();
  const scriptPath = path.join(tmpdir(), `clawos-self-update-${stamp}.ps1`);
  const logPath = path.join(tmpdir(), `clawos-self-update-${stamp}.log`);

  const plan: ReplacementPlan = {
    targetPath: normalizedTarget,
    backupPath,
    tempPath: normalizedTemp,
    scriptPath,
    logPath,
  };

  writeReplacementScript(plan, ownerPid);
  pendingReplacementPlan = plan;

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

export function getPendingReplacementPlan(): ReplacementPlan | null {
  if (!pendingReplacementPlan) {
    return null;
  }
  if (!existsSync(pendingReplacementPlan.tempPath)) {
    pendingReplacementPlan = null;
    return null;
  }
  return pendingReplacementPlan;
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

export function restartClawosProcess(): void {
  const resolved = resolveSelfExecutablePath();
  if (!resolved.path) {
    throw new Error(resolved.reason || "当前环境不支持重启。");
  }

  try {
    const child = spawn(resolved.path, process.argv.slice(1), {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`启动新进程失败：${message}`);
  }
}
