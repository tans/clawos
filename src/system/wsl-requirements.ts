import { runWslScript, type CommandResult } from "../tasks/shell";

export const REQUIRED_WSL_COMMANDS = ["openclaw", "git", "pnpm", "nrm"] as const;

const OK_PREFIX = "__CLAWOS_WSL_CMD_OK__";
const MISSING_PREFIX = "__CLAWOS_WSL_CMD_MISSING__";

export type WslCommandStatus = {
  command: string;
  exists: boolean;
  path?: string;
};

export type WslCommandCheckResult = {
  ok: boolean;
  commands: WslCommandStatus[];
  missing: string[];
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

type WslRunner = (script: string) => Promise<CommandResult>;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildWslCommandProbeScript(commands = Array.from(REQUIRED_WSL_COMMANDS)): string {
  const normalized = commands.map((item) => item.trim()).filter((item) => item.length > 0);
  const commandList = normalized.map((item) => shellQuote(item)).join(" ");
  return [
    "set +e",
    `for cmd in ${commandList}; do`,
    '  path="$(type -P "$cmd" 2>/dev/null | head -n 1)"',
    '  if [ -n "$path" ]; then',
    `    printf "${OK_PREFIX}:%s:%s\\n" "$cmd" "$path"`,
    "  else",
    `    printf "${MISSING_PREFIX}:%s\\n" "$cmd"`,
    "  fi",
    "done",
    "exit 0",
  ].join("\n");
}

function sanitizeProbeLine(rawLine: string): string {
  return rawLine
    .replace(/\u0000/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .trim();
}

function findProbeMarkerIndex(line: string, marker: string): number {
  const idx = line.indexOf(marker);
  return idx >= 0 ? idx : -1;
}

function countProbeSignals(stdout: string): number {
  let count = 0;
  for (const rawLine of stdout.split(/\r?\n/g)) {
    const line = sanitizeProbeLine(rawLine);
    if (!line) {
      continue;
    }
    if (findProbeMarkerIndex(line, `${OK_PREFIX}:`) >= 0 || findProbeMarkerIndex(line, `${MISSING_PREFIX}:`) >= 0) {
      count += 1;
    }
  }
  return count;
}

export function parseWslCommandProbeOutput(
  stdout: string,
  commands = Array.from(REQUIRED_WSL_COMMANDS)
): WslCommandStatus[] {
  const normalized = commands.map((item) => item.trim()).filter((item) => item.length > 0);
  const map = new Map<string, WslCommandStatus>(
    normalized.map((command) => [command, { command, exists: false }])
  );

  for (const rawLine of stdout.split(/\r?\n/g)) {
    const line = sanitizeProbeLine(rawLine);
    if (!line) {
      continue;
    }

    const okMarker = `${OK_PREFIX}:`;
    const okIndex = findProbeMarkerIndex(line, okMarker);
    if (okIndex >= 0) {
      const body = line.slice(okIndex + okMarker.length);
      const [command, ...pathParts] = body.split(":");
      if (!command || !map.has(command)) {
        continue;
      }
      const path = pathParts.join(":").trim();
      map.set(command, { command, exists: true, path: path || undefined });
      continue;
    }

    const missingMarker = `${MISSING_PREFIX}:`;
    const missingIndex = findProbeMarkerIndex(line, missingMarker);
    if (missingIndex >= 0) {
      const command = line.slice(missingIndex + missingMarker.length).trim();
      if (!command || !map.has(command)) {
        continue;
      }
      map.set(command, { command, exists: false });
    }
  }

  return normalized.map((command) => map.get(command) || { command, exists: false });
}

export async function checkWslCommandRequirements(
  commands = Array.from(REQUIRED_WSL_COMMANDS),
  runner: WslRunner = runWslScript
): Promise<WslCommandCheckResult> {
  const normalized = commands.map((item) => item.trim()).filter((item) => item.length > 0);
  const script = buildWslCommandProbeScript(normalized);
  const result = await runner(script);
  const signalCount = countProbeSignals(result.stdout);
  const hasProbeSignals = signalCount > 0;
  const commandStatuses = parseWslCommandProbeOutput(result.stdout, normalized);
  const missing = hasProbeSignals
    ? commandStatuses.filter((item) => !item.exists).map((item) => item.command)
    : result.ok
      ? []
      : normalized;
  const probeOutputIssue = result.ok && !hasProbeSignals;
  const extraProbeError = "WSL 命令探测输出异常：未收到探测标记行。";
  const stderr = probeOutputIssue
    ? [result.stderr.trim(), extraProbeError].filter((item) => item.length > 0).join("\n")
    : result.stderr;

  return {
    ok: result.ok && hasProbeSignals && missing.length === 0,
    commands: commandStatuses,
    missing,
    code: result.code,
    stdout: result.stdout,
    stderr,
    command: result.command,
  };
}
