import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("marketing pages", () => {
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
});
