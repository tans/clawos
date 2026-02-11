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
    '  path="$(command -v "$cmd" 2>/dev/null | head -n 1)"',
    '  if [ -n "$path" ]; then',
    `    echo "${OK_PREFIX}:$cmd:$path"`,
    "  else",
    `    echo "${MISSING_PREFIX}:$cmd"`,
    "  fi",
    "done",
    "exit 0",
  ].join("\n");
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
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith(`${OK_PREFIX}:`)) {
      const body = line.slice(`${OK_PREFIX}:`.length);
      const [command, ...pathParts] = body.split(":");
      if (!command || !map.has(command)) {
        continue;
      }
      const path = pathParts.join(":").trim();
      map.set(command, { command, exists: true, path: path || undefined });
      continue;
    }

    if (line.startsWith(`${MISSING_PREFIX}:`)) {
      const command = line.slice(`${MISSING_PREFIX}:`.length).trim();
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
  const script = buildWslCommandProbeScript(commands);
  const result = await runner(script);
  const commandStatuses = parseWslCommandProbeOutput(result.stdout, commands);
  const missing = commandStatuses.filter((item) => !item.exists).map((item) => item.command);

  return {
    ok: result.ok && missing.length === 0,
    commands: commandStatuses,
    missing,
    code: result.code,
    stderr: result.stderr,
    command: result.command,
  };
}
