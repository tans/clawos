import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { runTool } from "../../../mcp/bom-mcp/src/index";
import { getJob } from "../../../mcp/bom-mcp/src/infra/store";

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForSucceededJob(jobId: string): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    const status = (await runTool({
      tool: "get_bom_job_result",
      args: { jobId },
    })) as { status: string };
    if (status.status === "succeeded") {
      return;
    }
    await sleep(10);
  }
  throw new Error(`job did not reach succeeded state in time: ${jobId}`);
}

describe("bom-mcp tools", () => {
  it("supports submit -> query -> quote -> export workflow", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([
          { partNumber: "abc-001", quantity: 2, unitPrice: 3.5 },
          { partNumber: "xyz-002", quantity: 1, unitPrice: 10 },
        ]),
        quoteParams: { currency: "CNY", taxRate: 0.1 },
      },
    })) as { jobId: string };

    expect(submitResult.jobId.length).toBeGreaterThan(5);
    await sleep(10);

    const jobResult = (await runTool({
      tool: "get_bom_job_result",
      args: { jobId: submitResult.jobId },
    })) as { status: string; summary: { totalLines: number } };
    expect(jobResult.status).toBe("succeeded");
    expect(jobResult.summary.totalLines).toBe(2);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{ priceSource?: string; priceUpdatedAt?: string; priceConfidence?: string }>;
      totals: { grandTotal: number };
    };
    expect(quote.status).toBe("completed");
    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[0]?.priceSource).toBe("input");
    expect(quote.lines[0]?.priceUpdatedAt).toBeTruthy();
    expect(quote.lines[0]?.priceConfidence).toBe("high");
    expect(quote.totals.grandTotal).toBeGreaterThan(0);

    const exported = (await runTool({
      tool: "export_quote",
      args: { jobId: submitResult.jobId, format: "csv" },
    })) as { downloadUrl: string };
    expect(exported.downloadUrl).toContain(`${submitResult.jobId}.csv`);

    const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
    await access(filePath);
    expect(true).toBeTrue();

    const csv = await readFile(filePath, "utf-8");
    expect(csv).toContain("priceSource");
    expect(csv).toContain("priceUpdatedAt");
    expect(csv).toContain("priceConfidence");
  });

  it("returns pending decisions instead of using a default fallback price", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nP-001,3,,First\nP-002,1,5.5,Second\n",
        quoteParams: { currency: "CNY", taxRate: 0 },
      },
    })) as { jobId: string };
    await sleep(10);

    const jobResult = (await runTool({
      tool: "get_bom_job_result",
      args: { jobId: submitResult.jobId },
    })) as { summary: { pendingDecisionLines: number } };
    expect(jobResult.summary.pendingDecisionLines).toBe(1);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{ partNumber: string; decisionType: string; unitPrice?: number; lineNo: number }>;
      pendingDecisions: Array<{ lineNo: number; decisionType: string }>;
      warnings: Array<string>;
    };
    expect(quote.status).toBe("completed_with_decisions");
    expect(quote.pendingDecisions).toHaveLength(1);
    expect(quote.pendingDecisions[0]?.decisionType).toBe("missing_reliable_price");
    expect(quote.pendingDecisions[0]?.lineNo).toBe(2);
    expect(quote.lines[0]?.partNumber).toBe("P-001");
    expect(quote.lines[0]?.decisionType).toBe("missing_reliable_price");
    expect(quote.lines[0]?.unitPrice).toBeUndefined();
    expect(quote.lines[0]?.lineNo).toBe(2);
    expect(quote.warnings[0]).toContain("待确认");
  });

  it("applies natural-language price update before quoting", async () => {
    await runTool({
      tool: "apply_nl_price_update",
      args: {
        partNumber: "STM32F103C8T6",
        unitPrice: 11.8,
        supplier: "LCSC",
        reason: "客户口头确认价格",
      },
    });

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nSTM32F103C8T6,2,,MCU\n",
        quoteParams: { currency: "CNY", taxRate: 0 },
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{
        unitPrice?: number;
        decisionType: string;
        priceSource?: string;
        priceUpdatedAt?: string;
        priceConfidence?: string;
      }>;
      pendingDecisions: Array<unknown>;
    };

    expect(quote.status).toBe("completed");
    expect(quote.lines[0]?.unitPrice).toBe(11.8);
    expect(quote.lines[0]?.decisionType).toBe("resolved");
    expect(quote.lines[0]?.priceSource).toBe("manual");
    expect(quote.lines[0]?.priceUpdatedAt).toBeTruthy();
    expect(quote.lines[0]?.priceConfidence).toBe("high");
    expect(quote.pendingDecisions).toHaveLength(0);
  });

  it("downgrades confidence for stale stored manual prices", async () => {
    await runTool({
      tool: "apply_nl_price_update",
      args: {
        partNumber: "STALE-MANUAL-001",
        unitPrice: 4.2,
        supplier: "LegacySheet",
        reason: "旧人工报价",
      },
    });

    const db = new Database(resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "bom-mcp.sqlite"));
    db.prepare("UPDATE part_prices SET effective_at = ? WHERE part_number_norm = ?").run(
      new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      "STALE-MANUAL-001",
    );
    db.close();

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nSTALE-MANUAL-001,2,,MCU\n",
        quoteParams: { currency: "CNY", taxRate: 0 },
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      lines: Array<{ priceSource?: string; priceConfidence?: string }>;
    };

    expect(quote.lines[0]?.priceSource).toBe("manual");
    expect(quote.lines[0]?.priceConfidence).toBe("medium");
  });

  it("returns catalog metadata with parseable priceUpdatedAt", async () => {
    const db = new Database(resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "bom-mcp.sqlite"));
    db.prepare(
      `INSERT INTO part_prices (
        part_number_norm, supplier, currency, unit_price, source_type, source_ref, effective_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "CATALOG-001",
      "InternalCatalog",
      "CNY",
      6.8,
      "catalog",
      "seeded-test",
      new Date().toISOString(),
    );
    db.close();

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\nCATALOG-001,3,,Regulator\n",
        quoteParams: { currency: "CNY", taxRate: 0 },
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      lines: Array<{ priceSource?: string; priceUpdatedAt?: string; priceConfidence?: string }>;
    };

    expect(quote.lines[0]?.priceSource).toBe("catalog");
    expect(quote.lines[0]?.priceConfidence).toBe("medium");
    expect(Number.isNaN(Date.parse(quote.lines[0]?.priceUpdatedAt ?? ""))).toBeFalse();
  });

  it("parses quoted csv fields with commas correctly", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content:
          'partNumber,quantity,unitPrice,description,designator,manufacturer\nP-100,2,1.25,"Resistor, 10K 1%","R1, R2",Yageo\nP-200,1,3.5,Capacitor,C3,Murata\n',
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { lines: Array<{ description?: string; designator?: string; manufacturer?: string }> };
    expect(quote.lines[0]?.description).toBe("Resistor, 10K 1%");
    expect(quote.lines[0]?.designator).toBe("R1, R2");
    expect(quote.lines[0]?.manufacturer).toBe("Yageo");
  });

  it("parses quoted csv fields with embedded newlines as a single row", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content:
          'partNumber,quantity,description\nP-100,2,"Resistor line 1\nResistor line 2"\nP-200,1,Capacitor\n',
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { lines: Array<{ partNumber: string; description?: string; lineNo: number }> };

    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[0]?.description).toBe("Resistor line 1\nResistor line 2");
    expect(quote.lines[1]?.partNumber).toBe("P-200");
    expect(quote.lines[1]?.lineNo).toBe(4);
  });

  it("preserves source line numbers when csv has blank rows", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice\nP-001,1,1\n\nP-002,2,1\n",
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { lines: Array<{ partNumber: string; lineNo: number }> };

    const second = quote.lines.find((line) => line.partNumber === "P-002");
    expect(second?.lineNo).toBe(4);
  });

  it("flags vague electronic component descriptions as ambiguous candidates", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "csv",
        content: "partNumber,quantity,unitPrice,description\n68u,2,,68u\nCR2032 MFR SM,1,,CR2032 MFR SM\n",
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{ partNumber: string; decisionType: string; needsCustomerDecision: boolean }>;
      pendingDecisions: Array<{ lineNo: number; decisionType: string }>;
    };

    expect(quote.status).toBe("completed_with_decisions");
    expect(quote.pendingDecisions).toHaveLength(2);
    expect(quote.lines[0]?.decisionType).toBe("ambiguous_candidates");
    expect(quote.lines[0]?.needsCustomerDecision).toBeTrue();
    expect(quote.lines[1]?.decisionType).toBe("ambiguous_candidates");
  });

  it("returns candidate options for ambiguous electronic lines", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        `
        <html>
          <body>
            <div class="candidate">
              <span class="mfr">YMIN</span>
              <a href="/detail/VKMD1001J680MV">VKMD1001J680MV</a>
              <span>¥1.23</span>
            </div>
            <div class="candidate">
              <span class="mfr">Samsung Electro-Mechanics</span>
              <a href="/detail/CS3225X5R476K160NRL">CS3225X5R476K160NRL</a>
              <span>¥0.88</span>
            </div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: "partNumber,quantity,description\n68u,2,68u\n",
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(submitResult.jobId);

      const quote = (await runTool({
        tool: "get_quote",
        args: { jobId: submitResult.jobId },
      })) as {
        pendingDecisions: Array<{
          originalPartText: string;
          recommendedAction: string;
          options: Array<{ partNumber: string; manufacturer?: string }>;
        }>;
      };

      expect(quote.pendingDecisions[0]?.originalPartText).toContain("68u");
      expect(quote.pendingDecisions[0]?.recommendedAction).toContain("请选择");
      expect(quote.pendingDecisions[0]?.options.length).toBeGreaterThan(0);
      expect(quote.pendingDecisions[0]?.options[0]?.partNumber).toBe("VKMD1001J680MV");
      expect(quote.pendingDecisions[0]?.options[0]?.manufacturer).toBe("YMIN");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not attach unchecked alternative parts to missing-price exact MPN decisions", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        `
        <html>
          <body>
            <div class="candidate">
              <span class="mfr">Alt Vendor</span>
              <a href="/detail/ALT-PART-001">ALT-PART-001</a>
              <span>¥9.99</span>
            </div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: "partNumber,quantity,description\nEXACTPART123,1,MCU\n",
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(submitResult.jobId);

      const quote = (await runTool({
        tool: "get_quote",
        args: { jobId: submitResult.jobId },
      })) as {
        pendingDecisions: Array<{ decisionType: string; options: Array<{ partNumber: string }> }>;
      };

      expect(quote.pendingDecisions[0]?.decisionType).toBe("missing_reliable_price");
      expect(quote.pendingDecisions[0]?.options).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("surfaces blocked web suppliers in missing-price reasons", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        `
        <!DOCTYPE html>
        <html>
          <head><title>Just a moment...</title></head>
          <body><div id="cf-challenge-running">cloudflare</div></body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: "partNumber,quantity,description\nBLOCKEDPART123,2,MCU\n",
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(submitResult.jobId);

      const quote = (await runTool({
        tool: "get_quote",
        args: { jobId: submitResult.jobId },
      })) as {
        pendingDecisions: Array<{ decisionType: string; reason: string }>;
      };

      expect(quote.pendingDecisions[0]?.decisionType).toBe("missing_reliable_price");
      expect(quote.pendingDecisions[0]?.reason).toContain("digikey_cn 返回防护页");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reuses cached web prices for later quotes without refetching", async () => {
    const originalFetch = globalThis.fetch;
    const partNumber = `CACHEPART${Date.now()}`;
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        `
        <html>
          <body>
            <a href="/detail/${partNumber}">${partNumber}</a>
            <div>价格阶梯</div>
            <div>1: ¥7.77</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }) as typeof fetch;

    try {
      const firstSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},1,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(firstSubmit.jobId);

      const firstQuote = (await runTool({
        tool: "get_quote",
        args: { jobId: firstSubmit.jobId },
      })) as {
        lines: Array<{ unitPrice?: number; priceSource?: string; sourceUrl?: string }>;
      };

      expect(firstQuote.lines[0]?.unitPrice).toBe(7.77);
      expect(firstQuote.lines[0]?.priceSource).toBe("digikey_cn");
      expect(firstQuote.lines[0]?.sourceUrl).toContain("digikey.cn");
      expect(fetchCalls).toBeGreaterThan(0);

      globalThis.fetch = (async () => {
        throw new Error("fetch should not be called when cached web price exists");
      }) as typeof fetch;

      const secondSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},2,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(secondSubmit.jobId);

      const secondQuote = (await runTool({
        tool: "get_quote",
        args: { jobId: secondSubmit.jobId },
      })) as {
        lines: Array<{ unitPrice?: number; priceSource?: string; sourceUrl?: string }>;
      };

      expect(secondQuote.lines[0]?.unitPrice).toBe(7.77);
      expect(secondQuote.lines[0]?.priceSource).toBe("digikey_cn");
      expect(secondQuote.lines[0]?.sourceUrl).toContain("digikey.cn");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refreshes expired cached web prices before quoting", async () => {
    const originalFetch = globalThis.fetch;
    const partNumber = `EXPIREPART${Date.now()}`;

    globalThis.fetch = (async () =>
      new Response(
        `
        <html>
          <body>
            <a href="/detail/${partNumber}">${partNumber}</a>
            <div>价格阶梯</div>
            <div>1: ¥5.55</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const firstSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},1,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(firstSubmit.jobId);

      const db = new Database(resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "bom-mcp.sqlite"));
      db.prepare("UPDATE part_prices SET effective_at = ?, expires_at = ? WHERE part_number_norm = ?").run(
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        partNumber,
      );
      db.close();

      globalThis.fetch = (async () =>
        new Response(
          `
          <html>
            <body>
              <a href="/detail/${partNumber}">${partNumber}</a>
              <div>价格阶梯</div>
              <div>1: ¥6.66</div>
            </body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        )) as typeof fetch;

      const secondSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},1,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(secondSubmit.jobId);

      const secondQuote = (await runTool({
        tool: "get_quote",
        args: { jobId: secondSubmit.jobId },
      })) as {
        lines: Array<{ unitPrice?: number; priceSource?: string; priceConfidence?: string; reason?: string }>;
      };

      expect(secondQuote.lines[0]?.unitPrice).toBe(6.66);
      expect(secondQuote.lines[0]?.priceSource).toBe("digikey_cn");
      expect(secondQuote.lines[0]?.priceConfidence).toBe("medium");
      expect(secondQuote.lines[0]?.reason).not.toContain("沿用上次确认价格");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to stale cached web prices when refresh fails after expiry", async () => {
    const originalFetch = globalThis.fetch;
    const partNumber = `STALEWEB${Date.now()}`;

    globalThis.fetch = (async () =>
      new Response(
        `
        <html>
          <body>
            <a href="/detail/${partNumber}">${partNumber}</a>
            <div>价格阶梯</div>
            <div>1: ¥8.88</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const firstSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},1,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(firstSubmit.jobId);

      const db = new Database(resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "bom-mcp.sqlite"));
      db.prepare("UPDATE part_prices SET effective_at = ?, expires_at = ? WHERE part_number_norm = ?").run(
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        partNumber,
      );
      db.close();

      globalThis.fetch = (async () =>
        new Response(
          `
          <!DOCTYPE html>
          <html>
            <head><title>Just a moment...</title></head>
            <body><div id="cf-challenge-running">cloudflare</div></body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        )) as typeof fetch;

      const secondSubmit = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: `partNumber,quantity,description\n${partNumber},1,MCU\n`,
          quoteParams: { webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(secondSubmit.jobId);

      const secondQuote = (await runTool({
        tool: "get_quote",
        args: { jobId: secondSubmit.jobId },
      })) as {
        lines: Array<{ unitPrice?: number; priceSource?: string; priceConfidence?: string; reason?: string }>;
      };

      expect(secondQuote.lines[0]?.unitPrice).toBe(8.88);
      expect(secondQuote.lines[0]?.priceSource).toBe("digikey_cn");
      expect(secondQuote.lines[0]?.priceConfidence).toBe("low");
      expect(secondQuote.lines[0]?.reason).toContain("缓存已过期，沿用上次确认价格");
      expect(secondQuote.lines[0]?.reason).toContain("digikey_cn 返回防护页");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("exports business-facing csv rows including pending decision guidance", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        `
        <html>
          <body>
            <div class="candidate">
              <span class="mfr">YMIN</span>
              <a href="/detail/VKMD1001J680MV">VKMD1001J680MV</a>
              <span>¥1.23</span>
            </div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      )) as typeof fetch;

    try {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          content: "partNumber,quantity,description\n68u,2,68u\nSTM32F103C8T6,1,MCU\n",
          quoteParams: { currency: "CNY", taxRate: 0, webPricing: true, webSuppliers: ["digikey_cn"] },
        },
      })) as { jobId: string };
      await waitForSucceededJob(submitResult.jobId);

      const exported = (await runTool({
        tool: "export_quote",
        args: { jobId: submitResult.jobId, format: "csv" },
      })) as { downloadUrl: string };

      const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
      const csv = await readFile(filePath, "utf-8");

      expect(csv).toContain("recommendedAction");
      expect(csv).toContain("candidateOptions");
      expect(csv).toContain("selectedManufacturer");
      expect(csv).toContain("selectedPartNumber");
      expect(csv).toContain("moq");
      expect(csv).toContain("leadTime");
      expect(csv).toContain("note");
      expect(csv).toContain("priceSource");
      expect(csv).toContain("请选择明确型号后重新报价");
      expect(csv).toContain("VKMD1001J680MV");
      expect(csv).toContain("68u");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("exports xlsx workbook with summary and line sheets", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([{ partNumber: "abc-001", quantity: 2, unitPrice: 3.5 }]),
        quoteParams: { currency: "CNY", taxRate: 0.1 },
      },
    })) as { jobId: string };
    await waitForSucceededJob(submitResult.jobId);

    const exported = (await runTool({
      tool: "export_quote",
      args: { jobId: submitResult.jobId, format: "xlsx" },
    })) as { downloadUrl: string };

    expect(exported.downloadUrl).toContain(`${submitResult.jobId}.xlsx`);

    const filePath = resolve(process.cwd(), decodeURIComponent(exported.downloadUrl).replace(/^\//, ""));
    const workbook = XLSX.read(await readFile(filePath), { type: "buffer" });
    expect(workbook.SheetNames).toContain("Summary");
    expect(workbook.SheetNames).toContain("Lines");

    const lineRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Lines, { defval: "" });
    expect(lineRows[0]?.selectedPartNumber).toBe("ABC-001");
    expect(Object.keys(lineRows[0] || {})).toContain("selectedManufacturer");
    expect(Object.keys(lineRows[0] || {})).toContain("leadTime");
    expect(Object.keys(lineRows[0] || {})).toContain("note");
    expect(lineRows[0]?.priceSource).toBe("input");
    expect(String(lineRows[0]?.priceUpdatedAt || "")).not.toBe("");
  });

  it("supports get_job_status alias", async () => {
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([{ partNumber: "ALIAS-001", quantity: 1, unitPrice: 1 }]),
      },
    })) as { jobId: string };
    await sleep(10);

    const statusResult = (await runTool({
      tool: "get_job_status",
      args: { jobId: submitResult.jobId },
    })) as { status: string };
    expect(statusResult.status).toBe("succeeded");
  });

  it("supports xlsx content through submit -> quote", async () => {
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "xlsx",
        content: workbook,
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { lines: Array<{ partNumber: string }> };
    expect(quote.lines.length).toBeGreaterThan(0);
    expect(quote.lines[0]?.partNumber).toBe("CC0402KRX7R7BB224");
  });

  it("accepts xlsx content as json-serializable byte array", async () => {
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "xlsx",
        content: Array.from(workbook),
      },
    })) as { jobId: string };
    await sleep(10);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as { lines: Array<{ partNumber: string }> };
    expect(quote.lines.length).toBeGreaterThan(0);
    expect(quote.lines[0]?.partNumber).toBe("CC0402KRX7R7BB224");
  });

  it("round-trips stored xlsx byte-array input for later inspection", async () => {
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    const inputBytes = Array.from(workbook);
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "xlsx",
        content: inputBytes,
      },
    })) as { jobId: string };
    await sleep(10);

    const job = getJob(submitResult.jobId);
    expect(Array.isArray(job?.input.content)).toBeTrue();
    expect((job?.input.content as number[] | undefined)?.[0]).toBe(inputBytes[0]);
  });

  it("persists rawText for submitted xlsx rows", async () => {
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "xlsx",
        content: workbook,
      },
    })) as { jobId: string };
    await sleep(10);

    const job = getJob(submitResult.jobId);
    expect(job?.lines[0]?.rawText).toContain("CC0402KRX7R7BB224");
    expect(job?.lines[0]?.rawText).toContain("220n 16V X7R");
  });

  it("supports xlsx fileUrl fetch", async () => {
    const originalFetch = globalThis.fetch;
    const workbook = await readFile("mcp/bom-mcp/cases/multibom/92712 PG - BOM(1).xlsx");
    globalThis.fetch = (async () =>
      new Response(workbook, {
        status: 200,
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })) as typeof fetch;

    try {
      const submitResult = (await runTool({
        tool: "submit_bom",
        args: {
          sourceType: "xlsx",
          fileUrl: "https://example.com/customer-bom.xlsx",
        },
      })) as { jobId: string };
      await sleep(10);

      const quote = (await runTool({
        tool: "get_quote",
        args: { jobId: submitResult.jobId },
      })) as { lines: Array<{ partNumber: string }> };
      expect(quote.lines.length).toBeGreaterThan(0);
      expect(quote.lines[0]?.partNumber).toBe("CC0402KRX7R7BB224");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects unsafe local fileUrl path", async () => {
    await expect(
      runTool({
        tool: "submit_bom",
        args: {
          sourceType: "csv",
          fileUrl: "/tmp/bom.csv",
        },
      }),
    ).rejects.toThrow("fileUrl 仅支持 http(s) 地址");
  });

  it("rejects invalid tax rate", async () => {
    await expect(
      runTool({
        tool: "submit_bom",
        args: {
          sourceType: "json",
          content: JSON.stringify([{ partNumber: "TAX-001", quantity: 1, unitPrice: 1 }]),
          quoteParams: { taxRate: 1.5 },
        },
      }),
    ).rejects.toThrow("quoteParams.taxRate 必须在 0 到 1 之间");
  });
});
