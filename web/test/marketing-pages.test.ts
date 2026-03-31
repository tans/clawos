import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { resolve } from "node:path";

let app: typeof import("../src/index").app;
const webRoot = resolve(import.meta.dir, "..");
const builtCssPath = resolve(webRoot, "dist", "output.css");

describe("marketing pages", () => {
  let marketplaceEnabledSnapshot: string | undefined;
  let marketPortalUrlSnapshot: string | undefined;

  beforeAll(async () => {
    if (!process.env.CLAWOS_WEB_ROOT) {
      process.env.CLAWOS_WEB_ROOT = webRoot;
    }

    ({ app } = await import("../src/index"));
  });

  beforeEach(async () => {
    marketplaceEnabledSnapshot = process.env.MARKETPLACE_ENABLED;
    marketPortalUrlSnapshot = process.env.AGENT_MARKET_PORTAL_URL;
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

    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();
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

  it("uses enterprise deployment language in homepage navigation", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(">部署方式<");
    expect(html).toContain(">部署评估<");
    expect(html).not.toContain(">技能市场<");
  });

  it("shows the agent market entry surfaces when marketplace is enabled", async () => {
    process.env.MARKETPLACE_ENABLED = "1";
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(">Agent 协作<");
    expect(html).toContain("href=\"/agent-market\"");

    const navOrderAnchor = ">治理能力<";
    const navOrderAnchorIndex = html.indexOf(navOrderAnchor);
    const navMarketIndex = html.indexOf(">Agent 协作<", navOrderAnchorIndex);
    const navDownloadsIndex = html.indexOf(">下载试用<", navOrderAnchorIndex);
    const navAssessmentIndex = html.indexOf(">部署评估<", navOrderAnchorIndex);
    expect(navOrderAnchorIndex).toBeGreaterThan(-1);
    expect(navMarketIndex).toBeGreaterThan(-1);
    expect(navDownloadsIndex).toBeGreaterThan(-1);
    expect(navAssessmentIndex).toBeGreaterThan(-1);
    expect(navMarketIndex).toBeLessThan(navDownloadsIndex);
    expect(navDownloadsIndex).toBeLessThan(navAssessmentIndex);

    const footerMarketIndex = html.lastIndexOf(">Agent 协作<");
    const footerDownloadsIndex = html.lastIndexOf(">下载试用<");
    expect(footerMarketIndex).toBeGreaterThan(-1);
    expect(footerDownloadsIndex).toBeGreaterThan(-1);
    expect(footerMarketIndex).toBeLessThan(footerDownloadsIndex);
  });

  it("hides the agent market entry surfaces when marketplace is disabled", async () => {
    delete process.env.MARKETPLACE_ENABLED;
    const { resetEnvCacheForTests } = await import("../src/lib/env");
    resetEnvCacheForTests();

    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain(">Agent 协作<");
    expect(html).not.toContain("href=\"/agent-market\"");
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
