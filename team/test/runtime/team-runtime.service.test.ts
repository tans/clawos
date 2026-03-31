import { describe, expect, test } from "bun:test";
import { streamPrimaryAgentReply } from "../../src/services/team-runtime.service";

describe("team runtime service", () => {
  test("streams multiple deltas for primary agent replies", async () => {
    const deltas: string[] = [];

    for await (const delta of streamPrimaryAgentReply({
      companyId: "company_runtime",
      teamId: "team_sales",
      conversationId: "conv_1",
      primaryAgentId: "agent_sales_1",
      messageBody: "Can you summarize this lead?",
      attachments: [],
    })) {
      deltas.push(delta);
    }

    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toContain("agent_sales_1");
  });

  test("mentions uploaded attachment metadata in streamed reply", async () => {
    const deltas: string[] = [];

    for await (const delta of streamPrimaryAgentReply({
      companyId: "company_runtime",
      teamId: "team_sales",
      conversationId: "conv_2",
      primaryAgentId: "agent_sales_1",
      messageBody: "Review the uploaded files.",
      attachments: [
        {
          id: "tatt_1",
          companyId: "company_runtime",
          conversationId: "conv_2",
          memberId: "member_1",
          originalName: "pricing-sheet.pdf",
          storedName: "1712000000_pricing-sheet.pdf",
          mimeType: "application/pdf",
          sizeBytes: 128_000,
          storagePath: "company_runtime/1712000000_pricing-sheet.pdf",
          createdAt: Date.now(),
        },
      ],
    })) {
      deltas.push(delta);
    }

    const reply = deltas.join("");
    expect(deltas.length).toBeGreaterThan(1);
    expect(reply).toContain("pricing-sheet.pdf");
    expect(reply).toContain("application/pdf");
  });
});
