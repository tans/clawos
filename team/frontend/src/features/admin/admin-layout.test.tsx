import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AdminLayout } from "./admin-layout";

const domTest = typeof document === "undefined" ? test.skip : test;

describe("AdminLayout", () => {
  domTest("renders the setup navigation for company, gateway, agent, team, and invite screens", () => {
    render(<AdminLayout />);

    expect(screen.getByRole("link", { name: /company/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /gateway/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /teams/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /invites/i })).toBeInTheDocument();
  });

  domTest("tests gateway, syncs agents, creates a team, and creates an invite", async () => {
    const api = {
      saveBrand: vi.fn().mockResolvedValue({ ok: true }),
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
    await userEvent.click(screen.getByRole("button", { name: /test connection/i }));

    expect(api.testGateway).toHaveBeenCalledWith("company_alpha", {
      baseUrl: "https://gateway.example.com",
      apiKey: "token_123",
    });

    await userEvent.click(screen.getByRole("button", { name: /sync agents/i }));
    expect(api.syncGatewayAgents).toHaveBeenCalledWith("company_alpha");
    expect((await screen.findAllByText(/sales lead agent/i)).length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText(/team name/i), "Sales");
    await userEvent.type(screen.getByLabelText(/team description/i), "Sales copilot");
    await userEvent.selectOptions(screen.getByLabelText(/primary agent/i), "agent_sales_1");
    await userEvent.click(screen.getByRole("button", { name: /create team/i }));

    expect(api.createTeam).toHaveBeenCalledWith("company_alpha", {
      name: "Sales",
      description: "Sales copilot",
      primaryAgentId: "agent_sales_1",
    });

    await userEvent.clear(screen.getByLabelText(/usage limit/i));
    await userEvent.type(screen.getByLabelText(/usage limit/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /create invite/i }));

    expect(api.createInvite).toHaveBeenCalledWith("company_alpha", {
      expiresInHours: 24,
      usageLimit: 5,
    });
    expect(await screen.findByText(/invite_demo_token/i)).toBeInTheDocument();
  });
});
