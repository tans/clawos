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
  probeMethod: "simple-command-v" | "marker" | "exit-code-fallback";
  diagnostics: string[];
};

type WslRunner = (script: string) => Promise<CommandResult>;
type ExitCodeProbeResult =
  | {
      ok: true;
      statuses: WslCommandStatus[];
      diagnostics: string[];
      command: string;
    }
  | {
      ok: false;
      diagnostics: string[];
    };
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildSingleCommandExitCodeProbeScript(command: string): string {
  const quoted = shellQuote(command);
  return [
    "set +e",
    `path="$(type -P ${quoted} 2>/dev/null | head -n 1)"`,
    'if [ -z "$path" ]; then',
    `  path="$(command -v ${quoted} 2>/dev/null | head -n 1)"`,
    "fi",
    'if [ -n "$path" ]; then',
    '  printf "%s\\n" "$path"',
    "  exit 0",
    "fi",
    "exit 1",
  ].join("\n");
}

function buildSingleCommandVScript(command: string): string {
  const quoted = shellQuote(command);
  return `command -v ${quoted}`;
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

function sanitizeProbeStdoutLines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/g)
    .map((line) => sanitizeProbeLine(line))
    .filter((line) => line.length > 0 && !isBenignShellNoise(line));
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

async function probeCommandsByExitCode(commands: string[], runner: WslRunner): Promise<ExitCodeProbeResult> {
  const statuses: WslCommandStatus[] = [];
  const diagnostics: string[] = [];
  let sampleCommand = "";

  for (const command of commands) {
    const result = await runner(buildSingleCommandExitCodeProbeScript(command));
    if (!sampleCommand) {
      sampleCommand = result.command;
    }

    const stdoutLines = sanitizeProbeStdoutLines(result.stdout);
    const stderrText = sanitizeProbeStderr(result.stderr);
    const path = stdoutLines[0];

    if (result.code === 0 || result.code === 1) {
      const exists = result.code === 0;
      statuses.push({
        command,
        exists,
        path: exists ? path || undefined : undefined,
      });
      diagnostics.push(
        `${command}: ${exists ? "存在" : "缺失"}${exists && path ? ` (${path})` : ""} [exit=${result.code}]`
      );
      if (stderrText.length > 0) {
        diagnostics.push(`${command}: stderr=${stderrText}`);
      }
      continue;
    }

    diagnostics.push(
      `${command}: 逐命令检测执行异常（exit=${result.code}${stderrText ? `, stderr=${stderrText}` : ""}）。`
    );
    return {
      ok: false,
      diagnostics,
    };
  }

  return {
    ok: true,
    statuses,
    diagnostics,
    command: sampleCommand,
  };
}

type SimpleCommandVResult = {
  ok: boolean;
  commands: WslCommandStatus[];
  missing: string[];
  code: number;
  stdout: string;
  stderr: string;
  command: string;
  diagnostics: string[];
  unresolved: string[];
};

async function probeCommandsByCommandV(commands: string[]): Promise<SimpleCommandVResult> {
  const plans: Array<{ name: string; shellMode: "interactive" | "non-login" | "clean" }> = [
    { name: "-i -c", shellMode: "interactive" },
    { name: "-lc", shellMode: "non-login" },
    { name: "--noprofile --norc", shellMode: "clean" },
  ];

  const statuses: WslCommandStatus[] = [];
  const diagnostics: string[] = [];
  const unresolved: string[] = [];
  const stderrLines: string[] = [];
  let commandLine = "";
  let lastCode = 0;

  for (const command of commands) {
    const script = buildSingleCommandVScript(command);
    let resolved = false;

    for (const plan of plans) {
      const result = await runWslScript(script, { shellMode: plan.shellMode });
      if (!commandLine) {
        commandLine = result.command;
      }
      lastCode = result.code;

      const stdoutLines = sanitizeProbeStdoutLines(result.stdout);
      const stderrText = sanitizeProbeStderr(result.stderr);
      const path = stdoutLines[0];

      if (result.code === 0) {
        statuses.push({
          command,
          exists: true,
          path: path || undefined,
        });
        diagnostics.push(`${command}: 已就绪${path ? ` (${path})` : ""} [${plan.name}]`);
        resolved = true;
        break;
      }

      if (result.code === 1) {
        statuses.push({
          command,
          exists: false,
        });
        diagnostics.push(`${command}: 缺失 [${plan.name}]`);
        resolved = true;
        break;
      }

      const attemptError =
        `${command}: ${plan.name} 执行异常（exit=${result.code}` +
        `${stderrText ? `, stderr=${stderrText}` : ""}` +
        ")";
      diagnostics.push(attemptError);
      stderrLines.push(attemptError);
    }

    if (!resolved) {
      unresolved.push(command);
    }
  }

  const missing = statuses.filter((item) => !item.exists).map((item) => item.command);
  if (unresolved.length > 0) {
    diagnostics.push(`以下命令仍无法判定：${unresolved.join(", ")}`);
  }

  return {
    ok: unresolved.length === 0,
    commands: statuses,
    missing,
    code: unresolved.length === 0 ? 0 : lastCode || 1,
    stdout: "",
    stderr: stderrLines.join("\n"),
    command: commandLine,
    diagnostics,
    unresolved,
  };
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
  const probeOutputIssue =
    result.ok && (!hasProbeSignals || recognizedSignalCount !== commands.length);
  const parsedCommandStatuses = parseWslCommandProbeOutput(result.stdout, commands);
  const commandStatuses = probeOutputIssue
    ? []
    : hasProbeSignals
      ? parsedCommandStatuses
      : result.ok
        ? []
        : commands.map((command) => ({ command, exists: false } as WslCommandStatus));
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
  if (runner === runWslScript && !fallbackRunner) {
    const simple = await probeCommandsByCommandV(normalized);
    return {
      ok: simple.ok && simple.missing.length === 0,
      commands: simple.commands,
      missing: simple.missing,
      code: simple.code,
      stdout: simple.stdout,
      stderr: simple.stderr,
      command: simple.command,
      probeMethod: "simple-command-v",
      diagnostics: simple.diagnostics,
    };
  }

  const script = buildWslCommandProbeScript(normalized);
  const primaryResult = await runner(script);
  let selectedResult = primaryResult;
  let evaluation = evaluateProbeResult(primaryResult, normalized);
  let probeMethod: WslCommandCheckResult["probeMethod"] = "marker";
  const diagnostics: string[] = [];

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

  if (evaluation.probeOutputIssue && runner === runWslScript) {
    const exitCodeProbe = await probeCommandsByExitCode(
      normalized,
      (nextScript: string) => runWslScript(nextScript, { shellMode: "clean" })
    );
    if (exitCodeProbe.ok) {
      evaluation = {
        hasProbeSignals: true,
        recognizedSignalCount: normalized.length,
        commandStatuses: exitCodeProbe.statuses,
        missing: exitCodeProbe.statuses.filter((item) => !item.exists).map((item) => item.command),
        probeOutputIssue: false,
        stderr: "",
      };
      selectedResult = {
        ...selectedResult,
        ok: true,
        code: 0,
        command: exitCodeProbe.command || selectedResult.command,
      };
      probeMethod = "exit-code-fallback";
      diagnostics.push("标记探测异常，已回退到逐命令退出码检测。");
      diagnostics.push(...exitCodeProbe.diagnostics);
    } else {
      diagnostics.push(...exitCodeProbe.diagnostics);
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
    probeMethod,
    diagnostics,
  };
}
