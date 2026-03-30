# BOM MCP Runtime Host Independence Design

## Goal

Make `bom-mcp` runnable as a host-agnostic MCP runtime by removing hard dependency on repository-relative `artifacts/...` paths and ClawOS-specific export URL semantics.

This design intentionally limits scope to three deliverables:

1. A centralized runtime environment resolver.
2. A host-agnostic export result contract.
3. A minimal `doctor` command for runtime self-checks.

It does not include plugin bundling, packaged binaries, or deep external network diagnostics.

## Current Problems

### Runtime paths are unstable

`bom-mcp` currently stores SQLite state and export files under `process.cwd()/artifacts/mcp/bom-mcp/...`.

That works when the runtime is launched from the repository root, but it becomes fragile when:

- the runtime is started by an external MCP host
- the working directory changes
- the runtime is installed outside the repository

### Export results are coupled to ClawOS URL semantics

The export tools currently return `downloadUrl` values like `/artifacts/mcp/bom-mcp/exports/...`.

That is not a stable contract for generic hosts. It assumes:

- a specific web server
- a specific URL layout
- a host that understands repository-relative artifacts

### There is no runtime self-check

Now that `bom-mcp` can run as a stdio MCP server, there is no built-in way to answer:

- where state files are stored
- whether directories are writable
- whether SQLite can open
- whether runtime configuration is incomplete

## Design Overview

Introduce a small runtime environment layer that all stateful runtime code uses.

The architecture becomes:

1. `runtime-env.ts`
   Resolves stable directories and derived paths.
2. `store.ts`
   Uses `runtime-env.ts` for SQLite file placement instead of `process.cwd()`.
3. export tools
   Use `runtime-env.ts` for export directory placement and return host-agnostic file metadata.
4. `doctor`
   Uses `runtime-env.ts` to validate runtime readiness and print a structured report.

This keeps the current business logic intact. The change is about runtime boundaries, not quote behavior.

## Runtime Environment Resolution

Create a dedicated module, tentatively:

- `mcp/bom-mcp/src/runtime-env.ts`

It should expose a single resolved runtime object with:

- `stateDir`
- `dbPath`
- `exportDir`
- `cacheDir`
- `publicBaseUrl`
- `source`

Where `source` indicates which resolution tier was used, for example:

- `env`
- `user_home`
- `dev_fallback`

### Resolution Priority

Use the following priority order:

1. Explicit environment variables
2. Stable user-home default
3. Development fallback under repository `artifacts/...`

### Recommended Variables

- `BOM_MCP_STATE_DIR`
- `BOM_MCP_DB_PATH`
- `BOM_MCP_EXPORT_DIR`
- `BOM_MCP_CACHE_DIR`
- `BOM_MCP_PUBLIC_BASE_URL`

### Default Layout

When no explicit variables are set, default to a stable user-home layout:

```txt
~/.openclaw/state/bom-mcp/
  bom-mcp.sqlite
  cache/
  exports/
```

Only if that user-home layout cannot be resolved in the current environment should development fallback be used.

Development fallback remains:

```txt
<cwd>/artifacts/mcp/bom-mcp/
```

This preserves local developer ergonomics without making it the runtime contract.

## Export Contract

Replace the current export result shape, which is effectively URL-first, with a file-first contract.

### Required Fields

- `filePath`
- `fileName`
- `format`
- `mimeType`
- `expiresAt`

### Optional Fields

- `downloadUrl`

`downloadUrl` should only be returned when `publicBaseUrl` is configured.

### Rules

- `bom-mcp` core is responsible for writing the file and returning local file metadata.
- The host is responsible for deciding whether to expose that file over HTTP.
- If the host wants a public URL, it provides `publicBaseUrl`, and `bom-mcp` may derive a URL from it.
- No ClawOS-specific hardcoded path prefixes remain in core export logic.

### Compatibility

This is a contract change. Existing callers that only read `downloadUrl` must be updated.

To keep rollout manageable, the transition should:

1. Add the new file-first fields.
2. Keep `downloadUrl` optional.
3. Update internal tests and docs to use the new fields first.

## Doctor Command

Add a runtime self-check command exposed both through CLI and MCP tool surface.

### CLI Form

Recommended command:

```bash
bun mcp/bom-mcp/src/index.ts doctor
```

### MCP Tool Form

Recommended tool:

- `doctor`

This keeps host integration simple, especially for OpenClaw and future generic MCP panels.

### Minimum Checks

- resolve runtime environment
- create `stateDir` if needed
- create `exportDir` if needed
- create `cacheDir` if needed
- confirm directories are writable
- open SQLite successfully
- report current Bun version
- report effective environment summary

### Warnings, Not Hard Failures

These should surface as warnings rather than fatal errors:

- no `publicBaseUrl`
- currently using development fallback path
- web supplier connectivity not checked

### Output Shape

Return structured JSON with:

- `ok`
- `runtime`
- `checks`
- `warnings`

This makes the command machine-readable and also usable from MCP tool calls.

## File Boundaries

### New files

- `mcp/bom-mcp/src/runtime-env.ts`
- `mcp/bom-mcp/src/tools/doctor.ts`
- new tests for runtime env and doctor

### Modified files

- `mcp/bom-mcp/src/infra/store.ts`
- `mcp/bom-mcp/src/tools/export-quote.ts`
- `mcp/bom-mcp/src/tools/export-customer-quote.ts`
- `mcp/bom-mcp/src/index.ts`
- `mcp/bom-mcp/src/tool-spec.ts`
- `mcp/bom-mcp/manifest.json`
- docs and contract tests that describe export output

## Error Handling

### Runtime environment

If explicit environment variables are invalid, fail fast with precise error messages.

Examples:

- export dir path is empty
- db path points to a directory
- public base URL is malformed

### Exports

Export should fail only if file creation fails or quote generation fails.

Missing `publicBaseUrl` must not fail export. It only means `downloadUrl` is omitted.

### Doctor

`doctor` should return:

- `ok: false` when hard runtime checks fail
- `ok: true` with warnings when runtime is usable but incomplete

## Testing Strategy

Use TDD and keep coverage focused on runtime behavior.

### Runtime environment tests

Add focused tests for:

- explicit env override
- user-home default path resolution
- development fallback behavior
- malformed environment values

### Export tests

Update export tests to assert:

- local file metadata is returned
- file exists at returned `filePath`
- `downloadUrl` is omitted by default
- `downloadUrl` appears when `publicBaseUrl` is set

### Doctor tests

Add tests that assert:

- `doctor` reports resolved runtime paths
- writable directories pass
- warnings are present when `publicBaseUrl` is absent

### Regression tests

Existing BOM quote, customer-message, web-pricing, and stdio server tests must continue to pass.

## Non-Goals

This design explicitly does not include:

- plugin bundle implementation
- standalone binary packaging
- remote upload/download hosting
- live supplier connectivity checks in `doctor`
- redesign of quote logic or pricing logic

## Recommended Rollout

### Phase 1

Add runtime environment resolution and migrate SQLite/export path usage.

### Phase 2

Add new export contract and update tests and docs.

### Phase 3

Add `doctor` CLI + MCP tool.

### Phase 4

Publish a new MCP version once the host-agnostic runtime contract is verified.
