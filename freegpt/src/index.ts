import llmsTxt from "../../llms.txt" with { type: "text" };

type ChatMessage = {
  role?: string;
  content?: unknown;
};

type ChatCompletionsBody = {
  model?: string;
  stream?: boolean;
  messages?: ChatMessage[];
};

type ResponsesBody = {
  model?: string;
  input?: unknown;
};

const PORT = Number(process.env.PORT || process.env.FREEGPT_PROVIDER_PORT || process.env.FREE_PROVIDER_PORT || "18765");
const MODEL_ID = process.env.FREEGPT_PROVIDER_MODEL_ID || process.env.FREE_PROVIDER_MODEL_ID || "freegpt-echo";
const FREE_MODEL_NOTICE = "提醒：这是一个免费的测试模型，请先去配置其他大模型接入。";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function text(content: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(content, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function sse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      ...CORS_HEADERS,
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

function normalizeResponseInput(input: unknown): string {
  if (typeof input === "string") {
    return input.trim();
  }
  if (!Array.isArray(input)) {
    return "";
  }

  for (let i = input.length - 1; i >= 0; i -= 1) {
    const item = input[i];
    if (!item || typeof item !== "object") {
      continue;
    }
    const asObj = item as Record<string, unknown>;
    const role = typeof asObj.role === "string" ? asObj.role : "";
    if (role !== "user") {
      continue;
    }
    const content = asObj.content;
    if (typeof content === "string") {
      const text = content.trim();
      if (text) {
        return text;
      }
      continue;
    }
    const maybeArray = Array.isArray(content) ? content : [];
    for (const part of maybeArray) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string" && p.text.trim()) {
        return p.text.trim();
      }
    }
  }
  return "";
}

function appendFreeModelNotice(content: string): string {
  const trimmed = content.trim();
  return trimmed ? `${trimmed}\n\n${FREE_MODEL_NOTICE}` : FREE_MODEL_NOTICE;
}

function buildCompletion(body: ChatCompletionsBody): Record<string, unknown> {
  const nowSec = Math.floor(Date.now() / 1000);
  const content = appendFreeModelNotice(pickEchoText(body.messages));
  return {
    id: `chatcmpl-freegpt-${Date.now()}`,
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
  const content = appendFreeModelNotice(pickEchoText(body.messages));
  const model = body.model || MODEL_ID;
  const id = `chatcmpl-freegpt-${Date.now()}`;
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

function buildResponses(body: ResponsesBody): Record<string, unknown> {
  const content = appendFreeModelNotice(normalizeResponseInput(body.input));
  return {
    id: `resp-freegpt-${Date.now()}`,
    object: "response",
    model: body.model || MODEL_ID,
    status: "completed",
    output_text: content,
    output: [
      {
        id: `msg-freegpt-${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: content }],
      },
    ],
  };
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/" && req.method === "GET") {
      return json({
        ok: true,
        service: "clawos-freegpt-provider",
        docs: ["/health", "/v1/models", "/v1/chat/completions", "/v1/responses"],
      });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return json({
        ok: true,
        service: "clawos-freegpt-provider",
        model: MODEL_ID,
        port: PORT,
        ts: Date.now(),
      });
    }

    if (url.pathname === "/llms.txt" && req.method === "GET") {
      return text(llmsTxt, 200, {
        "cache-control": "public, max-age=300",
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

    if (url.pathname === "/v1/responses" && req.method === "POST") {
      const body = (await req.json().catch(() => null)) as ResponsesBody | null;
      if (!body || typeof body !== "object") {
        return json({ error: { message: "Invalid JSON body." } }, 400);
      }
      return json(buildResponses(body));
    }

    return json({ error: { message: `Not found: ${url.pathname}` } }, 404);
  },
});

console.log(`[freegpt-provider] listening on http://127.0.0.1:${server.port}`);
