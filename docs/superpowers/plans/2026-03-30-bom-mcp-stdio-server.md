# BOM MCP Stdio Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal standard MCP `stdio` server mode to `bom-mcp` without breaking the existing one-shot CLI tool interface.

**Architecture:** Keep `runTool()` as the shared business entrypoint, add a thin JSON-RPC/MCP transport layer for `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`, and expose that server through a new `serve --transport stdio` CLI path. Update the MCP manifest so hosts can discover the runtime command.

**Tech Stack:** Bun, TypeScript, Bun test, JSON-RPC over stdio.

---

### Task 1: Define the stdio contract with a failing integration test

**Files:**
- Create: `test/integration/mcp/bom-mcp-stdio.test.ts`
- Modify: none
- Test: `test/integration/mcp/bom-mcp-stdio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test";

describe("bom-mcp stdio server", () => {
  it("supports initialize, tools/list, and tools/call over stdio", async () => {
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/integration/mcp/bom-mcp-stdio.test.ts`
Expected: FAIL because the placeholder assertion fails.

- [ ] **Step 3: Replace the placeholder with a real process test**

Write a test that:
- spawns `bun mcp/bom-mcp/src/index.ts serve --transport stdio`
- sends JSON-RPC lines for `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`
- asserts `tools/list` includes `quote_customer_message`
- asserts `tools/call` on `apply_nl_price_update` returns MCP content with the extracted price payload text

- [ ] **Step 4: Run test to verify it fails for the expected reason**

Run: `bun test test/integration/mcp/bom-mcp-stdio.test.ts`
Expected: FAIL because `serve --transport stdio` does not exist yet.

- [ ] **Step 5: Commit**

```bash
git add test/integration/mcp/bom-mcp-stdio.test.ts
git commit -m "test: add failing bom-mcp stdio server integration"
```

### Task 2: Implement the minimal MCP stdio transport

**Files:**
- Create: `mcp/bom-mcp/src/stdio-server.ts`
- Create: `mcp/bom-mcp/src/tool-spec.ts`
- Modify: `mcp/bom-mcp/src/index.ts`
- Test: `test/integration/mcp/bom-mcp-stdio.test.ts`

- [ ] **Step 1: Write the failing implementation-facing test expectation**

Use the Task 1 integration test as the active failing test. Do not add production code before confirming it still fails.

- [ ] **Step 2: Run test to verify RED**

Run: `bun test test/integration/mcp/bom-mcp-stdio.test.ts`
Expected: FAIL because stdio server mode is still missing.

- [ ] **Step 3: Add tool metadata shared by `tools/list`**

Create `mcp/bom-mcp/src/tool-spec.ts` with:
- the list of tool names
- descriptions
- minimal JSON Schemas for each tool input

Keep this file metadata-only so the server layer and future docs can reuse it.

- [ ] **Step 4: Add a stdio MCP server**

Create `mcp/bom-mcp/src/stdio-server.ts` that:
- reads newline-delimited JSON-RPC requests from stdin
- supports:
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- returns:
  - `serverInfo`
  - `capabilities.tools`
  - tool list derived from `tool-spec.ts`
  - `tools/call` results as MCP text content
- routes tool execution through `runTool()`

- [ ] **Step 5: Update the CLI entrypoint**

Modify `mcp/bom-mcp/src/index.ts` so:
- old mode still works:
  - `bun mcp/bom-mcp/src/index.ts <tool> '<json-args>'`
- new mode works:
  - `bun mcp/bom-mcp/src/index.ts serve --transport stdio`

- [ ] **Step 6: Run test to verify GREEN**

Run: `bun test test/integration/mcp/bom-mcp-stdio.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mcp/bom-mcp/src/tool-spec.ts mcp/bom-mcp/src/stdio-server.ts mcp/bom-mcp/src/index.ts test/integration/mcp/bom-mcp-stdio.test.ts
git commit -m "feat: add bom-mcp stdio server mode"
```

### Task 3: Publish runtime metadata and update docs

**Files:**
- Modify: `mcp/bom-mcp/manifest.json`
- Modify: `docs/bom-quote-openclaw-integration.md`
- Modify: `mcp/bom-mcp/README.md`
- Test: `test/contract/mcp/manifests.test.ts`

- [ ] **Step 1: Write the failing metadata assertion**

Extend the manifest contract test or add a focused assertion that `bom-mcp` may declare a valid runtime command.

- [ ] **Step 2: Run test to verify RED**

Run: `bun test test/contract/mcp/manifests.test.ts`
Expected: FAIL after the new assertion is added and before manifest changes are made.

- [ ] **Step 3: Update manifest and docs**

Set `mcp/bom-mcp/manifest.json` to include a runtime command for stdio mode, and update docs to say `bom-mcp` now supports standard stdio MCP transport.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `bun test test/contract/mcp/manifests.test.ts test/integration/mcp/bom-mcp-stdio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mcp/bom-mcp/manifest.json docs/bom-quote-openclaw-integration.md mcp/bom-mcp/README.md test/contract/mcp/manifests.test.ts
git commit -m "docs: publish bom-mcp stdio runtime metadata"
```

### Task 4: Run regression coverage

**Files:**
- Modify: none
- Test:
  - `test/integration/mcp/bom-mcp-tools.test.ts`
  - `test/integration/mcp/bom-mcp-customer-message.test.ts`
  - `test/integration/mcp/bom-mcp-web-pricing.test.ts`
  - `test/integration/mcp/bom-mcp-stdio.test.ts`
  - `test/contract/mcp/manifests.test.ts`

- [ ] **Step 1: Run the BOM MCP regression suite**

Run:

```bash
bun test \
  test/integration/mcp/bom-mcp-tools.test.ts \
  test/integration/mcp/bom-mcp-customer-message.test.ts \
  test/integration/mcp/bom-mcp-web-pricing.test.ts \
  test/integration/mcp/bom-mcp-stdio.test.ts \
  test/contract/mcp/manifests.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run the full repository test suite**

Run: `bun test test`
Expected: PASS with zero failures.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "test: verify bom-mcp stdio server regression coverage"
```
