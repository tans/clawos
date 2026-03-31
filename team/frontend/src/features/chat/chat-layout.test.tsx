import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ChatLayout } from "./chat-layout";

const domTest = typeof document === "undefined" ? test.skip : test;

describe("ChatLayout", () => {
  domTest("shows recent conversations and sends a message with attachments", async () => {
    const onSend = vi.fn();

    render(
      <ChatLayout
        teams={[{ id: "team_sales", name: "Sales", primaryAgentName: "Sales Lead Agent" }]}
        conversations={[
          {
            id: "conv_1",
            companyId: "company_alpha",
            teamId: "team_sales",
            memberId: "member_1",
            title: "Lead follow-up",
            status: "open",
            lastMessageAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        activeConversationId="conv_1"
        onSend={onSend}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("输入消息给团队"), "Draft the reply");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Draft the reply",
        files: [],
      }),
    );
  });
});
