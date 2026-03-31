import type { TeamAttachmentRow } from "../types";

export type GatewayTestResult = { ok: true } | { ok: false; message: string };

export type StreamPrimaryAgentReplyInput = {
  companyId: string;
  teamId: string;
  conversationId: string;
  primaryAgentId: string;
  messageBody: string;
  attachments: TeamAttachmentRow[];
};

export async function testGatewayConnection(input: { baseUrl: string; apiKey?: string }) {
  if (typeof input.baseUrl !== "string" || !input.baseUrl.startsWith("http")) {
    return { ok: false, message: "INVALID_BASE_URL" } satisfies GatewayTestResult;
  }
  return { ok: true } satisfies GatewayTestResult;
}

export async function syncGatewayAgents(companyId: string) {
  return [
    {
      externalAgentId: "agent_sales_1",
      name: "Sales Lead Agent",
      description: "Handles first-pass sales conversations",
      status: "ready",
      isEnabled: true,
      companyId,
    },
  ];
}

function splitIntoDeltas(text: string): string[] {
  const compact = text.trim();
  if (compact.length < 3) {
    return [compact];
  }
  const partLength = Math.ceil(compact.length / 3);
  const deltas: string[] = [];
  for (let cursor = 0; cursor < compact.length; cursor += partLength) {
    deltas.push(compact.slice(cursor, cursor + partLength));
  }
  return deltas;
}

export async function* streamPrimaryAgentReply(
  input: StreamPrimaryAgentReplyInput
): AsyncGenerator<string, void, undefined> {
  const attachmentsLine =
    input.attachments.length > 0
      ? ` I reviewed uploaded files: ${input.attachments
          .map((attachment) => `${attachment.originalName} (${attachment.mimeType})`)
          .join(", ")}.`
      : "";

  const response = `[${input.primaryAgentId}] Thanks. I received your message: "${input.messageBody.trim()}".${attachmentsLine} I will draft next steps now.`;
  for (const delta of splitIntoDeltas(response)) {
    yield delta;
    await Bun.sleep(0);
  }
}
