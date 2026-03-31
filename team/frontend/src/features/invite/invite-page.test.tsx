import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AppShell } from "../../app-shell";
import { InvitePage } from "./invite-page";

const domTest = typeof document === "undefined" ? test.skip : test;

describe("AppShell", () => {
  domTest("renders the invite entry route before chat session exists", () => {
    render(<AppShell initialRoute="/app/invite/demo-token" />);
    expect(screen.getByRole("heading", { name: /join your company workspace/i })).toBeInTheDocument();
  });

  domTest("submits a nickname to enter the workspace", async () => {
    const onJoin = vi.fn();

    render(<InvitePage token="demo-token" onJoin={onJoin} />);

    await userEvent.type(screen.getByLabelText(/nickname/i), "Iris");
    await userEvent.click(screen.getByRole("button", { name: /enter workspace/i }));

    expect(onJoin).toHaveBeenCalledWith({
      displayName: "Iris",
      token: "demo-token",
    });
  });

  domTest("joins an invite, creates a conversation, and shows the streamed agent reply", async () => {
    const api = {
      joinInvite: vi.fn().mockResolvedValue({
        companyId: "company_alpha",
        sessionToken: "tsess_demo",
        memberId: "member_demo",
        displayName: "Iris",
      }),
      listConversations: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          {
            id: "conv_1",
            companyId: "company_alpha",
            teamId: "team_sales",
            memberId: "member_demo",
            title: "Lead follow-up",
            status: "open",
            lastMessageAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ]),
      createConversation: vi.fn().mockResolvedValue({
        id: "conv_1",
        companyId: "company_alpha",
        teamId: "team_sales",
        memberId: "member_demo",
        title: "Lead follow-up",
        status: "open",
        lastMessageAt: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
      getConversationDetail: vi
        .fn()
        .mockResolvedValueOnce({
          brand: {
            companyId: "company_alpha",
            brandName: "Alpha Ops",
            themeColor: "#1d4ed8",
            welcomeText: "Welcome",
          },
          conversation: {
            id: "conv_1",
            companyId: "company_alpha",
            teamId: "team_sales",
            memberId: "member_demo",
            title: "Lead follow-up",
            status: "open",
            lastMessageAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
          messages: [],
          attachments: [],
        })
        .mockResolvedValue({
          brand: {
            companyId: "company_alpha",
            brandName: "Alpha Ops",
            themeColor: "#1d4ed8",
            welcomeText: "Welcome",
          },
          conversation: {
            id: "conv_1",
            companyId: "company_alpha",
            teamId: "team_sales",
            memberId: "member_demo",
            title: "Lead follow-up",
            status: "open",
            lastMessageAt: 3,
            createdAt: 1,
            updatedAt: 3,
          },
          messages: [
            {
              id: "msg_1",
              conversationId: "conv_1",
              senderType: "member",
              body: "Draft the reply",
              createdAt: 2,
            },
            {
              id: "msg_2",
              conversationId: "conv_1",
              senderType: "agent",
              body: "Here is the follow-up draft.",
              createdAt: 3,
            },
          ],
          attachments: [],
        }),
      sendMessage: vi.fn().mockResolvedValue({
        memberMessage: {
          id: "msg_1",
          conversationId: "conv_1",
          senderType: "member",
          body: "Draft the reply",
          createdAt: 2,
        },
        agentMessage: {
          id: "msg_2",
          conversationId: "conv_1",
          senderType: "agent",
          body: "Here is the follow-up draft.",
          createdAt: 3,
        },
        deltas: ["Here is the ", "follow-up draft."],
      }),
      uploadAttachment: vi.fn().mockResolvedValue(undefined),
    };
    const storage = createMemoryStorage();

    render(<AppShell initialRoute="/app/invite/demo-token" api={api as never} storage={storage} />);

    await userEvent.type(screen.getByLabelText(/nickname/i), "Iris");
    await userEvent.click(screen.getByRole("button", { name: /enter workspace/i }));

    expect(api.joinInvite).toHaveBeenCalledWith({
      token: "demo-token",
      displayName: "Iris",
    });

    await userEvent.type(screen.getByLabelText(/team id/i), "team_sales");
    await userEvent.type(screen.getByLabelText(/conversation title/i), "Lead follow-up");
    await userEvent.click(screen.getByRole("button", { name: /create conversation/i }));

    expect(api.createConversation).toHaveBeenCalledWith("tsess_demo", {
      teamId: "team_sales",
      title: "Lead follow-up",
    });

    await userEvent.type(screen.getByPlaceholderText(/message your team/i), "Draft the reply");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(api.sendMessage).toHaveBeenCalledWith("tsess_demo", "conv_1", {
      body: "Draft the reply",
    });
    expect(await screen.findByText(/here is the follow-up draft/i)).toBeInTheDocument();
  });
});

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}
