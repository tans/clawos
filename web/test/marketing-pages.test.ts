import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { resolve } from "node:path";

let app: typeof import("../src/index").app;
const webRoot = resolve(import.meta.dir, "..");
const builtCssPath = resolve(webRoot, "dist", "output.css");

describe("marketing pages", () => {
  let marketplaceEnabledSnapshot: string | undefined;
  let marketPortalUrlSnapshot: string | undefined;
  let adminUsernameSnapshot: string | undefined;
  let adminPasswordSnapshot: string | undefined;
  let oemSiteNameSnapshot: string | undefined;
  let oemSeoTitleSnapshot: string | undefined;
  let oemSeoDescriptionSnapshot: string | undefined;
  let oemSeoKeywordsSnapshot: string | undefined;

  beforeAll(async () => {
    if (!process.env.CLAWOS_WEB_ROOT) {
      process.env.CLAWOS_WEB_ROOT = webRoot;
    }

    ({ app } = await import("../src/index"));
  });

  beforeEach(async () => {
    marketplaceEnabledSnapshot = process.env.MARKETPLACE_ENABLED;
    marketPortalUrlSnapshot = process.env.AGENT_MARKET_PORTAL_URL;
    adminUsernameSnapshot = process.env.ADMIN_USERNAME;
    adminPasswordSnapshot = process.env.ADMIN_PASSWORD;
    oemSiteNameSnapshot = process.env.OEM_SITE_NAME;
    oemSeoTitleSnapshot = process.env.OEM_SEO_TITLE;
    oemSeoDescriptionSnapshot = process.env.OEM_SEO_DESCRIPTION;
    oemSeoKeywordsSnapshot = process.env.OEM_SEO_KEYWORDS;
  });

  afterEach(async () => {
    if (typeof marketplaceEnabledSnapshot === "undefined") {
      delete process.env.MARKETPLACE_ENABLED;
    } else {
      process.env.MARKETPLACE_ENABLED = marketplaceEnabledSnapshot;
    }
    if (typeof marketPortalUrlSnapshot === "undefined") {
      delete process.env.AGENT_MARKET_PORTAL_URL;
    } else {
      process.env.AGENT_MARKET_PORTAL_URL = marketPortalUrlSnapshot;
    }
    if (typeof adminUsernameSnapshot === "undefined") {
      delete process.env.ADMIN_USERNAME;
    } else {
      process.env.ADMIN_USERNAME = adminUsernameSnapshot;
    }
    if (typeof adminPasswordSnapshot === "undefined") {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = adminPasswordSnapshot;
    }
    if (typeof oemSiteNameSnapshot === "undefined") {
      delete process.env.OEM_SITE_NAME;
    } else {
      process.env.OEM_SITE_NAME = oemSiteNameSnapshot;
    }
    if (typeof oemSeoTitleSnapshot === "undefined") {
      delete process.env.OEM_SEO_TITLE;
    } else {
      process.env.OEM_SEO_TITLE = oemSeoTitleSnapshot;
    }
    if (typeof oemSeoDescriptionSnapshot === "undefined") {
      delete process.env.OEM_SEO_DESCRIPTION;
    } else {
      process.env.OEM_SEO_DESCRIPTION = oemSeoDescriptionSnapshot;
    }
    if (typeof oemSeoKeywordsSnapshot === "undefined") {
      delete process.env.OEM_SEO_KEYWORDS;
    } else {
      process.env.OEM_SEO_KEYWORDS = oemSeoKeywordsSnapshot;
    }

    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();
    const { resetBrandConfigCacheForTests } = await import("../src/lib/branding");
    resetBrandConfigCacheForTests();
  });

  it("renders the homepage as an enterprise conversion page", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("让企业部署可管理、可持续运行的 AI 执行系统");
    expect(html).toContain("申请部署评估");
    expect(html).toContain("了解部署方式");
    expect(html).toContain("ClawOS 与虾壳主机的交付方式");
    expect(html).toContain("虾壳主机");
    expect(html).toContain("企业部署 AI，真正难的不是模型，而是部署与治理");
    expect(html).not.toContain("首页要表达的不是");
    expect(html).not.toContain("首页不再罗列过多产品术语");
    expect(html).not.toContain("PoC");
    expect(html).not.toContain("为什么普通用户也能轻松用");
  });

  it("renders the downloads page as a trial-entry page", async () => {
    const response = await app.request("http://localhost/downloads");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("下载 ClawOS，开始你的企业 AI 试点");
    expect(html).toContain("下载稳定版");
    expect(html).toContain("申请部署评估");
    expect(html).not.toContain("下载中心");

    const headingAnchor = "下载 ClawOS，开始你的企业 AI 试点";
    const headingIndex = html.indexOf(headingAnchor);
    expect(headingIndex).toBeGreaterThan(-1);

    const stableIndex = html.indexOf("下载稳定版", headingIndex);
    const contactIndex = html.indexOf("申请部署评估", headingIndex);
    expect(stableIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeGreaterThan(-1);
    expect(stableIndex).toBeLessThan(contactIndex);
  });

  it("renders the contact page as a consultation page", async () => {
    const response = await app.request("http://localhost/contact");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("申请部署评估");
    expect(html).toContain("部署评估");
    expect(html).toContain("交付与采购");
    expect(html).toContain("基础资料");
    expect(html).not.toContain("商务与合作");
    expect(html).not.toContain("预约 PoC");
  });

  it("keeps enterprise consultation ahead of trial language on the homepage", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    const heroAnchor = "让企业部署可管理、可持续运行的 AI 执行系统";
    const heroIndex = html.indexOf(heroAnchor);
    expect(heroIndex).toBeGreaterThan(-1);

    const assessmentIndex = html.indexOf("申请部署评估", heroIndex);
    const deploymentIndex = html.indexOf("了解部署方式", heroIndex);

    expect(assessmentIndex).toBeGreaterThan(-1);
    expect(deploymentIndex).toBeGreaterThan(-1);
    expect(assessmentIndex).toBeLessThan(deploymentIndex);
  });

  it("uses the fixed top navigation links without homepage anchors", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();
    const navStart = html.indexOf('<nav class="marketing-nav-links"');
    const navEnd = html.indexOf("</nav>", navStart);
    const navHtml = html.slice(navStart, navEnd);

    expect(response.status).toBe(200);
    expect(navStart).toBeGreaterThan(-1);
    expect(navEnd).toBeGreaterThan(navStart);
    expect(navHtml).toContain(">首页<");
    expect(navHtml).toContain('href="/"');
    expect(navHtml).toContain(">下载<");
    expect(navHtml).toContain('href="/downloads"');
    expect(navHtml).toContain(">商城<");
    expect(navHtml).toContain('href="/shop"');
    expect(navHtml).toContain(">任务市场<");
    expect(navHtml).toContain('href="/agent-market"');
    expect(navHtml).toContain(">联系我们<");
    expect(navHtml).toContain('href="/contact"');
    expect(navHtml).not.toContain('href="/#architecture"');
    expect(navHtml).not.toContain('href="/#capabilities"');
    expect(navHtml).not.toContain('href="/#solutions"');
    expect(navHtml).not.toContain('href="/#governance"');
  });

  it("keeps the task market entry in top navigation when marketplace is enabled", async () => {
    process.env.MARKETPLACE_ENABLED = "1";
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(">任务市场<");
    expect(html).toContain("href=\"/agent-market\"");

    const navHomeIndex = html.indexOf(">首页<");
    const navDownloadsIndex = html.indexOf(">下载<", navHomeIndex);
    const navShopIndex = html.indexOf(">商城<", navHomeIndex);
    const navMarketIndex = html.indexOf(">任务市场<", navHomeIndex);
    const navContactIndex = html.indexOf(">联系我们<", navHomeIndex);
    expect(navHomeIndex).toBeGreaterThan(-1);
    expect(navDownloadsIndex).toBeGreaterThan(-1);
    expect(navShopIndex).toBeGreaterThan(-1);
    expect(navMarketIndex).toBeGreaterThan(-1);
    expect(navContactIndex).toBeGreaterThan(-1);
    expect(navHomeIndex).toBeLessThan(navDownloadsIndex);
    expect(navDownloadsIndex).toBeLessThan(navShopIndex);
    expect(navShopIndex).toBeLessThan(navMarketIndex);
    expect(navMarketIndex).toBeLessThan(navContactIndex);

    const footerMarketIndex = html.lastIndexOf(">Agent 协作<");
    const footerDownloadsIndex = html.lastIndexOf(">下载试用<");
    const footerShopIndex = html.lastIndexOf(">产品商城<");
    expect(footerMarketIndex).toBeGreaterThan(-1);
    expect(footerDownloadsIndex).toBeGreaterThan(-1);
    expect(footerShopIndex).toBeGreaterThan(-1);
    expect(footerMarketIndex).toBeLessThan(footerDownloadsIndex);
    expect(footerDownloadsIndex).toBeLessThan(footerShopIndex);
  });

  it("keeps the task market entry in top navigation when marketplace is disabled", async () => {
    delete process.env.MARKETPLACE_ENABLED;
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(">任务市场<");
    expect(html).toContain("href=\"/agent-market\"");
  });

  it("serves the agent market page", async () => {
    delete process.env.AGENT_MARKET_PORTAL_URL;
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/agent-market");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("market-page");
    expect(html).toContain("market-hero-grid");
    expect(html).toContain("market-hero-panel");
    expect(html).toContain("market-task-grid");
    expect(html).toContain("market-flow-panel");
    expect(html).toContain("market-participant-grid");
    expect(html).toContain("market-final-cta-inner");
    expect(html).toContain("让企业任务更适合由 Agent 协作完成");
    expect(html).toContain("不是增加一个工具，而是建立更清晰的交付方式");
    expect(html).toContain("优先面向这些可被标准化的任务");
    expect(html).toContain("让企业需求与交付能力更高效地匹配");
    expect(html).toContain("从需求到交付，尽量减少不必要的试错");
    expect(html).toContain("适合三类参与方提前进入");
    expect(html).toContain("为什么现在开始建立这类协作关系");
    expect(html).toContain("如果你希望参与这类任务协作，可以先和我们沟通");
    expect(html).toContain("预约合作沟通");
    expect(html).not.toContain('href="https://market.clawos.cc"');
    expect(html).not.toContain("PoC");
    expect(html).not.toContain("抢单");
  });

  it("serves a shop page with published products", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "secret";
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const loginForm = new FormData();
    loginForm.set("username", "admin");
    loginForm.set("password", "secret");
    const loginResponse = await app.request("http://localhost/admin/login", {
      method: "POST",
      body: loginForm,
    });
    const cookie = loginResponse.headers.get("set-cookie") || "";

    const saveForm = new FormData();
    saveForm.set("id", "starter-plan");
    saveForm.set("name", "Starter 套餐");
    saveForm.set("description", "适用于小团队");
    saveForm.set("priceCny", "99/月");
    saveForm.set("link", "https://example.com/starter");
    saveForm.set("published", "true");
    await app.request("http://localhost/admin/products/save", {
      method: "POST",
      headers: { cookie },
      body: saveForm,
    });

    const response = await app.request("http://localhost/shop");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(">商城<");
    expect(html).toContain("Starter 套餐");
    expect(html).toContain("99/月");
    expect(html).toContain("https://example.com/starter");
    expect(html).toContain("立即购买");
  });

  it("injects configurable SEO meta on marketing pages", async () => {
    process.env.OEM_SEO_TITLE = "演示站点";
    process.env.OEM_SEO_DESCRIPTION = "这是自定义 SEO 描述";
    process.env.OEM_SEO_KEYWORDS = "a,b,c";
    process.env.OEM_SITE_NAME = "演示官网";
    const { resetBrandConfigCacheForTests } = await import("../src/lib/branding");
    resetBrandConfigCacheForTests();

    const response = await app.request("http://localhost/shop");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<title>商城 | 演示站点</title>");
    expect(html).toContain('name="description" content="查看 ClawOS 已发布商品与购买入口。"');
    expect(html).toContain('name="keywords" content="a,b,c"');
    expect(html).toContain('property="og:site_name" content="演示官网"');
  });

  it("links the static market page to the standalone portal when configured", async () => {
    process.env.AGENT_MARKET_PORTAL_URL = "https://market.clawos.cc";
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/agent-market");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("进入市场门户");
    expect(html).toContain('href="https://market.clawos.cc"');
    expect(html).toContain("预约合作沟通");
  });

  it("serves the agent market page even when marketplace is disabled", async () => {
    delete process.env.MARKETPLACE_ENABLED;
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/agent-market");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("让企业任务更适合由 Agent 协作完成");
    expect(html).not.toContain("PoC");
    expect(html).not.toContain("抢单");
  });

  it("exposes agent market layout hooks in the stylesheet", async () => {
    const css = await Bun.file(builtCssPath).text();

    expect(css).toContain(".market-page");
    expect(css).toContain(".market-hero-grid");
    expect(css).toContain(".market-hero-panel");
    expect(css).toContain(".market-section");
    expect(css).toContain(".market-task-grid");
    expect(css).toContain(".market-flow-panel");
    expect(css).toContain(".market-participant-grid");
    expect(css).toContain(".market-final-cta");
  });
});
