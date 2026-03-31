import { afterEach, describe, expect, it } from "bun:test";
import { runTool } from "../../../mcp/bom-mcp/src/index";
import {
  extractDigikeyCnCandidateOptions,
  extractDigikeyCnOffer,
  extractIckeyCnCandidateOptions,
  extractIckeyCnOffer,
  extractIcNetOffer,
  extractIcNetCandidateOptions,
  lookupWebCandidates,
  lookupWebPrice,
  lookupWebPriceDetailed,
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

  it("extracts a DigiKey CN offer from product detail HTML with USD pricing", () => {
    const offer = extractDigikeyCnOffer(
      `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "CL10A106KP8NNNC",
              "mpn": "CL10A106KP8NNNC",
              "url": "https://www.digikey.cn/zh/products/detail/samsung-electro-mechanics/CL10A106KP8NNNC/3886850",
              "offers": {
                "@type": "Offer",
                "priceCurrency": "USD",
                "price": "0.18"
              }
            }
          </script>
        </head>
        <body>
          <h1>CL10A106KP8NNNC</h1>
          <div>制造商产品编号 CL10A106KP8NNNC</div>
          <div>所有价格均以 USD 计算</div>
          <div>数量</div>
          <div>单价</div>
          <div>总价</div>
          <div>1</div>
          <div>$0.18000</div>
          <div>$0.18</div>
        </body>
      </html>
      `,
      "CL10A106KP8NNNC",
      "https://www.digikey.cn/zh/products/detail/samsung-electro-mechanics/CL10A106KP8NNNC/3886850",
    );

    expect(offer?.unitPrice).toBe(0.18);
    expect(offer?.currency).toBe("USD");
    expect(offer?.url).toContain("/products/detail/");
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

  it("extracts an ICkey CN candidate list from public new-search HTML", () => {
    const options = extractIckeyCnCandidateOptions(
      `
      <div class="search-r-list">
        <div class="search-th-name">TPS5430DDAR</div>
        <div class="search-th-info"></div>
        <div class="search-th-maf">TI</div>
        <div class="search-th-explain" title="Reel">Reel</div>
        <div class="search-th-stock">
          <div class="text-search">39800</div>
          <div>1片起订</div>
        </div>
        <div class="search-th-delivery">
          <div></div>
          <div>内地:3-5工作日</div>
        </div>
        <div class="search-th-oper">
          <div class="new-price-btn" data-href="//search.ickey.cn/site/index.html?keyword=TPS5430DDAR">查看价格</div>
        </div>
      </div>
      <div class="search-r-list">
        <div class="search-th-name">TPS5430DDARG4</div>
        <div class="search-th-info"></div>
        <div class="search-th-maf">TI</div>
        <div class="search-th-explain" title=""></div>
        <div class="search-th-stock">
          <div class="text-search">0</div>
          <div>2500片起订</div>
        </div>
        <div class="search-th-delivery">
          <div></div>
          <div>内地:6-8周</div>
        </div>
        <div class="search-th-oper">
          <div class="new-price-btn" data-href="//search.ickey.cn/site/index.html?keyword=TPS5430DDARG4">查看价格</div>
        </div>
      </div>
      `,
      "https://www.ickey.cn/new-search/TPS5430DDAR/",
    );

    expect(options).toHaveLength(2);
    expect(options[0]?.supplier).toBe("ickey_cn");
    expect(options[0]?.partNumber).toBe("TPS5430DDAR");
    expect(options[0]?.manufacturer).toBe("TI");
    expect(options[0]?.moq).toBe(1);
    expect(options[0]?.leadTime).toBe("内地:3-5工作日");
    expect(options[0]?.note).toContain("库存 39800");
  });

  it("does not return an ICkey CN offer when the public page only shows view-price actions", () => {
    const offer = extractIckeyCnOffer(
      `
      <div class="search-r-list">
        <div class="search-th-name">STM32F103C8T6</div>
        <div class="search-th-maf">ST</div>
        <div class="search-th-stock">
          <div class="text-search">89</div>
          <div>25片起订</div>
        </div>
        <div class="search-th-delivery">
          <div></div>
          <div>内地:4-7工作日</div>
        </div>
        <div class="search-th-oper">
          <div class="new-price-btn" data-href="//search.ickey.cn/site/index.html?keyword=STM32F103C8T6">查看价格</div>
        </div>
      </div>
      `,
      "STM32F103C8T6",
      "https://www.ickey.cn/new-search/STM32F103C8T6/",
    );

    expect(offer).toBeNull();
  });

  it("ignores ICkey related-result search pages that only show no-result messaging", () => {
    const options = extractIckeyCnCandidateOptions(
      `
      <div class="js_empty_parse_result fs-16">
        <span class="js_result_text">未找到与“<span>VKMD1001J680MV</span>”相匹配的商品，已为您返回相关结果</span>
      </div>
      <div class="search-no-result-news row mt30">
        <div class="tit-tips">很抱歉，未找到“<em>VKMD1001J680MV</em>”相关商品</div>
      </div>
      <div class="category-links">
        <a href="/cate/rs485">RS485/RS422芯片</a>
        <a href="/cate/module">4G/3G/2G/NB模块</a>
      </div>
      `,
      "https://search.ickey.cn/?keyword=VKMD1001J680MV",
    );

    expect(options).toEqual([]);
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

  it("does not infer DigiKey candidates from unrelated page copy", () => {
    const options = extractDigikeyCnCandidateOptions(
      `
      <html>
        <body>
          <a href="/zh/my-digikey">您好 {0} 我的 DigiKey</a>
          <a href="/relay/power">功率继电器，高于 2 A</a>
          <a href="/relay/signal">信号继电器，高达 2 A</a>
          <a href="/beian">沪ICP备19034648号-1</a>
        </body>
      </html>
      `,
      "https://www.digikey.cn/zh/products/result?keywords=CR2032%20MFR%20SM",
    );

    expect(options).toEqual([]);
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
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalConfigPath = process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
    delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
    process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = `/tmp/openclaw-bom-no-cdp-${Date.now()}.json`;

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

    try {
      const offer = await lookupWebPrice("STM32F103C8T6", ["digikey_cn", "ic_net"], fetchMock);
      const candidates = await lookupWebCandidates("STM32F103C8T6", ["digikey_cn", "ic_net"], fetchMock);

      expect(offer?.supplier).toBe("ic_net");
      expect(offer?.unitPrice).toBe(6.66);
      expect(candidates[0]?.partNumber).toBe("STM32F103C8T6");
    } finally {
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
      if (originalConfigPath === undefined) {
        delete process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
      } else {
        process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = originalConfigPath;
      }
    }
  });

  it("falls back to ICkey CN candidates when DigiKey has no usable results", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalConfigPath = process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
    delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
    process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = `/tmp/openclaw-bom-no-cdp-${Date.now()}.json`;

    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("digikey.cn")) {
        return new Response(
          `
          <html>
            <body>
              <div>0 results</div>
            </body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.includes("ickey.cn")) {
        return new Response(
          `
          <div class="search-r-list">
            <div class="search-th-name">TPS5430DDAR</div>
            <div class="search-th-info"></div>
            <div class="search-th-maf">TI</div>
            <div class="search-th-explain" title=""></div>
            <div class="search-th-stock">
              <div class="text-search">39800</div>
              <div>1片起订</div>
            </div>
            <div class="search-th-delivery">
              <div></div>
              <div>内地:3-5工作日</div>
            </div>
            <div class="search-th-oper">
              <div class="new-price-btn" data-href="//search.ickey.cn/site/index.html?keyword=TPS5430DDAR">查看价格</div>
            </div>
          </div>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    try {
      const offer = await lookupWebPrice("TPS5430DDAR", ["digikey_cn", "ickey_cn"], fetchMock);
      const candidates = await lookupWebCandidates("TPS5430DDAR", ["digikey_cn", "ickey_cn"], fetchMock);
      const detailed = await lookupWebPriceDetailed("TPS5430DDAR", ["digikey_cn", "ickey_cn"], fetchMock);

      expect(offer).toBeNull();
      expect(candidates[0]?.partNumber).toBe("TPS5430DDAR");
      expect(candidates[0]?.manufacturer).toBe("TI");
      expect(candidates[0]?.moq).toBe(1);
      expect(candidates[0]?.leadTime).toBe("内地:3-5工作日");
      expect(detailed.attempts.some((attempt) => attempt.supplier === "ickey_cn")).toBe(true);
    } finally {
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
      if (originalConfigPath === undefined) {
        delete process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
      } else {
        process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = originalConfigPath;
      }
    }
  });

  it("prefers ICkey CN candidate results before DigiKey by default", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalConfigPath = process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
    delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
    process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = `/tmp/openclaw-bom-no-cdp-${Date.now()}.json`;

    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("ickey.cn")) {
        return new Response(
          `
          <div class="search-r-list">
            <div class="search-th-name">TPS5430DDAR</div>
            <div class="search-th-info"></div>
            <div class="search-th-maf">TI</div>
            <div class="search-th-explain" title=""></div>
            <div class="search-th-stock">
              <div class="text-search">39800</div>
              <div>1片起订</div>
            </div>
            <div class="search-th-delivery">
              <div></div>
              <div>内地:3-5工作日</div>
            </div>
            <div class="search-th-oper">
              <div class="new-price-btn" data-href="//search.ickey.cn/site/index.html?keyword=TPS5430DDAR">查看价格</div>
            </div>
          </div>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.includes("digikey.cn")) {
        return new Response(
          `
          <html>
            <body>
              <div class="candidate">
                <div class="mfr">Alt Vendor</div>
                <a href="/detail/DIGI-ALT-001">DIGI-ALT-001</a>
                <div class="price">¥9.99</div>
              </div>
            </body>
          </html>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    try {
      const candidates = await lookupWebCandidates("TPS5430DDAR", undefined, fetchMock);

      expect(candidates[0]?.partNumber).toBe("TPS5430DDAR");
      expect(candidates[0]?.manufacturer).toBe("TI");
      expect(candidates[0]?.moq).toBe(1);
    } finally {
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
      if (originalConfigPath === undefined) {
        delete process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
      } else {
        process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = originalConfigPath;
      }
    }
  });

  it("skips ICkey legacy keyword search for ambiguous non-part-number queries", async () => {
    const requestedUrls: string[] = [];
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/new-search/")) {
        return new Response("<html><body><div>no results</div></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url.includes("search.ickey.cn")) {
        return new Response(
          `
          <div class="category-links">
            <a href="/cate/rs485">RS485/RS422芯片</a>
            <a href="/cate/module">4G/3G/2G/NB模块</a>
          </div>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    const candidates = await lookupWebCandidates("CR2032 MFR SM", ["ickey_cn"], fetchMock);

    expect(candidates).toEqual([]);
    expect(requestedUrls.some((url) => url.includes("search.ickey.cn"))).toBe(false);
  });

  it("does not infer ICkey candidates from generic page text when no result blocks exist", () => {
    const options = extractIckeyCnCandidateOptions(
      `
      <div class="search-no-result-news row mt30">
        <div class="tit-tips">很抱歉，未找到“<em>CR2032 MFR SM battery</em>”相关商品</div>
      </div>
      <div class="category-links">
        <a href="/cate/rs485">RS485/RS422芯片</a>
        <a href="/cate/module">4G/3G/2G/NB模块</a>
      </div>
      `,
      "https://www.ickey.cn/new-search/CR2032%20MFR%20SM%20battery/",
    );

    expect(options).toEqual([]);
  });

  it("classifies IC Net login redirects as auth-required blocking", async () => {
    const result = await lookupWebPriceDetailed(
      "STM32F103C8T6",
      ["ic_net"],
      (async () =>
        new Response(
          `
          <script type="text/javascript">
            document.write('<table></table>');
            gotoUrl('https://member.ic.net.cn/login.php?from=www.ic.net.cn/search.php%3Fkeys%3DSTM32F103C8T6');
          </script>
          `,
          { status: 200, headers: { "content-type": "text/html" } },
        )) as typeof fetch,
    );

    expect(result.offer).toBeNull();
    expect(result.attempts[0]?.status).toBe("blocked");
    expect(result.attempts[0]?.blockReason).toBe("login_required");
  });

  it("sends supplier cookie headers from environment overrides", async () => {
    const originalCookie = process.env.BOM_MCP_WEB_IC_NET_COOKIE;
    process.env.BOM_MCP_WEB_IC_NET_COOKIE = "session=abc123";

    let receivedCookie: string | null = null;

    try {
      const result = await lookupWebPriceDetailed(
        "TPS5430DDAR",
        ["ic_net"],
        (async (_input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          receivedCookie = headers.get("cookie");
          return new Response(
            `
            <html>
              <body>
                <div>型号：TPS5430DDAR</div>
                <div>参考价：￥8.66</div>
              </body>
            </html>
            `,
            { status: 200, headers: { "content-type": "text/html" } },
          );
        }) as typeof fetch,
      );

      expect(receivedCookie).toBe("session=abc123");
      expect(result.offer?.supplier).toBe("ic_net");
      expect(result.offer?.unitPrice).toBe(8.66);
    } finally {
      if (originalCookie === undefined) {
        delete process.env.BOM_MCP_WEB_IC_NET_COOKIE;
      } else {
        process.env.BOM_MCP_WEB_IC_NET_COOKIE = originalCookie;
      }
    }
  });

  it("prefers DigiKey CDP page content before HTTP fallback", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalFetch = globalThis.fetch;
    const httpBase = "http://127.0.0.1:43123";
    const pageHtml = `
      <html>
        <body>
          <a href="/zh/products/detail/example/STM32F103C8T6/123456">STM32F103C8T6</a>
          <div>价格阶梯</div>
          <div>1: ¥5.55</div>
        </body>
      </html>
    `;

    process.env.BOM_MCP_DIGIKEY_CDP_URL = httpBase;

    using server = Bun.serve({
      port: 43123,
      fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/json/version") {
          return Response.json({
            webSocketDebuggerUrl: `ws://127.0.0.1:43123/devtools/browser/test`,
          });
        }
        if (url.pathname === "/devtools/browser/test") {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("upgrade failed", { status: 500 });
        }
        return new Response("not found", { status: 404 });
      },
      websocket: {
        open(ws) {
          ws.subscribe("cdp");
        },
        message(ws, raw) {
          const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
          const message = JSON.parse(text) as { id?: number; method?: string; params?: Record<string, unknown> };
          switch (message.method) {
            case "Target.createTarget":
              ws.send(JSON.stringify({ id: message.id, result: { targetId: "target-1" } }));
              return;
            case "Target.attachToTarget":
              ws.send(JSON.stringify({ id: message.id, result: { sessionId: "session-1" } }));
              return;
            case "Page.enable":
            case "Runtime.enable":
            case "DOM.enable":
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
              return;
            case "Page.navigate":
              ws.send(JSON.stringify({ id: message.id, result: { frameId: "frame-1" }, sessionId: "session-1" }));
              ws.send(JSON.stringify({ method: "Page.loadEventFired", params: {}, sessionId: "session-1" }));
              return;
            case "Runtime.evaluate":
              ws.send(
                JSON.stringify({
                  id: message.id,
                  result: { result: { type: "string", value: pageHtml } },
                  sessionId: "session-1",
                }),
              );
              return;
            case "Target.closeTarget":
              ws.send(JSON.stringify({ id: message.id, result: { success: true } }));
              return;
            default:
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
          }
        },
      },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(httpBase)) {
        return originalFetch(input, init);
      }
      throw new Error(`unexpected non-CDP fetch: ${url}`);
    }) as typeof fetch;

    try {
      const offer = await lookupWebPrice("STM32F103C8T6", ["digikey_cn"]);
      expect(offer?.supplier).toBe("digikey_cn");
      expect(offer?.unitPrice).toBe(5.55);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
    }
  });

  it("uses DigiKey CDP page content for candidate lookup before HTTP fallback", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalFetch = globalThis.fetch;
    const httpBase = "http://127.0.0.1:43127";
    const pageHtml = `
      <html>
        <body>
          <div class="candidate">
            <div class="mfr">YMIN</div>
            <a href="/detail/VKMD1001J680MV">VKMD1001J680MV</a>
            <div>¥1.23</div>
          </div>
          <div class="candidate">
            <div class="mfr">Samsung Electro-Mechanics</div>
            <a href="/detail/CS3225X5R476K160NRL">CS3225X5R476K160NRL</a>
            <div>¥0.88</div>
          </div>
        </body>
      </html>
    `;

    process.env.BOM_MCP_DIGIKEY_CDP_URL = httpBase;

    using server = Bun.serve({
      port: 43127,
      fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/json/version") {
          return Response.json({
            webSocketDebuggerUrl: `ws://127.0.0.1:43127/devtools/browser/test`,
          });
        }
        if (url.pathname === "/devtools/browser/test") {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("upgrade failed", { status: 500 });
        }
        return new Response("not found", { status: 404 });
      },
      websocket: {
        message(ws, raw) {
          const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
          const message = JSON.parse(text) as { id?: number; method?: string };
          switch (message.method) {
            case "Target.createTarget":
              ws.send(JSON.stringify({ id: message.id, result: { targetId: "target-1" } }));
              return;
            case "Target.attachToTarget":
              ws.send(JSON.stringify({ id: message.id, result: { sessionId: "session-1" } }));
              return;
            case "Page.enable":
            case "Runtime.enable":
            case "DOM.enable":
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
              return;
            case "Page.navigate":
              ws.send(JSON.stringify({ id: message.id, result: { frameId: "frame-1" }, sessionId: "session-1" }));
              return;
            case "Runtime.evaluate":
              ws.send(
                JSON.stringify({
                  id: message.id,
                  result: {
                    result: {
                      type: "string",
                      value: JSON.stringify({
                        html: pageHtml,
                        url: "https://www.digikey.cn/zh/products/result?keywords=68u",
                      }),
                    },
                  },
                  sessionId: "session-1",
                }),
              );
              return;
            case "Target.closeTarget":
              ws.send(JSON.stringify({ id: message.id, result: { success: true } }));
              return;
            default:
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
          }
        },
      },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(httpBase)) {
        return originalFetch(input, init);
      }
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
      throw new Error(`unexpected url: ${url}`);
    }) as typeof fetch;

    try {
      const candidates = await lookupWebCandidates("68u", ["digikey_cn"]);
      expect(candidates).toHaveLength(2);
      expect(candidates[0]?.partNumber).toBe("VKMD1001J680MV");
      expect(candidates[0]?.manufacturer).toBe("YMIN");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
    }
  });

  it("returns DigiKey detail-page price, currency, and final URL from CDP", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalFetch = globalThis.fetch;
    const httpBase = "http://127.0.0.1:43126";
    const finalUrl = "https://www.digikey.cn/zh/products/detail/samsung-electro-mechanics/CL10A106KP8NNNC/3886850";
    const pageHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "CL10A106KP8NNNC",
              "mpn": "CL10A106KP8NNNC",
              "url": "https://www.digikey.cn/zh/products/detail/samsung-electro-mechanics/CL10A106KP8NNNC/3886850",
              "offers": {
                "@type": "Offer",
                "priceCurrency": "USD",
                "price": "0.18"
              }
            }
          </script>
        </head>
        <body>
          <h1>CL10A106KP8NNNC</h1>
          <div>所有价格均以 USD 计算</div>
          <div>数量</div>
          <div>单价</div>
          <div>总价</div>
          <div>1</div>
          <div>$0.18000</div>
          <div>$0.18</div>
        </body>
      </html>
    `;

    process.env.BOM_MCP_DIGIKEY_CDP_URL = httpBase;

    using server = Bun.serve({
      port: 43126,
      fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/json/version") {
          return Response.json({
            webSocketDebuggerUrl: `ws://127.0.0.1:43126/devtools/browser/test`,
          });
        }
        if (url.pathname === "/devtools/browser/test") {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("upgrade failed", { status: 500 });
        }
        return new Response("not found", { status: 404 });
      },
      websocket: {
        message(ws, raw) {
          const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
          const message = JSON.parse(text) as {
            id?: number;
            method?: string;
            params?: Record<string, unknown>;
          };
          switch (message.method) {
            case "Target.createTarget":
              ws.send(JSON.stringify({ id: message.id, result: { targetId: "target-1" } }));
              return;
            case "Target.attachToTarget":
              ws.send(JSON.stringify({ id: message.id, result: { sessionId: "session-1" } }));
              return;
            case "Page.enable":
            case "Runtime.enable":
            case "DOM.enable":
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
              return;
            case "Page.navigate":
              ws.send(JSON.stringify({ id: message.id, result: { frameId: "frame-1" }, sessionId: "session-1" }));
              return;
            case "Runtime.evaluate":
              if (String(message.params?.expression).includes("JSON.stringify")) {
                ws.send(
                  JSON.stringify({
                    id: message.id,
                    result: {
                      result: {
                        type: "string",
                        value: JSON.stringify({ html: pageHtml, url: finalUrl }),
                      },
                    },
                    sessionId: "session-1",
                  }),
                );
                return;
              }
              ws.send(
                JSON.stringify({
                  id: message.id,
                  result: { result: { type: "string", value: pageHtml } },
                  sessionId: "session-1",
                }),
              );
              return;
            case "Target.closeTarget":
              ws.send(JSON.stringify({ id: message.id, result: { success: true } }));
              return;
            default:
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
          }
        },
      },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(httpBase)) {
        return originalFetch(input, init);
      }
      throw new Error(`unexpected non-CDP fetch: ${url}`);
    }) as typeof fetch;

    try {
      const result = await lookupWebPriceDetailed("CL10A106KP8NNNC", ["digikey_cn"]);
      expect(result.offer?.supplier).toBe("digikey_cn");
      expect(result.offer?.unitPrice).toBe(0.18);
      expect(result.offer?.currency).toBe("USD");
      expect(result.offer?.url).toBe(finalUrl);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
    }
  });

  it("reads DigiKey CDP base URL from local openclaw browser config", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalConfigPath = process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
    const originalFetch = globalThis.fetch;
    const configPath = `/tmp/openclaw-bom-cdp-${Date.now()}.json`;
    const pageHtml = `
      <html>
        <body>
          <a href="/zh/products/detail/example/LM1117IMPX/123456">LM1117IMPX</a>
          <div>价格阶梯</div>
          <div>1: ¥3.21</div>
        </body>
      </html>
    `;

    delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
    process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = configPath;
    await Bun.write(
      configPath,
      JSON.stringify({
        browser: {
          cdpUrl: "http://127.0.0.1:43125",
        },
      }),
    );

    using server = Bun.serve({
      port: 43125,
      fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/json/version") {
          return Response.json({
            webSocketDebuggerUrl: `ws://127.0.0.1:43125/devtools/browser/test`,
          });
        }
        if (url.pathname === "/devtools/browser/test") {
          if (server.upgrade(req)) {
            return;
          }
          return new Response("upgrade failed", { status: 500 });
        }
        return new Response("not found", { status: 404 });
      },
      websocket: {
        message(ws, raw) {
          const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf-8");
          const message = JSON.parse(text) as { id?: number; method?: string };
          switch (message.method) {
            case "Target.createTarget":
              ws.send(JSON.stringify({ id: message.id, result: { targetId: "target-1" } }));
              return;
            case "Target.attachToTarget":
              ws.send(JSON.stringify({ id: message.id, result: { sessionId: "session-1" } }));
              return;
            case "Page.enable":
            case "Runtime.enable":
            case "DOM.enable":
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
              return;
            case "Page.navigate":
              ws.send(JSON.stringify({ id: message.id, result: { frameId: "frame-1" }, sessionId: "session-1" }));
              return;
            case "Runtime.evaluate":
              ws.send(JSON.stringify({ id: message.id, result: { result: { type: "string", value: pageHtml } }, sessionId: "session-1" }));
              return;
            case "Target.closeTarget":
              ws.send(JSON.stringify({ id: message.id, result: { success: true } }));
              return;
            default:
              ws.send(JSON.stringify({ id: message.id, result: {}, sessionId: "session-1" }));
          }
        },
      },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("http://127.0.0.1:43125")) {
        return originalFetch(input, init);
      }
      throw new Error(`unexpected non-CDP fetch: ${url}`);
    }) as typeof fetch;

    try {
      const offer = await lookupWebPrice("LM1117IMPX", ["digikey_cn"]);
      expect(offer?.supplier).toBe("digikey_cn");
      expect(offer?.unitPrice).toBe(3.21);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
      if (originalConfigPath === undefined) {
        delete process.env.BOM_MCP_OPENCLAW_CONFIG_PATH;
      } else {
        process.env.BOM_MCP_OPENCLAW_CONFIG_PATH = originalConfigPath;
      }
      await Bun.file(configPath).delete().catch(() => {});
    }
  });

  it("falls back to DigiKey HTTP fetch when CDP is unavailable", async () => {
    const originalCdpUrl = process.env.BOM_MCP_DIGIKEY_CDP_URL;
    const originalFetch = globalThis.fetch;
    process.env.BOM_MCP_DIGIKEY_CDP_URL = "http://127.0.0.1:43124";

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("http://127.0.0.1:43124")) {
        throw new Error("cdp unavailable");
      }
      if (!url.includes("digikey.cn")) {
        throw new Error(`unexpected url: ${url}`);
      }
      return new Response(
        `
        <html>
          <body>
            <a href="/zh/products/detail/example/TPS7A4901/123456">TPS7A4901</a>
            <div>价格阶梯</div>
            <div>1: ¥9.91</div>
          </body>
        </html>
        `,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }) as typeof fetch;

    try {
      const offer = await lookupWebPrice("TPS7A4901", ["digikey_cn"]);
      expect(offer?.supplier).toBe("digikey_cn");
      expect(offer?.unitPrice).toBe(9.91);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalCdpUrl === undefined) {
        delete process.env.BOM_MCP_DIGIKEY_CDP_URL;
      } else {
        process.env.BOM_MCP_DIGIKEY_CDP_URL = originalCdpUrl;
      }
    }
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
