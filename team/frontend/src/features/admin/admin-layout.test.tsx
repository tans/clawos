import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AdminLayout } from "./admin-layout";

const domTest = typeof document === "undefined" ? test.skip : test;

describe("AdminLayout", () => {
  domTest("renders the setup navigation for company, gateway, agent, team, and invite screens", () => {
    render(<AdminLayout />);

    expect(screen.getByRole("link", { name: "公司" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "网关" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "团队" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "邀请" })).toBeInTheDocument();
  });

  domTest("tests gateway, syncs agents, creates a team, and creates an invite", async () => {
    const api = {
      saveBrand: vi.fn().mockResolvedValue({ ok: true }),
      saveGatewayConfig: vi.fn().mockResolvedValue({ ok: true }),
      testGateway: vi.fn().mockResolvedValue({ ok: true }),
      syncGatewayAgents: vi.fn().mockResolvedValue([
        {
          id: "agent_row_1",
          companyId: "company_alpha",
          externalAgentId: "agent_sales_1",
          name: "Sales Lead Agent",
          description: "Handles first-pass sales conversations",
          status: "ready",
          isEnabled: true,
        },
      ]),
      createTeam: vi.fn().mockResolvedValue({
        id: "team_sales",
        companyId: "company_alpha",
        name: "Sales",
        description: "Sales copilot",
        primaryAgentId: "agent_sales_1",
        createdAt: 1,
        updatedAt: 1,
      }),
      createInvite: vi.fn().mockResolvedValue({
        id: "invite_1",
        companyId: "company_alpha",
        token: "invite_demo_token",
        status: "active",
        usageLimit: 5,
        usageCount: 0,
        createdBy: "console:admin",
        createdAt: 1,
        updatedAt: 1,
        expiresAt: 2,
      }),
    };

    render(<AdminLayout companyId="company_alpha" api={api as never} />);

    await userEvent.type(screen.getByLabelText(/base url/i), "https://gateway.example.com");
    await userEvent.type(screen.getByLabelText(/api key/i), "token_123");
    await userEvent.click(screen.getByRole("button", { name: /保存 gateway/i }));

    expect(api.saveGatewayConfig).toHaveBeenNthCalledWith(1, "company_alpha", {
      baseUrl: "https://gateway.example.com",
      apiKey: "token_123",
    });
    expect(await screen.findByText("Gateway 配置已保存。")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(api.saveGatewayConfig).toHaveBeenNthCalledWith(2, "company_alpha", {
      baseUrl: "https://gateway.example.com",
      apiKey: "token_123",
    });
    expect(api.testGateway).toHaveBeenCalledWith("company_alpha", {
      baseUrl: "https://gateway.example.com",
      apiKey: "token_123",
    });

    await userEvent.click(screen.getByRole("button", { name: "同步 Agent" }));
    expect(api.saveGatewayConfig).toHaveBeenNthCalledWith(3, "company_alpha", {
      baseUrl: "https://gateway.example.com",
      apiKey: "token_123",
    });
    expect(api.syncGatewayAgents).toHaveBeenCalledWith("company_alpha");
    expect((await screen.findAllByText(/sales lead agent/i)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("团队名称"), "Sales");
    await userEvent.type(screen.getByLabelText("团队说明"), "Sales copilot");
    await userEvent.selectOptions(screen.getByLabelText("主 Agent"), "agent_sales_1");
    await userEvent.click(screen.getByRole("button", { name: "创建团队" }));

    expect(api.createTeam).toHaveBeenCalledWith("company_alpha", {
      name: "Sales",
      description: "Sales copilot",
      primaryAgentId: "agent_sales_1",
    });

    await userEvent.clear(screen.getByLabelText("使用次数上限"));
    await userEvent.type(screen.getByLabelText("使用次数上限"), "5");
    await userEvent.click(screen.getByRole("button", { name: "创建邀请链接" }));

    expect(api.createInvite).toHaveBeenCalledWith("company_alpha", {
      expiresInHours: 24,
      usageLimit: 5,
    });
    expect(await screen.findByText(/invite_demo_token/i)).toBeInTheDocument();
  });
});
