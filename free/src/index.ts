type ChatMessage = {
  role?: string;
  content?: unknown;
};

type ChatCompletionsBody = {
  model?: string;
  stream?: boolean;
  messages?: ChatMessage[];
};

const PORT = Number(process.env.FREE_PROVIDER_PORT || "18765");
const MODEL_ID = process.env.FREE_PROVIDER_MODEL_ID || "free-echo";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function sse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function readTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const asObj = item as Record<string, unknown>;
    if (typeof asObj.text === "string") {
      chunks.push(asObj.text);
      continue;
    }
    if (asObj.type === "text" && typeof asObj.content === "string") {
      chunks.push(asObj.content);
    }
  }
  return chunks.join("\n").trim();
}

function pickEchoText(messages: ChatMessage[] | undefined): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") {
      continue;
    }
    const text = readTextFromContent(message.content).trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function buildCompletion(body: ChatCompletionsBody): Record<string, unknown> {
  const nowSec = Math.floor(Date.now() / 1000);
  const content = pickEchoText(body.messages);
  return {
    id: `chatcmpl-free-${Date.now()}`,
    object: "chat.completion",
    created: nowSec,
    model: body.model || MODEL_ID,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content,
        },
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

function buildStream(body: ChatCompletionsBody): Response {
  const nowSec = Math.floor(Date.now() / 1000);
  const content = pickEchoText(body.messages);
  const model = body.model || MODEL_ID;
  const id = `chatcmpl-free-${Date.now()}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const first = {
        id,
        object: "chat.completion.chunk",
        created: nowSec,
        model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(first)}\n\n`));

      const second = {
        id,
        object: "chat.completion.chunk",
        created: nowSec,
        model,
        choices: [{ index: 0, delta: { content }, finish_reason: "stop" }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(second)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return sse(stream);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return json({
        ok: true,
        service: "clawos-free-provider",
        model: MODEL_ID,
        port: PORT,
        ts: Date.now(),
      });
    }

    if (url.pathname === "/v1/models" && req.method === "GET") {
      return json({
        object: "list",
        data: [{ id: MODEL_ID, object: "model", owned_by: "clawos" }],
      });
    }

    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as ChatCompletionsBody | null;
      if (!body || typeof body !== "object") {
        return json({ error: { message: "Invalid JSON body." } }, 400);
      }
      if (body.stream === true) {
        return buildStream(body);
      }
      return json(buildCompletion(body));
    }

    return json({ error: { message: `Not found: ${url.pathname}` } }, 404);
  },
});

console.log(`[free-provider] listening on http://127.0.0.1:${server.port}`);
