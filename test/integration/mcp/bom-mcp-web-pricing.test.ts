import { afterEach, describe, expect, it } from "bun:test";
import { runTool } from "../../../mcp/bom-mcp/src/index";
import {
  extractDigikeyCnCandidateOptions,
  extractDigikeyCnOffer,
  extractIcNetOffer,
  extractIcNetCandidateOptions,
  lookupWebCandidates,
  lookupWebPrice,
} from "../../../mcp/bom-mcp/src/domain/web-pricing";

const originalFetch = globalThis.fetch;

async function waitForSucceededJob(jobId: string): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    const status = (await runTool({
      tool: "get_bom_job_result",
      args: { jobId },
    })) as { status: string };
    if (status.status === "succeeded") {
      return;
    }
    await Bun.sleep(10);
  }
  throw new Error(`job did not reach succeeded state in time: ${jobId}`);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("bom-mcp web pricing", () => {
  it("extracts a DigiKey CN offer from HTML", () => {
    const offer = extractDigikeyCnOffer(
      `
      <html>
        <body>
          <a href="/zh/products/detail/example/ATSAMD21G18A/123456">ATSAMD21G18A</a>
          <div>价格阶梯</div>
          <div>1: ¥12.34</div>
          <div>10: ¥11.20</div>
        </body>
      </html>
      `,
      "ATSAMD21G18A",
      "https://www.digikey.cn/zh/products/result?keywords=ATSAMD21G18A",
    );

    expect(offer?.unitPrice).toBe(12.34);
    expect(offer?.supplier).toBe("digikey_cn");
  });

  it("extracts an IC.net market offer from HTML", () => {
    const offer = extractIcNetOffer(
      `
      <html>
        <body>
          <div>型号：TPS5430DDAR</div>
          <div>参考价：￥8.66</div>
          <div>供应商：深圳某电子</div>
        </body>
      </html>
      `,
      "TPS5430DDAR",
      "https://www.ic.net.cn/search.php?keys=TPS5430DDAR",
    );

    expect(offer?.unitPrice).toBe(8.66);
    expect(offer?.supplier).toBe("ic_net");
  });

  it("extracts candidate options from nested DigiKey-style result cards", () => {
    const options = extractDigikeyCnCandidateOptions(
      `
      <html>
        <body>
          <div class="candidate">
            <div class="mfr">YMIN</div>
            <div class="content">
              <a href="/detail/VKMD1001J680MV">VKMD1001J680MV</a>
            </div>
            <div class="price">¥1.23</div>
          </div>
        </body>
      </html>
      `,
      "https://www.digikey.cn/zh/products/result?keywords=68u",
    );

    expect(options).toHaveLength(1);
    expect(options[0]?.partNumber).toBe("VKMD1001J680MV");
    expect(options[0]?.manufacturer).toBe("YMIN");
    expect(options[0]?.unitPrice).toBe(1.23);
  });

  it("does not reuse another card price for an exact part with nested anchor markup", () => {
    const offer = extractDigikeyCnOffer(
      `
      <html>
        <body>
          <div class="candidate">
            <div class="mfr">Alt Vendor</div>
            <a href="/detail/ALT-PART-001">ALT-PART-001</a>
            <div class="price">¥9.99</div>
          </div>
          <div class="candidate">
            <div class="mfr">Exact Vendor</div>
            <a href="/detail/EXACTPART123"><span>EXACTPART123</span></a>
          </div>
        </body>
      </html>
      `,
      "EXACTPART123",
      "https://www.digikey.cn/zh/products/result?keywords=EXACTPART123",
    );

    expect(offer).toBeNull();
  });

  it("ignores DigiKey Cloudflare challenge pages", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en-US">
        <head>
          <title>Just a moment...</title>
        </head>
        <body>
          <div id="cf-challenge-running">cloudflare</div>
          <a href="/detail/STM32F103C8T6">STM32F103C8T6</a>
          <div>1: ¥12.34</div>
        </body>
      </html>
    `;

    expect(extractDigikeyCnOffer(html, "STM32F103C8T6", "u")).toBeNull();
    expect(extractDigikeyCnCandidateOptions(html, "u")).toEqual([]);
  });

  it("ignores IC Net obfuscated anti-bot pages", () => {
    const html = `
      <script type="text/javascript">
        icic=~[];
        icic={$_$$:++icic,$__:(![]+"")[icic],__$:++icic,_:(![]+"")[icic]};
      </script>
      3DSTM32F103C8T6
    `;

    expect(extractIcNetOffer(html, "STM32F103C8T6", "u")).toBeNull();
    expect(extractIcNetCandidateOptions(html, "u")).toEqual([]);
  });

  it("falls back to the next supplier when the first web page is blocked", async () => {
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("digikey.cn")) {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
            <head><title>Just a moment...</title></head>
            <body><div>cloudflare challenge</div></body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.includes("ic.net.cn")) {
        return new Response(
          `
          <html>
            <body>
              <div>型号：STM32F103C8T6</div>
              <div>参考价：￥6.66</div>
            </body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    const offer = await lookupWebPrice("STM32F103C8T6", ["digikey_cn", "ic_net"], fetchMock);
    const candidates = await lookupWebCandidates("STM32F103C8T6", ["digikey_cn", "ic_net"], fetchMock);

    expect(offer?.supplier).toBe("ic_net");
    expect(offer?.unitPrice).toBe(6.66);
    expect(candidates[0]?.partNumber).toBe("STM32F103C8T6");
  });

  it("uses DigiKey CN web pricing when enabled and no local price exists", async () => {
    const startedAt = Date.now();
    const partNumber = `ATSAMD21G18A-${Date.now()}`;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("digikey.cn")) {
        throw new Error(`unexpected url: ${url}`);
      }
      await Bun.sleep(40);
      return new Response(
        `
        <html>
          <body>
            <a href="/zh/products/detail/example/${partNumber}/123456">${partNumber}</a>
            <div>价格阶梯</div>
            <div>1: ¥12.34</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }) as typeof fetch;

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([{ partNumber, quantity: 5 }]),
        quoteParams: {
          currency: "CNY",
          taxRate: 0,
          webPricing: true,
          webSuppliers: ["digikey_cn"],
        },
      },
    })) as { jobId: string };

    await waitForSucceededJob(submitResult.jobId);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{
        unitPrice?: number;
        priceSource?: string;
        priceUpdatedAt?: string;
        priceConfidence?: string;
        decisionType: string;
      }>;
      pendingDecisions: Array<unknown>;
    };

    expect(quote.status).toBe("completed");
    expect(quote.lines[0]?.unitPrice).toBe(12.34);
    expect(quote.lines[0]?.priceSource).toBe("digikey_cn");
    expect(quote.lines[0]?.priceUpdatedAt).toBeTruthy();
    expect(Date.parse(quote.lines[0]?.priceUpdatedAt ?? "") - startedAt).toBeGreaterThanOrEqual(20);
    expect(quote.lines[0]?.priceConfidence).toBe("medium");
    expect(quote.lines[0]?.decisionType).toBe("resolved");
    expect(quote.pendingDecisions).toHaveLength(0);
  });

  it("uses IC Net web pricing metadata when enabled and no local price exists", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("ic.net.cn")) {
        throw new Error(`unexpected url: ${url}`);
      }
      return new Response(
        `
        <html>
          <body>
            <div>型号：TPS5430DDAR</div>
            <div>参考价：￥8.66</div>
            <div>供应商：深圳某电子</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }) as typeof fetch;

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([{ partNumber: "TPS5430DDAR", quantity: 3 }]),
        quoteParams: {
          currency: "CNY",
          taxRate: 0,
          webPricing: true,
          webSuppliers: ["ic_net"],
        },
      },
    })) as { jobId: string };

    await waitForSucceededJob(submitResult.jobId);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      lines: Array<{
        unitPrice?: number;
        priceSource?: string;
        priceUpdatedAt?: string;
        priceConfidence?: string;
        decisionType: string;
      }>;
      pendingDecisions: Array<unknown>;
    };

    expect(quote.status).toBe("completed");
    expect(quote.lines[0]?.unitPrice).toBe(8.66);
    expect(quote.lines[0]?.priceSource).toBe("ic_net");
    expect(quote.lines[0]?.priceUpdatedAt).toBeTruthy();
    expect(quote.lines[0]?.priceConfidence).toBe("low");
    expect(quote.lines[0]?.decisionType).toBe("resolved");
    expect(quote.pendingDecisions).toHaveLength(0);
  });

  it("preserves pending decision order when async web lookups finish out of order", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("SLOWPART123")) {
        await Bun.sleep(30);
      }
      return new Response("<html><body>no price</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;

    const submitResult = (await runTool({
      tool: "submit_bom",
      args: {
        sourceType: "json",
        content: JSON.stringify([
          { partNumber: "SLOWPART123", quantity: 1 },
          { partNumber: "FASTPART123", quantity: 1 },
        ]),
        quoteParams: {
          currency: "CNY",
          taxRate: 0,
          webPricing: true,
          webSuppliers: ["digikey_cn"],
        },
      },
    })) as { jobId: string };

    await waitForSucceededJob(submitResult.jobId);

    const quote = (await runTool({
      tool: "get_quote",
      args: { jobId: submitResult.jobId },
    })) as {
      status: string;
      pendingDecisions: Array<{ lineNo: number; decisionType: string }>;
    };

    expect(quote.status).toBe("completed_with_decisions");
    expect(quote.pendingDecisions.map((decision) => decision.lineNo)).toEqual([1, 2]);
    expect(quote.pendingDecisions[0]?.decisionType).toBe("missing_reliable_price");
    expect(quote.pendingDecisions[1]?.decisionType).toBe("missing_reliable_price");
  });
});
