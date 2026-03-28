# ClawOS Cross-Platform Runtime Adaptation Design

Date: 2026-03-29
Status: Approved for planning
Scope: Cross-platform runtime adaptation layer for local desktop execution

## 1. Background

ClawOS is already a desktop application and already contains:

- local desktop bootstrapping and task execution paths
- `windows-mcp` packaging and lifecycle-related code
- a cloud remote-control protocol where the device executes commands locally and reports results back over HTTP polling

The current codebase already has partial runtime adaptation logic, but it is fragmented:

- `app/server/tasks/shell.ts` contains process execution, WSL invocation, timeout handling, and output decoding
- `app/server/system/platform-adapter.ts` contains shell argument construction
- `app/server/system/openclaw-execution.ts` only detects the OpenClaw execution mode
- multiple task modules still call `powershell.exe` or `runWslScript()` directly

This design defines a first-version runtime adaptation layer that unifies local short-command execution and runtime probing without absorbing higher-level product policy.

## 2. Decisions Already Confirmed

The design is based on the following confirmed product decisions:

- Windows strategy: PowerShell is the default path, WSL is optional
- Reuse scope: local-first, but interfaces should reserve room for remote reuse later
- First-version responsibility: short command execution and environment probing only
- Target selection: the caller explicitly chooses the runtime target
- Execution unit: raw shell script or command text
- Probe refresh strategy: probe at startup and cache the result, with explicit on-demand refresh

## 3. Goals

- Unify fragmented local execution paths behind one runtime entry point
- Standardize target probing and execution results
- Reduce platform-specific branching inside business task modules
- Keep the first version small enough to land without forcing a large rewrite
- Leave a clean interface seam for future remote-node reuse

## 4. Non-Goals

- No automatic runtime target selection in the first version
- No long-lived process lifecycle management in the first version
- No direct modeling of OpenClaw, gateway, browser, or MCP business semantics inside runtime
- No replacement of the current remote-control protocol in the first version
- No attempt to solve all environment diagnostics inside runtime

## 5. Problem Statement

The current implementation mixes three different concerns:

1. process execution mechanics
2. platform-specific target adaptation
3. business-level runtime policy

This causes several issues:

- the same platform branches are repeated in multiple modules
- probe state is too narrow because it is centered on OpenClaw execution mode instead of a general runtime model
- direct `powershell.exe` and `runWslScript()` calls make later refactoring harder
- UI and diagnostics cannot rely on a single runtime snapshot
- future reuse by remote nodes would require reverse-engineering local runtime state from business modules

## 6. Proposed Architecture

The runtime layer becomes a local service with two responsibilities:

- probe available execution targets
- execute short shell scripts on an explicitly selected target

The architecture is intentionally thin and consists of three layers:

1. `ProcessRunner`
- Owns process spawning, stdin input, timeout, forced termination, output decoding, and command formatting
- Reuses the current core logic from `app/server/tasks/shell.ts`

2. `TargetAdapter`
- Converts a generic runtime execution request into the concrete process command for one target
- Owns PowerShell, WSL, and local-shell command construction
- Absorbs the argument-building logic currently spread across `platform-adapter.ts` and `shell.ts`

3. `RuntimeService`
- Exposes probe and execute APIs
- Validates target support and availability
- Reads and refreshes cached probe state
- Returns standardized results and errors

Business modules remain above runtime and keep their own policy.

## 7. Runtime Targets

The first version defines three explicit runtime targets:

- `powershell`
  - Windows only
  - Default stable path for Windows
- `wsl`
  - Windows only
  - Optional upgraded path when WSL is available
- `local-shell`
  - Linux and macOS local shell
  - Not the primary Windows path in v1

The caller must always choose the target explicitly. Runtime will not auto-switch to another target if execution fails.

## 8. Public Interface

Suggested interface shape:

```ts
type RuntimeTarget = "powershell" | "wsl" | "local-shell";

type RuntimeShellMode = "login" | "interactive" | "non-login" | "clean";

type RuntimeExecRequest = {
  target: RuntimeTarget;
  script: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  shellMode?: RuntimeShellMode;
};

type RuntimeExecResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  command: string;
  target: RuntimeTarget;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

type RuntimeTargetProbe = {
  available: boolean;
  checkedAt: string;
  command?: string;
  reason?: string;
  distro?: string;
};

type RuntimeProbeSnapshot = {
  platform: "windows" | "linux" | "macos";
  checkedAt: string;
  targets: {
    powershell: RuntimeTargetProbe;
    wsl: RuntimeTargetProbe;
    localShell: RuntimeTargetProbe;
  };
};

type RuntimeProbeMode = "cached" | "refresh";
```

Suggested public methods:

- `probeRuntime(mode?: RuntimeProbeMode): Promise<RuntimeProbeSnapshot>`
- `execRuntime(request: RuntimeExecRequest): Promise<RuntimeExecResult>`

The execution API may throw a structured runtime error instead of returning an ad hoc string failure.

## 9. Probe Model and Cache Strategy

### 9.1 Probe scope

The runtime probe answers only one question:

Can this machine currently use a given target as a command execution backend?

It does not try to answer whether OpenClaw, git, pnpm, bun, or other business dependencies are installed. Those remain part of higher-level environment diagnostics.

### 9.2 Probe timing

The first version uses a cached-first strategy:

- probe once during desktop bootstrap
- persist the snapshot locally
- let most callers read cached data
- expose explicit refresh when the user or a task needs a fresh answer

### 9.3 Probe persistence

The snapshot should live inside the existing local config system rather than introducing a second local state file.

Current `wsl.available / checkedAt / execMode` fields are too narrow. They should evolve into a general `runtime` section, for example:

```ts
type LocalRuntimeConfig = {
  checkedAt: string;
  platform: "windows" | "linux" | "macos";
  targets: {
    powershell?: {
      available: boolean;
      command: string;
      checkedAt: string;
      reason?: string;
    };
    wsl?: {
      available: boolean;
      command: string;
      distro?: string;
      checkedAt: string;
      reason?: string;
    };
    localShell?: {
      available: boolean;
      command: string;
      checkedAt: string;
      reason?: string;
    };
  };
};
```

Backward compatibility with existing `wsl.execMode` can be preserved during migration, but runtime probing should stop depending on that narrow shape.

### 9.4 Probe behavior by target

`powershell`
- verify the platform is Windows
- verify `powershell.exe` can start

`wsl`
- verify the platform is Windows
- verify `wsl.exe` exists and can respond
- list distributions and select one preferred distro
- record the selected distro in the probe snapshot

`local-shell`
- verify the platform is Linux or macOS
- verify `bash` is available

### 9.5 Execution-time guard

Even if a caller already read cached probe data, `execRuntime()` should still perform a fast final target-availability guard before execution. Cached state is a hint, not a guarantee.

## 10. Execution Flow

Execution should follow one narrow path:

1. caller constructs `RuntimeExecRequest`
2. runtime validates that the target is supported on this platform
3. runtime reads cached probe data
4. runtime verifies that the target is available
5. runtime asks the target adapter to build the concrete command
6. runtime delegates process spawning to `ProcessRunner`
7. runtime returns a standardized result or throws a structured runtime error

The runtime layer is responsible for how to execute, not why a business module chose a target.

## 11. Error Model

The first version should standardize runtime errors. Minimum error codes:

- `TARGET_UNSUPPORTED`
- `TARGET_UNAVAILABLE`
- `TARGET_PROBE_STALE`
- `COMMAND_START_FAILED`
- `COMMAND_TIMEOUT`
- `COMMAND_EXIT_NONZERO`
- `OUTPUT_DECODE_FAILED`

Suggested shape:

```ts
type RuntimeExecError = {
  code:
    | "TARGET_UNSUPPORTED"
    | "TARGET_UNAVAILABLE"
    | "TARGET_PROBE_STALE"
    | "COMMAND_START_FAILED"
    | "COMMAND_TIMEOUT"
    | "COMMAND_EXIT_NONZERO"
    | "OUTPUT_DECODE_FAILED";
  message: string;
  target: RuntimeTarget;
  retriable: boolean;
  details?: Record<string, unknown>;
};
```

Rules:

- unsupported target means the current OS cannot ever use that target
- unavailable target means the target is expected on this OS but currently not usable
- non-zero exit is not the same as command start failure
- timeout is explicit and should preserve the timeout duration in details
- business modules may translate runtime errors into product-specific guidance, but should not invent new platform error heuristics from raw stderr when a runtime code already exists

## 12. Boundaries with Existing Modules

### 12.1 OpenClaw layer

The OpenClaw module keeps business ownership:

- chooses which target it wants to use
- assembles the OpenClaw command script
- interprets OpenClaw-specific failures

`runOpenclawCli()` should remain as a higher-level entry point, but its internals should eventually delegate execution to runtime rather than performing its own target switching and process invocation.

### 12.2 Environment diagnostics layer

Environment diagnostics keeps ownership of business readiness:

- tool presence checks
- installation flows
- repair suggestions
- business dependency readiness

Runtime probe answers whether a target can execute commands.
Environment diagnostics answers whether a workflow can actually run.

### 12.3 Desktop UI layer

The desktop UI should consume the runtime snapshot and expose:

- current target availability
- last probe time
- explicit refresh action
- runtime-code-based error guidance

UI should not build or infer platform-specific shell commands directly.

### 12.4 Remote-control layer

The first version remains local-only in implementation, but the API shape should not block a later transport seam.

Future remote reuse should work by preserving:

- the same target identifiers
- the same execution request shape
- the same probe snapshot shape
- the same result and error model

Remote transport is reserved for later work and is out of scope for this spec.

## 13. Codebase Impact and Migration Path

Migration should be incremental and avoid a wide rewrite.

### Phase 1: Build runtime core

- create the runtime probe service
- create explicit target adapters
- create the runtime execute service
- standardize runtime error codes

### Phase 2: Migrate low-coupling short-command paths

Start with simple short-command flows:

- `app/server/tasks/mcp.ts`
- `app/server/tasks/environment.ts`
- `app/server/openclaw/cli.ts`

These modules currently expose the fragmentation most clearly and will validate the runtime shape quickly.

### Phase 3: Surface runtime state in desktop UI

- expose runtime snapshot in API
- show target availability and last-checked timestamp
- add manual refresh
- map runtime error codes to user-facing guidance

### Phase 4: Re-evaluate second-stage scope

After the short-command runtime lands, decide whether to extend runtime toward:

- long-lived process lifecycle management
- remote execution transport

Those are explicitly excluded from first-version delivery.

## 14. Testing Strategy

### 14.1 Unit tests

Cover:

- target adapter command construction
- probe normalization
- error-code mapping
- shell mode handling

### 14.2 Host-sensitive integration tests

Cover:

- `local-shell` on Linux/macOS
- `powershell` on Windows
- `wsl` with conditional execution where WSL is available

Not every CI environment needs full WSL coverage, but the test suite should allow host-specific verification without blocking unrelated platforms.

### 14.3 Caller regression tests

Cover migrated caller behavior for:

- OpenClaw CLI execution
- environment probe tasks
- MCP build and short command flows

The goal is to prove that migration to runtime does not regress logging, timeout behavior, or user-visible failure handling.

## 15. Risks and Trade-Offs

### Risk: callers still own target policy

This is intentional in v1. It keeps runtime simple and debuggable, but means policy remains distributed in business modules.

### Risk: config migration complexity

Moving from `wsl.execMode` to a fuller `runtime` snapshot requires a careful compatibility pass. The migration should preserve legacy reads during transition.

### Risk: probe cache becomes stale

This is acceptable because:

- bootstrap probe provides a fast default
- explicit refresh is available
- execution performs a final availability guard

### Trade-off: no long-lived process support in v1

This leaves gateway and browser lifecycle code out of runtime for now, but it keeps the first implementation small enough to land and verify.

## 16. Success Criteria

The design is considered successfully implemented when:

- local short-command execution has one runtime entry point
- PowerShell, WSL, and local-shell are modeled as explicit runtime targets
- runtime probe state is unified and cached in local config
- migrated modules no longer directly embed their own platform-specific command construction
- desktop UI can show runtime target availability and refresh it
- runtime failures are surfaced through stable structured error codes

## 17. Referenced Code and Documents

- `app/server/tasks/shell.ts`
- `app/server/system/platform-adapter.ts`
- `app/server/system/openclaw-execution.ts`
- `app/server/openclaw/cli.ts`
- `app/server/tasks/environment.ts`
- `app/server/system/environment.ts`
- `app/server/tasks/mcp.ts`
- `app/main/bootstrap.ts`
- `docs/cloud-remote-control-protocol.md`
- `mcp/windows-mcp/README.md`
