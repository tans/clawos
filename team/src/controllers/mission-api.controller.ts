import type { Context } from "hono";
import { Hono } from "hono";
import {
  createExecution,
  createProposal,
  createReply,
  createThread,
  getThread,
  initMissionTables,
  listAgentTasks,
  listEventsAfter,
  listExecutions,
  listProposals,
  listThreads,
  selectProposal,
  updateExecution,
  type ThreadStatus,
} from "../models/mission.model";
import type { AppEnv } from "../types";

function toOptionalNumber(value: string | undefined | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export function createMissionApiController(): Hono<AppEnv> {
  initMissionTables();

  const controller = new Hono<AppEnv>();

  controller.get("/api/missions", (c) => {
    const status = c.req.query("status") as ThreadStatus | undefined;
    return c.json({ items: listThreads(status) });
  });

  controller.get("/api/missions/:id", (c) => {
    const detail = getThread(Number(c.req.param("id")));
    if (!detail) return c.json({ error: "not_found" }, 404);
    return c.json(detail);
  });

  controller.post("/api/missions", async (c) => {
    const body = await c.req.json();
    const id = createThread({
      title: body.title,
      intent: body.intent,
      budget: body.budget ?? null,
      constraints_json: JSON.stringify(body.constraints ?? {}),
      body: body.body ?? "",
      creator_id: body.creator_id ?? 1,
    });
    return c.json({ id }, 201);
  });

  controller.post("/api/missions/:id/replies", async (c) => {
    const missionId = Number(c.req.param("id"));
    const body = await c.req.json();
    createReply({
      thread_id: missionId,
      author_id: body.author_id ?? 1,
      reply_type: body.reply_type,
      body: body.body ?? "",
      action: body.action,
      target: body.target,
      estimated_cost: body.estimated_cost,
      confidence: body.confidence,
      executable_json: body.executable ?? "",
    });
    return c.json({ ok: true }, 201);
  });

  controller.get("/api/agent/tasks", (c) => {
    const agentId = toOptionalNumber(c.req.query("agent_id"));
    const limit = toOptionalNumber(c.req.query("limit")) ?? 20;
    const intent = c.req.query("intent") ?? undefined;
    const items = listAgentTasks({ agent_id: agentId ?? undefined, intent, limit });
    return c.json({ items });
  });

  controller.post("/api/proposals", async (c) => {
    const body = await c.req.json();
    const proposalId = createProposal({
      thread_id: Number(body.thread_id),
      type: body.type ?? "proposal",
      plan_json: JSON.stringify(body.plan ?? []),
      cost_estimate: body.cost_estimate ?? null,
      latency_estimate: body.latency_estimate ?? null,
      confidence: body.confidence ?? null,
      agent_id: Number(body.agent_id) || 2,
    });

    if (body.as_reply) {
      createReply({
        thread_id: Number(body.thread_id),
        author_id: Number(body.agent_id) || 2,
        reply_type: body.type === "result" ? "result" : "proposal",
        body: body.summary ?? "proposal submitted",
        estimated_cost: body.cost_estimate ?? null,
        confidence: body.confidence ?? null,
        executable_json: JSON.stringify({ plan: body.plan ?? [] }),
      });
    }

    return c.json({ id: proposalId }, 201);
  });

  controller.get("/api/missions/:id/proposals", (c) => {
    const missionId = Number(c.req.param("id"));
    return c.json({ items: listProposals(missionId) });
  });

  controller.post("/api/missions/:id/select", async (c) => {
    const missionId = Number(c.req.param("id"));
    const body = await c.req.json();
    const proposalId = Number(body.proposal_id);
    const assignedAgentId = toOptionalNumber(body.assigned_agent_id);

    const selected = selectProposal({
      thread_id: missionId,
      proposal_id: proposalId,
      assigned_agent_id: assignedAgentId,
    });

    if (!selected) return c.json({ error: "proposal_not_found" }, 404);

    const executionId = createExecution({
      thread_id: missionId,
      proposal_id: proposalId,
      executor_agent_id: selected.assigned_agent_id,
      status: "pending",
    });

    return c.json({ ok: true, execution_id: executionId }, 201);
  });

  controller.get("/api/executions", (c) => {
    const missionId = toOptionalNumber(c.req.query("thread_id"));
    return c.json({ items: listExecutions(missionId ?? undefined) });
  });

  controller.post("/api/executions", async (c) => {
    const body = await c.req.json();
    const id = createExecution({
      thread_id: Number(body.thread_id),
      proposal_id: Number(body.proposal_id),
      executor_agent_id: Number(body.executor_agent_id),
      status: body.status ?? "pending",
      logs_json: JSON.stringify(body.logs ?? []),
      result_json: JSON.stringify(body.result ?? {}),
    });
    return c.json({ id }, 201);
  });

  controller.post("/api/executions/:id/update", async (c) => {
    const executionId = Number(c.req.param("id"));
    const body = await c.req.json();
    const ret = updateExecution({
      execution_id: executionId,
      status: body.status,
      logs_json: body.logs ? JSON.stringify(body.logs) : undefined,
      result_json: body.result ? JSON.stringify(body.result) : undefined,
    });
    if (!ret) return c.json({ error: "execution_not_found" }, 404);
    return c.json({ ok: true, ...ret });
  });

  controller.get("/api/events", eventStream);

  return controller;
}

async function eventStream(c: Context) {
  if (c.req.header("accept")?.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const startFrom = Number(c.req.query("last_id") ?? 0);

    const stream = new ReadableStream({
      start(controller) {
        let lastId = startFrom;
        controller.enqueue(encoder.encode(`event: hello\ndata: ${JSON.stringify({ last_id: lastId })}\n\n`));

        const flush = () => {
          const events = listEventsAfter(lastId, 100);
          for (const ev of events) {
            lastId = ev.id;
            controller.enqueue(encoder.encode(`id: ${ev.id}\n`));
            controller.enqueue(encoder.encode(`event: ${ev.type}\n`));
            controller.enqueue(encoder.encode(`data: ${ev.payload_json}\n\n`));
          }
        };

        flush();
        const timer = setInterval(flush, 1500);

        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"));
        }, 12000);

        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(timer);
          clearInterval(heartbeat);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const lastId = Number(c.req.query("last_id") ?? 0);
  return c.json({ items: listEventsAfter(lastId, 200) });
}
