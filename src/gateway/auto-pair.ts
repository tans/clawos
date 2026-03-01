import { runWslScript } from "../tasks/shell";
import type { GatewayConnectionSettings } from "./schema";

type AutoPairResult = {
  ok: boolean;
  skipped?: boolean;
  summary: string;
  stderr?: string;
  stdout?: string;
  command?: string;
};

const AUTO_PAIR_COOLDOWN_MS = 15_000;
let lastAttemptAtMs = 0;
let inFlight: Promise<AutoPairResult> | null = null;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function isNotPairedMessage(rawMessage: string): boolean {
  const text = rawMessage.toLowerCase();
  return text.includes("not_paired") || text.includes("pairing required");
}

function buildAutoPairScript(settings: GatewayConnectionSettings): string {
  const hasExplicitRemoteAuth = !!settings.url && (!!settings.token || !!settings.password);
  const pairUrl = hasExplicitRemoteAuth ? settings.url : "";
  const pairToken = hasExplicitRemoteAuth ? settings.token || "" : "";
  const pairPassword = hasExplicitRemoteAuth ? settings.password || "" : "";

  const urlLine = `PAIR_URL=${shellQuote(pairUrl)}`;
  const tokenLine = `PAIR_TOKEN=${shellQuote(pairToken)}`;
  const passwordLine = `PAIR_PASSWORD=${shellQuote(pairPassword)}`;

  return [
    "set -euo pipefail",
    urlLine,
    tokenLine,
    passwordLine,
    "run_openclaw() {",
    "  if type -P openclaw >/dev/null 2>&1; then",
    '    openclaw "$@"',
    "    return $?",
    "  fi",
    "  if [ -d /data/openclaw ] && type -P pnpm >/dev/null 2>&1; then",
    "    (cd /data/openclaw && pnpm exec openclaw \"$@\")",
    "    return $?",
    "  fi",
    "  return 127",
    "}",
    "EXTRA_ARGS=()",
    'if [ -n "$PAIR_URL" ]; then',
    '  EXTRA_ARGS+=(--url "$PAIR_URL")',
    "  if [ -n \"$PAIR_TOKEN\" ]; then EXTRA_ARGS+=(--token \"$PAIR_TOKEN\"); fi",
    "  if [ -n \"$PAIR_PASSWORD\" ]; then EXTRA_ARGS+=(--password \"$PAIR_PASSWORD\"); fi",
    "fi",
    "set +e",
    'run_openclaw devices approve --latest "${EXTRA_ARGS[@]}"',
    "code_latest=$?",
    'if [ "$code_latest" -eq 0 ]; then',
    '  echo "__CLAWOS_AUTO_PAIR_OK__:approve-latest"',
    "  exit 0",
    "fi",
    'run_openclaw devices approve "${EXTRA_ARGS[@]}"',
    "code_default=$?",
    'if [ "$code_default" -eq 0 ]; then',
    '  echo "__CLAWOS_AUTO_PAIR_OK__:approve-default"',
    "  exit 0",
    "fi",
    'echo "__CLAWOS_AUTO_PAIR_FAIL__:latest=${code_latest},default=${code_default}" >&2',
    "exit 1",
  ].join("\n");
}

async function runAutoPair(settings: GatewayConnectionSettings): Promise<AutoPairResult> {
  const result = await runWslScript(buildAutoPairScript(settings));
  const merged = `${result.stdout}\n${result.stderr}`.toLowerCase();

  if (result.ok || merged.includes("__clawos_auto_pair_ok__")) {
    return {
      ok: true,
      summary: "检测到未配对，已自动执行设备批准并重试连接。",
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  if (result.code === 127 || merged.includes("command not found")) {
    return {
      ok: false,
      summary: "自动配对失败：WSL 中未找到 openclaw 命令。",
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  if (merged.includes("no pending") || merged.includes("not found")) {
    return {
      ok: false,
      summary: "自动配对失败：未找到可批准的待配对请求。",
      command: result.command,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    ok: false,
    summary: "自动配对失败：openclaw devices approve 执行异常。",
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function tryAutoPairWhenNotPaired(
  rawMessage: string,
  settings: GatewayConnectionSettings
): Promise<AutoPairResult> {
  if (!isNotPairedMessage(rawMessage)) {
    return { ok: false, skipped: true, summary: "错误不是 NOT_PAIRED，跳过自动配对。" };
  }

  const now = Date.now();
  if (now - lastAttemptAtMs < AUTO_PAIR_COOLDOWN_MS) {
    return {
      ok: false,
      skipped: true,
      summary: `自动配对冷却中，请等待 ${Math.ceil((AUTO_PAIR_COOLDOWN_MS - (now - lastAttemptAtMs)) / 1000)} 秒后重试。`,
    };
  }

  if (inFlight) {
    return await inFlight;
  }

  lastAttemptAtMs = now;
  inFlight = runAutoPair(settings).finally(() => {
    inFlight = null;
  });
  return await inFlight;
}
