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
type ProbeEvaluation = {
  hasProbeSignals: boolean;
  recognizedSignalCount: number;
  commandStatuses: WslCommandStatus[];
  missing: string[];
  probeOutputIssue: boolean;
  stderr: string;
};

export function buildWslCommandProbeScript(commands = Array.from(REQUIRED_WSL_COMMANDS)): string {
  const normalized = commands.map((item) => item.trim()).filter((item) => item.length > 0);
  const commandLines = normalized.join("\n");
  return [
    "set +e",
    "while IFS= read -r cmd; do",
    '  [ -z "$cmd" ] && continue',
    '  path="$(type -P "$cmd" 2>/dev/null | head -n 1)"',
    '  if [ -n "$path" ]; then',
    `    printf "${OK_PREFIX}:%s:%s\\n" "$cmd" "$path"`,
    "  else",
    `    printf "${MISSING_PREFIX}:%s\\n" "$cmd"`,
    "  fi",
    "done <<'__CLAWOS_WSL_CMD_LIST__'",
    commandLines,
    "__CLAWOS_WSL_CMD_LIST__",
    "exit 0",
  ].join("\n");
}

function outputPreview(text: string, maxLines = 3): string {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => sanitizeProbeLine(line))
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "空";
  }
  const preview = lines.slice(0, maxLines).join(" | ");
  return lines.length > maxLines ? `${preview} | ...` : preview;
}

function isBenignShellNoise(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return normalized === "logout";
}

function sanitizeProbeStderr(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/g)
    .map((line) => sanitizeProbeLine(line))
    .filter((line) => line.length > 0 && !isBenignShellNoise(line));
  return lines.join("\n");
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

function countRecognizedProbeSignals(stdout: string, commands: string[]): number {
  const known = new Set(commands);
  let count = 0;

  for (const rawLine of stdout.split(/\r?\n/g)) {
    const line = sanitizeProbeLine(rawLine);
    if (!line) {
      continue;
    }

    const okMarker = `${OK_PREFIX}:`;
    const okIndex = findProbeMarkerIndex(line, okMarker);
    if (okIndex >= 0) {
      const body = line.slice(okIndex + okMarker.length);
      const [command] = body.split(":");
      if (command && known.has(command.trim())) {
        count += 1;
      }
      continue;
    }

    const missingMarker = `${MISSING_PREFIX}:`;
    const missingIndex = findProbeMarkerIndex(line, missingMarker);
    if (missingIndex >= 0) {
      const command = line.slice(missingIndex + missingMarker.length).trim();
      if (command && known.has(command)) {
        count += 1;
      }
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

function evaluateProbeResult(result: CommandResult, commands: string[]): ProbeEvaluation {
  const signalCount = countProbeSignals(result.stdout);
  const recognizedSignalCount = countRecognizedProbeSignals(result.stdout, commands);
  const hasProbeSignals = signalCount > 0;
  const commandStatuses = parseWslCommandProbeOutput(result.stdout, commands);
  const probeOutputIssue =
    result.ok && (!hasProbeSignals || recognizedSignalCount !== commands.length);
  const missing = probeOutputIssue
    ? []
    : hasProbeSignals
      ? commandStatuses.filter((item) => !item.exists).map((item) => item.command)
      : result.ok
        ? []
        : commands;
  const extraProbeError =
    !hasProbeSignals
      ? `WSL 命令探测输出异常：未收到探测标记行（stdout预览：${outputPreview(result.stdout)}）。`
      : `WSL 命令探测输出异常：探测标记不完整或命令名缺失（期望 ${commands.length} 行，识别到 ${recognizedSignalCount} 行）。`;
  const normalizedStderr = sanitizeProbeStderr(result.stderr);
  const stderr = probeOutputIssue
    ? [normalizedStderr, extraProbeError].filter((item) => item.length > 0).join("\n")
    : result.stderr;

  return {
    hasProbeSignals,
    recognizedSignalCount,
    commandStatuses,
    missing,
    probeOutputIssue,
    stderr,
  };
}

export async function checkWslCommandRequirements(
  commands = Array.from(REQUIRED_WSL_COMMANDS),
  runner: WslRunner = runWslScript,
  fallbackRunner?: WslRunner
): Promise<WslCommandCheckResult> {
  const normalized = commands.map((item) => item.trim()).filter((item) => item.length > 0);
  const script = buildWslCommandProbeScript(normalized);
  const primaryResult = await runner(script);
  let selectedResult = primaryResult;
  let evaluation = evaluateProbeResult(primaryResult, normalized);

  if (evaluation.probeOutputIssue) {
    const fallbackPlans: Array<{ name: string; runner: WslRunner }> = [];
    if (fallbackRunner) {
      fallbackPlans.push({ name: "回退(-lc)", runner: fallbackRunner });
    } else if (runner === runWslScript) {
      fallbackPlans.push({
        name: "回退(-lc)",
        runner: (nextScript: string) => runWslScript(nextScript, { shellMode: "non-login" }),
      });
      fallbackPlans.push({
        name: "回退(--noprofile --norc)",
        runner: (nextScript: string) => runWslScript(nextScript, { shellMode: "clean" }),
      });
    }

    const fallbackErrors: string[] = [];

    for (const fallback of fallbackPlans) {
      const fallbackResult = await fallback.runner(script);
      const fallbackEvaluation = evaluateProbeResult(fallbackResult, normalized);
      if (fallbackEvaluation.hasProbeSignals && !fallbackEvaluation.probeOutputIssue) {
        selectedResult = fallbackResult;
        evaluation = fallbackEvaluation;
        fallbackErrors.length = 0;
        break;
      }

      fallbackErrors.push(
        [`${fallback.name}仍异常。`, fallbackEvaluation.stderr.trim()]
          .filter((item) => item.length > 0)
          .join("\n")
      );
    }

    if (evaluation.probeOutputIssue && fallbackErrors.length > 0) {
      evaluation = {
        ...evaluation,
        stderr: [evaluation.stderr.trim(), ...fallbackErrors]
          .filter((item) => item.length > 0)
          .join("\n"),
      };
    }
  }

  return {
    ok:
      selectedResult.ok &&
      evaluation.hasProbeSignals &&
      !evaluation.probeOutputIssue &&
      evaluation.missing.length === 0,
    commands: evaluation.commandStatuses,
    missing: evaluation.missing,
    code: selectedResult.code,
    stdout: selectedResult.stdout,
    stderr: evaluation.stderr,
    command: selectedResult.command,
  };
}
