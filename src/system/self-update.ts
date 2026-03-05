import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmodSync, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VERSION } from "../app.constants";

const IS_WINDOWS = process.platform === "win32";
const IS_DARWIN = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";
const DEFAULT_MANIFEST_URL = "https://clawos.minapp.xin/api/releases/latest";
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
  sha256: string;
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
  launchAfterReplace: boolean;
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

function readNonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function currentPlatformAliases(): string[] {
  if (IS_WINDOWS) {
    return ["windows", "win32", "win"];
  }
  if (IS_DARWIN) {
    return ["darwin", "macos", "mac", "osx"];
  }
  if (IS_LINUX) {
    return ["linux"];
  }
  return [process.platform];
}

function pickPlatformDownloadUrl(links: Record<string, unknown>, manifestUrl: string): string | null {
  const aliases = currentPlatformAliases();
  const keys = aliases.flatMap((alias) => [`installer${alias[0].toUpperCase()}${alias.slice(1)}`, alias]);

  for (const key of keys) {
    const direct = readNonEmptyText(links[key]);
    if (direct) {
      return resolveManifestDownloadUrl(direct, manifestUrl);
    }
  }

  const installers =
    links.installers && typeof links.installers === "object" && !Array.isArray(links.installers)
      ? (links.installers as Record<string, unknown>)
      : null;
  if (installers) {
    for (const alias of aliases) {
      const nested = readNonEmptyText(installers[alias]);
      if (nested) {
        return resolveManifestDownloadUrl(nested, manifestUrl);
      }
    }
  }

  const latest = readNonEmptyText(links.installerLatest);
  if (latest) {
    return resolveManifestDownloadUrl(latest, manifestUrl);
  }

  return null;
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
  const resolvedLink = links ? pickPlatformDownloadUrl(links, manifestUrl) : null;
  if (releaseVersion && resolvedLink) {
    const resolved = resolvedLink;
    const parsed = new URL(resolved);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("更新地址仅支持 http/https。");
    }
    return { version: releaseVersion, force, url: resolved };
  }

  throw new Error("更新清单缺少可用下载地址（url 或 release.version + links.*）。");
}

function resolveSelfExecutablePath(): { path: string | null; reason: string | null } {
  const executablePath = process.execPath;
  const lowerName = path.basename(executablePath).toLowerCase();

  if (IS_WINDOWS && !lowerName.endsWith(".exe")) {
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

function normalizeSha256(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(normalized)) {
    return normalized;
  }
  return null;
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

  const targetName = path.basename(targetExecutablePath);
  const targetExt = path.extname(targetName);
  const tempName = `${targetName}.download-${Date.now()}${targetExt}`;
  const tempPath = path.join(targetDir, tempName);

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      accept: "application/octet-stream,application/x-msdownload,application/zip,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`下载更新文件失败（HTTP ${response.status}）。`);
  }

  if (!response.body) {
    throw new Error("下载更新文件失败：返回内容为空。");
  }

  const totalBytes = parseContentLength(response.headers.get("content-length"));
  const expectedSha256 =
    normalizeSha256(response.headers.get("x-file-sha256")) || normalizeSha256(response.headers.get("x-sha256"));
  const reader = response.body.getReader();
  const output = createWriteStream(tempPath, { flags: "w" });
  const digest = createHash("sha256");
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
      digest.update(value);
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
  const actualSha256 = digest.digest("hex");
  if (expectedSha256 && expectedSha256 !== actualSha256) {
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore cleanup failures
    }
    throw new Error(
      `下载文件校验失败（sha256 不匹配）。expected=${expectedSha256.slice(0, 12)}..., actual=${actualSha256.slice(0, 12)}...`
    );
  }
  notifyDownloadProgress(options, buildDownloadProgress(sizeBytes, totalBytes ?? sizeBytes));

  return {
    filePath: tempPath,
    sizeBytes,
    sha256: actualSha256,
  };
}

function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapePosixSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function writeWindowsReplacementScript(plan: ReplacementPlan, ownerPid: number): void {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$target = '${escapePowerShellLiteral(plan.targetPath)}'`,
    `$backup = '${escapePowerShellLiteral(plan.backupPath)}'`,
    `$incoming = '${escapePowerShellLiteral(plan.tempPath)}'`,
    `$scriptPath = '${escapePowerShellLiteral(plan.scriptPath)}'`,
    `$logPath = '${escapePowerShellLiteral(plan.logPath)}'`,
    `$launchAfterReplace = ${plan.launchAfterReplace ? "$true" : "$false"}`,
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
    "if ($replaced -and $launchAfterReplace) {",
    "  try {",
    "    Start-Process -FilePath $target -ErrorAction Stop | Out-Null",
    "    Write-UpdateLog 'Updated executable launched.'",
    "  } catch {",
    "    Write-UpdateLog (\"Launch updated executable failed: {0}\" -f $_.Exception.Message)",
    "  }",
    "}",
    "Write-UpdateLog 'Self-update script finished.'",
    "Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue",
    "exit 0",
    "",
  ].join("\r\n");

  writeFileSync(plan.scriptPath, script, "utf-8");
}

function writePosixReplacementScript(plan: ReplacementPlan, ownerPid: number): void {
  const target = escapePosixSingleQuoted(plan.targetPath);
  const backup = escapePosixSingleQuoted(plan.backupPath);
  const incoming = escapePosixSingleQuoted(plan.tempPath);
  const scriptPath = escapePosixSingleQuoted(plan.scriptPath);
  const logPath = escapePosixSingleQuoted(plan.logPath);
  const launchAfterReplace = plan.launchAfterReplace ? "1" : "0";

  const script = [
    "#!/bin/sh",
    "set -eu",
    `target='${target}'`,
    `backup='${backup}'`,
    `incoming='${incoming}'`,
    `script_path='${scriptPath}'`,
    `log_path='${logPath}'`,
    `launch_after_replace='${launchAfterReplace}'`,
    `owner_pid='${ownerPid}'`,
    "replaced=0",
    "log() {",
    "  if [ -n \"${log_path:-}\" ]; then",
    "    printf '[%s] %s\\n' \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\" \"$1\" >> \"$log_path\" 2>/dev/null || true",
    "  fi",
    "}",
    "log \"Self-update script started. incoming=$incoming target=$target\"",
    "i=0",
    "while [ \"$i\" -lt 240 ]; do",
    "  if kill -0 \"$owner_pid\" 2>/dev/null; then",
    "    i=$((i + 1))",
    "    sleep 1",
    "    continue",
    "  fi",
    "  if [ -f \"$backup\" ]; then rm -f \"$backup\" || true; fi",
    "  if [ -f \"$target\" ]; then mv \"$target\" \"$backup\" || true; fi",
    "  if [ ! -f \"$incoming\" ]; then",
    "    log 'incoming update file missing before replacement'",
    "    i=$((i + 1))",
    "    sleep 1",
    "    continue",
    "  fi",
    "  if mv \"$incoming\" \"$target\"; then",
    "    chmod +x \"$target\" 2>/dev/null || true",
    "    replaced=1",
    "    log \"Replacement succeeded on attempt $((i + 1)).\"",
    "    break",
    "  fi",
    "  log \"Replacement attempt $((i + 1)) failed.\"",
    "  if [ ! -f \"$target\" ] && [ -f \"$backup\" ]; then mv \"$backup\" \"$target\" || true; fi",
    "  i=$((i + 1))",
    "  sleep 1",
    "done",
    "if [ \"$replaced\" -eq 0 ]; then",
    "  log 'Self-update replacement failed after timeout.'",
    "fi",
    "if [ \"$replaced\" -eq 1 ] && [ \"$launch_after_replace\" = '1' ]; then",
    "  \"$target\" >/dev/null 2>&1 &",
    "  log 'Updated executable launched.'",
    "fi",
    "log 'Self-update script finished.'",
    "rm -f \"$script_path\" >/dev/null 2>&1 || true",
    "exit 0",
    "",
  ].join("\n");

  writeFileSync(plan.scriptPath, script, "utf-8");
  chmodSync(plan.scriptPath, 0o755);
}

export function scheduleSelfExecutableReplacement(
  tempExecutablePath: string,
  targetExecutablePath: string,
  ownerPid: number,
  options?: { launchAfterReplace?: boolean }
): ReplacementPlan {
  const normalizedTarget = path.resolve(targetExecutablePath);
  const normalizedTemp = path.resolve(tempExecutablePath);
  const backupPath = `${normalizedTarget}.old`;
  const stamp = Date.now();
  const scriptExt = IS_WINDOWS ? "ps1" : "sh";
  const scriptPath = path.join(tmpdir(), `clawos-self-update-${stamp}.${scriptExt}`);
  const logPath = path.join(tmpdir(), `clawos-self-update-${stamp}.log`);

  const plan: ReplacementPlan = {
    targetPath: normalizedTarget,
    backupPath,
    tempPath: normalizedTemp,
    scriptPath,
    logPath,
    launchAfterReplace: options?.launchAfterReplace === true,
  };

  if (IS_WINDOWS) {
    writeWindowsReplacementScript(plan, ownerPid);
  } else {
    writePosixReplacementScript(plan, ownerPid);
  }
  pendingReplacementPlan = plan;

  try {
    const child = IS_WINDOWS
      ? spawn(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", plan.scriptPath],
          {
            detached: true,
            stdio: "ignore",
          }
        )
      : spawn("sh", [plan.scriptPath], {
          detached: true,
          stdio: "ignore",
        });
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

export function scheduleWindowsExecutableReplacement(
  tempExecutablePath: string,
  targetExecutablePath: string,
  ownerPid: number,
  options?: { launchAfterReplace?: boolean }
): ReplacementPlan {
  return scheduleSelfExecutableReplacement(tempExecutablePath, targetExecutablePath, ownerPid, options);
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
