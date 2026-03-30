# BOM MCP File-First Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the BOM MCP export tools return host-agnostic file-first metadata while keeping `downloadUrl` optional and document the contract.

**Architecture:** Both export tools call `resolveRuntimeEnv()` to locate `exportDir` and `publicBaseUrl`, write their payload into that directory, and return `filePath`, `fileName`, `format`, `mimeType`, and `expiresAt` (with `downloadUrl` only when the host provides `publicBaseUrl`). Tests assert the new contract, and the spec tracks the documented behaviour.

**Tech Stack:** Bun/Bun test, TypeScript, MCP stdio tooling.

---

### Task 1: Guard the file-first export contract

**Files:**
- Modify: `docs/superpowers/specs/2026-03-30-bom-mcp-runtime-host-independence-design.md`
- Modify: `test/integration/mcp/bom-mcp-tools.test.ts`
- Modify: `test/integration/mcp/bom-mcp-customer-message.test.ts`
- Test: `test/integration/mcp/bom-mcp-tools.test.ts`
- Test: `test/integration/mcp/bom-mcp-customer-message.test.ts`

- [ ] **Step 1: Write the failing test (duplicate it for both tool suites)**
  ```ts
  it("includes downloadUrl when publicBaseUrl is configured", async () => {
    const prev = process.env.BOM_MCP_PUBLIC_BASE_URL;
    process.env.BOM_MCP_PUBLIC_BASE_URL = "https://exports.example.com/bom";
    try {
      const submitResult = (await runTool({ tool: "submit_bom", args: { sourceType: "json", content: JSON.stringify([{ partNumber: "DL-001", quantity: 1, unitPrice: 1 }]) } })) as { jobId: string };
      await waitForSucceededJob(submitResult.jobId);
      const exported = (await runTool({ tool: "export_quote", args: { jobId: submitResult.jobId, format: "csv" } })) as FileFirstExportResult;
      expect(exported.downloadUrl).toBe(`https://exports.example.com/bom/${encodeURIComponent(exported.fileName)}`);
    } finally {
      if (prev === undefined) {
        delete process.env.BOM_MCP_PUBLIC_BASE_URL;
      } else {
        process.env.BOM_MCP_PUBLIC_BASE_URL = prev;
      }
    }
  });
  ``` 
  The customer-message suite keeps the same structure but calls `export_customer_quote` and reads `message` from the markdown fixture; expect the same encoded `downloadUrl` when `publicBaseUrl` is set.

- [ ] **Step 2: Run the failing test**
  Run: `bun test test/integration/mcp/bom-mcp-tools.test.ts test/integration/mcp/bom-mcp-customer-message.test.ts`
  Expected: FAIL because the export contract does not yet assert `downloadUrl` when `publicBaseUrl` is supplied (the new assertion should surface the gap).

- [ ] **Step 3: Implement file-first export outputs**
  ```ts
  const { exportDir, publicBaseUrl } = resolveRuntimeEnv();
  await mkdir(exportDir, { recursive: true });
  const fileName = `${jobId}.${format}`;
  const absolutePath = resolve(exportDir, fileName);
  await writeFile(absolutePath, format === "json" ? JSON.stringify(quote, null, 2) : format === "csv" ? singleBomToCsv(quote) : singleBomToXlsx(quote));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const result: ExportQuoteOutput = {
    filePath: absolutePath,
    fileName,
    format,
    mimeType: MIME_TYPES[format],
    expiresAt,
  };
  if (publicBaseUrl) {
    result.downloadUrl = `${publicBaseUrl}/${encodeURIComponent(fileName)}`;
  }
  return result;
  ```
  (Mirror the same pattern in `export_customer_quote` and mention the spec update snippet below.)
  ```md
  - Add focused uploads in `bom-mcp-tools` and `bom-mcp-customer-message` tests that set `BOM_MCP_PUBLIC_BASE_URL` just for the export call and assert the computed `downloadUrl` matches `publicBaseUrl`/`encodeURIComponent(fileName)`.
  ```

- [ ] **Step 4: Run the suite again**
  Run: `bun test test/integration/mcp/bom-mcp-tools.test.ts test/integration/mcp/bom-mcp-customer-message.test.ts`
  Expected: PASS once the export tools and spec are aligned with the new contract.

- [ ] **Step 5: Commit**
  ```bash
  git add docs/superpowers/specs/2026-03-30-bom-mcp-runtime-host-independence-design.md test/integration/mcp/bom-mcp-tools.test.ts test/integration/mcp/bom-mcp-customer-message.test.ts
  git commit -m "feat: return file-first export metadata from bom-mcp"
  ```
