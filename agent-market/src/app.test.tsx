import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { App } from "./app";

const domTest = typeof document === "undefined" ? test.skip : test;

describe("AgentMarket portal", () => {
  domTest("wires header navigation to existing sections and avoids low-trust marketplace wording", () => {
    const { container } = render(<App />);

    expect(screen.queryByText(/poc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/抢单/)).not.toBeInTheDocument();
    expect(screen.queryByText(/接单/)).not.toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "市场主导航" });
    const navLinks = within(nav).getAllByRole("link");
    const navHrefs = navLinks.map((link) => link.getAttribute("href"));

    const expectedHrefs = ["#tasks", "#roles", "#proof", "#rules"];
    expect(navLinks).toHaveLength(4);
    expect(navHrefs).toEqual(expectedHrefs);
    for (const href of expectedHrefs) {
      const targetId = href.slice(1);
      expect(container.querySelector(`#${targetId}`)).toBeInTheDocument();
    }
  });

  domTest("renders demand headline, stat count, and hero CTA wiring", () => {
    const { container } = render(<App />);
    expect(
      screen.getByRole("heading", {
        name: "把企业需求转成可协作、可交付、可复用的 Agent 任务",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("活跃需求方向")).toBeInTheDocument();
    expect(screen.getByText("标准化任务类型")).toBeInTheDocument();
    expect(screen.getByText("本周新增需求")).toBeInTheDocument();
    const heroActionRow = container.querySelector(".portal-action-row");
    const heroTaskPanel = container.querySelector(".hero-task-panel");
    expect(heroActionRow).toBeInTheDocument();
    expect(heroTaskPanel).toBeInTheDocument();
    const heroActionLinks = within(heroActionRow as HTMLElement).getAllByRole("link");
    expect(heroActionLinks).toHaveLength(2);
    expect(within(heroActionRow as HTMLElement).getByRole("link", { name: "提交企业需求" })).toHaveAttribute(
      "href",
      "#enterprise-entry",
    );
    expect(within(heroActionRow as HTMLElement).getByRole("link", { name: "申请成为服务方" })).toHaveAttribute(
      "href",
      "#provider-entry",
    );
    expect((heroTaskPanel as HTMLElement).querySelectorAll("article")).toHaveLength(2);
    expect(
      within(heroTaskPanel as HTMLElement).getByRole("heading", {
        name: "销售知识库搭建与问答助手",
      }),
    ).toBeInTheDocument();
    expect(
      within(heroTaskPanel as HTMLElement).getByRole("heading", {
        name: "客服 SOP 分流与质检工作流",
      }),
    ).toBeInTheDocument();
    expect(
      within(heroTaskPanel as HTMLElement).queryByRole("heading", {
        name: "虾壳主机私有部署支持",
      }),
    ).not.toBeInTheDocument();
  });

  domTest("renders task stream cards with metadata and demand filters", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "优先展示已经进入结构化协作路径的企业任务" }),
    ).toBeInTheDocument();
    expect(screen.getByText("销售")).toBeInTheDocument();
    expect(screen.getByText("客服")).toBeInTheDocument();
    expect(screen.getByText("运营")).toBeInTheDocument();
    expect(screen.getByText("知识库")).toBeInTheDocument();
    expect(screen.getByText("私有部署")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "销售知识库搭建与问答助手" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "虾壳主机私有部署支持" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("按阶段协作").length).toBeGreaterThan(0);
    expect(screen.getAllByText("需求评估中").length).toBeGreaterThan(0);
    expect(screen.getByText("OpenClaw 预装交付")).toBeInTheDocument();
  });

  domTest("renders role section cards and action links", () => {
    const { container } = render(<App />);

    const roleSection = container.querySelector("#roles");
    expect(roleSection).toBeInTheDocument();
    expect(
      within(roleSection as HTMLElement).getByRole("heading", { name: "按参与角色进入不同合作路径" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "企业方" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "服务方" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "生态伙伴" })).toBeInTheDocument();
    expect(screen.getByText("参与部署、实施、硬件与联合交付支持。")).toBeInTheDocument();
    expect(within(roleSection as HTMLElement).getByRole("link", { name: "申请生态合作" })).toHaveAttribute(
      "href",
      "#partner-entry",
    );
  });

  domTest("renders capability proof, case outcomes, and rules content", () => {
    const { container } = render(<App />);

    const proofSection = container.querySelector("#proof");
    const rulesSection = container.querySelector("#rules");
    expect(proofSection).toBeInTheDocument();
    expect(rulesSection).toBeInTheDocument();
    expect(within(proofSection as HTMLElement).getByText("交付能力")).toBeInTheDocument();
    expect(screen.getByText("案例结果")).toBeInTheDocument();
    expect(within(rulesSection as HTMLElement).getByText("流程与规则")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "交付能力" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "案例结果" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "流程与规则" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "工作流设计与 Agent 编排" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "销售知识库升级" })).toBeInTheDocument();
    expect(screen.getByText("结构化范围")).toBeInTheDocument();
    expect(screen.getByText("可验证交付")).toBeInTheDocument();
    const partnerLinks = screen.getAllByRole("link", { name: "申请生态合作" });
    expect(partnerLinks).toHaveLength(2);
    expect(partnerLinks.every((link) => link.getAttribute("href") === "#partner-entry")).toBe(true);
  });
});
