import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("marketing pages", () => {
  it("renders the homepage as an enterprise conversion page", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("让 AI 员工进入真实业务流程");
    expect(html).toContain("预约 PoC");
    expect(html).toContain("下载试用");
    expect(html).toContain("ClawOS 的三层交付结构");
    expect(html).toContain("虾壳主机");
    expect(html).toContain("企业部署 AI，首先要可控");
    expect(html).not.toContain("为什么普通用户也能轻松用");
  });

  it("renders the downloads page as a trial-entry page", async () => {
    const response = await app.request("http://localhost/downloads");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("下载 ClawOS，开始你的企业 AI 试点");
    expect(html).toContain("下载稳定版");
    expect(html).toContain("联系方案专家");
    expect(html).not.toContain("下载中心");

    const headingAnchor = "下载 ClawOS，开始你的企业 AI 试点";
    const headingIndex = html.indexOf(headingAnchor);
    expect(headingIndex).toBeGreaterThan(-1);

    const stableIndex = html.indexOf("下载稳定版", headingIndex);
    const contactIndex = html.indexOf("联系方案专家", headingIndex);
    expect(stableIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeGreaterThan(-1);
    expect(stableIndex).toBeLessThan(contactIndex);
  });

  it("renders the contact page as a consultation page", async () => {
    const response = await app.request("http://localhost/contact");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("联系方案专家");
    expect(html).toContain("预约 PoC");
    expect(html).toContain("商务采购");
    expect(html).toContain("使用资料");
    expect(html).not.toContain("商务与合作");
  });

  it("keeps enterprise consultation ahead of trial language on the homepage", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    const heroAnchor = "让 AI 员工进入真实业务流程";
    const heroIndex = html.indexOf(heroAnchor);
    expect(heroIndex).toBeGreaterThan(-1);

    const pocIndex = html.indexOf("预约 PoC", heroIndex);
    const downloadIndex = html.indexOf("下载试用", heroIndex);

    expect(pocIndex).toBeGreaterThan(-1);
    expect(downloadIndex).toBeGreaterThan(-1);
    expect(pocIndex).toBeLessThan(downloadIndex);
  });

  it("uses capability-oriented homepage navigation labels", async () => {
    const response = await app.request("http://localhost/");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('href="/#capabilities"');
    expect(html).toContain(">核心能力<");
    expect(html).not.toContain(">技能市场<");
  });
});
