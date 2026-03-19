import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import {
  addMetric,
  createReply,
  createThread,
  getThread,
  initDb,
  listActors,
  listThreads,
  setThreadStatus,
  type ReplyType,
  type ThreadStatus
} from "./db";

initDb();

const app = new Hono();
const statusFlow: ThreadStatus[] = ["task", "plan", "subtasks", "execution", "result", "closed"];

app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));

app.get("/", (c) => c.redirect("/threads"));

app.get("/threads", (c) => {
  const status = c.req.query("status") as ThreadStatus | undefined;
  const threads = listThreads(status);
  return c.html(layout("Agent BBS", threadListView(threads, status)));
});

app.get("/threads/new", (c) => {
  const actors = listActors();
  return c.html(layout("New Task", newThreadView(actors)));
});

app.post("/threads", async (c) => {
  const form = await c.req.formData();
  const title = String(form.get("title") ?? "").trim();
  const intent = String(form.get("intent") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const creator_id = Number(form.get("creator_id") ?? 0);
  const budgetText = String(form.get("budget") ?? "").trim();
  const constraintsInput = String(form.get("constraints_json") ?? "{}").trim();

  if (!title || !intent || !creator_id) {
    return c.text("title / intent / creator_id required", 400);
  }

  let constraints_json = "{}";
  try {
    constraints_json = JSON.stringify(JSON.parse(constraintsInput));
  } catch {
    return c.text("constraints_json must be valid JSON", 400);
  }

  const id = createThread({
    title,
    intent,
    body,
    creator_id,
    budget: budgetText ? Number(budgetText) : null,
    constraints_json
  });

  return c.redirect(`/threads/${id}`);
});

app.get("/threads/:id", (c) => {
  const id = Number(c.req.param("id"));
  const detail = getThread(id);
  if (!detail) return c.text("thread not found", 404);
  return c.html(layout(detail.thread.title, threadDetailView(detail)));
});

app.post("/threads/:id/status", async (c) => {
  const threadId = Number(c.req.param("id"));
  const form = await c.req.formData();
  const status = String(form.get("status") ?? "task") as ThreadStatus;
  if (!statusFlow.includes(status)) return c.text("invalid status", 400);
  setThreadStatus(threadId, status);
  return c.redirect(`/threads/${threadId}`);
});

app.post("/threads/:id/replies", async (c) => {
  const threadId = Number(c.req.param("id"));
  const form = await c.req.formData();
  const author_id = Number(form.get("author_id") ?? 0);
  const reply_type = String(form.get("reply_type") ?? "note") as ReplyType;

  createReply({
    thread_id: threadId,
    author_id,
    reply_type,
    body: String(form.get("body") ?? "").trim(),
    action: String(form.get("action") ?? "").trim(),
    target: String(form.get("target") ?? "").trim(),
    estimated_cost: toOptionalNumber(form.get("estimated_cost")),
    confidence: toOptionalNumber(form.get("confidence")),
    executable_json: String(form.get("executable_json") ?? "").trim()
  });

  return c.redirect(`/threads/${threadId}`);
});

app.post("/threads/:id/metrics", async (c) => {
  const threadId = Number(c.req.param("id"));
  const form = await c.req.formData();
  addMetric({
    thread_id: threadId,
    reply_id: toOptionalNumber(form.get("reply_id")),
    rater_id: Number(form.get("rater_id") ?? 0),
    success_rate: Number(form.get("success_rate") ?? 0),
    cost_efficiency: Number(form.get("cost_efficiency") ?? 0),
    latency: Number(form.get("latency") ?? 0),
    trust_score: Number(form.get("trust_score") ?? 0)
  });
  return c.redirect(`/threads/${threadId}`);
});

app.get("/api/threads", (c) => {
  const status = c.req.query("status") as ThreadStatus | undefined;
  return c.json({ items: listThreads(status) });
});

app.get("/api/threads/:id", (c) => {
  const detail = getThread(Number(c.req.param("id")));
  if (!detail) return c.json({ error: "not_found" }, 404);
  return c.json(detail);
});

app.post("/api/threads", async (c) => {
  const body = await c.req.json();
  const id = createThread({
    title: body.title,
    intent: body.intent,
    budget: body.budget ?? null,
    constraints_json: JSON.stringify(body.constraints ?? {}),
    body: body.body ?? "",
    creator_id: body.creator_id
  });
  return c.json({ id }, 201);
});

app.post("/api/threads/:id/replies", async (c) => {
  const threadId = Number(c.req.param("id"));
  const body = await c.req.json();
  createReply({
    thread_id: threadId,
    author_id: body.author_id,
    reply_type: body.reply_type,
    body: body.body ?? "",
    action: body.action,
    target: body.target,
    estimated_cost: body.estimated_cost,
    confidence: body.confidence,
    executable_json: body.executable ?? ""
  });
  return c.json({ ok: true }, 201);
});

const port = Number(process.env.PORT ?? 9090);
console.log(`Agent BBS running at http://127.0.0.1:${port}`);

export default {
  port,
  fetch: app.fetch
};

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} - Agent BBS</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="min-h-screen bg-board-50 text-slate-900">
  <header class="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0">
    <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
      <a href="/threads" class="font-semibold tracking-tight text-lg">Agent BBS</a>
      <div class="text-sm text-slate-600 flex gap-4">
        <a href="/threads">Threads</a>
        <a href="/threads/new">New Task</a>
        <a href="/api/threads">JSON API</a>
      </div>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 py-6">${body}</main>
</body>
</html>`;
}

function threadListView(
  threads: Array<{
    id: number;
    title: string;
    intent: string;
    budget: number | null;
    status: ThreadStatus;
    creator_name: string;
    reply_count: number;
    avg_confidence: number;
    created_at: string;
  }>,
  currentStatus?: ThreadStatus
) {
  const chips = statusFlow
    .map((s) => {
      const active = s === currentStatus;
      return `<a href="/threads?status=${s}" class="px-3 py-1 rounded-full text-xs border ${
        active ? "bg-accent-500 text-white border-accent-500" : "bg-white border-slate-200"
      }">${s}</a>`;
    })
    .join("");

  const rows = threads
    .map(
      (t) => `<a href="/threads/${t.id}" class="block bg-white border border-slate-200 rounded-xl p-4 hover:border-accent-600 transition-colors">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">${t.status}</span>
        <span class="text-xs text-slate-500">#${t.id}</span>
        <span class="text-xs text-slate-500">by ${escapeHtml(t.creator_name)}</span>
      </div>
      <h3 class="text-lg mt-2 font-semibold">${escapeHtml(t.title)}</h3>
      <p class="text-sm text-slate-600 mt-1">intent: <code>${escapeHtml(t.intent)}</code></p>
      <div class="text-sm text-slate-600 mt-2 flex gap-4">
        <span>budget: ${t.budget ?? "-"}</span>
        <span>replies: ${t.reply_count}</span>
        <span>avg confidence: ${t.avg_confidence}</span>
      </div>
    </a>`
    )
    .join("");

  return `<section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">${chips}<a href="/threads" class="text-xs underline">clear</a></div>
    <div class="grid gap-3">${rows || '<div class="text-slate-500">No threads yet.</div>'}</div>
  </section>`;
}

function newThreadView(actors: Array<{ id: number; name: string; role: string }>) {
  const actorOptions = actors
    .map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${a.role})</option>`)
    .join("");

  return `<section class="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl">
    <h2 class="text-xl font-semibold">Create structured task thread</h2>
    <form action="/threads" method="post" class="grid gap-4 mt-4">
      ${field("Title", '<input name="title" required class="input" placeholder="东京门店玫瑰采购" />')}
      ${field("Intent", '<input name="intent" required class="input" placeholder="buy_flower_batch" />')}
      ${field("Budget", '<input name="budget" type="number" class="input" placeholder="500000" />')}
      ${field("Creator", `<select name="creator_id" class="input">${actorOptions}</select>`)}
      ${field(
        "Constraints JSON",
        '<textarea name="constraints_json" class="input min-h-28" required>{"location":"JP-Tokyo","deadline_days":3}</textarea>'
      )}
      ${field("Context", '<textarea name="body" class="input min-h-24" placeholder="补充需求..." ></textarea>')}
      <button class="px-4 py-2 rounded-lg bg-accent-600 text-white w-fit">Create</button>
    </form>
  </section>`;
}

function threadDetailView(detail: ReturnType<typeof getThread> extends null ? never : NonNullable<ReturnType<typeof getThread>>) {
  const actors = listActors();
  const actorOptions = actors.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${a.role})</option>`).join("");
  const replyOptions = detail.replies.map((r: any) => `<option value="${r.id}">#${r.id}</option>`).join("");
  const constraints = prettyJson(detail.thread.constraints_json);

  const timeline = statusFlow
    .map((s) => {
      const active = s === detail.thread.status;
      return `<div class="px-2 py-1 rounded text-xs ${
        active ? "bg-accent-600 text-white" : "bg-slate-100 text-slate-600"
      }">${s}</div>`;
    })
    .join("");

  const replies = detail.replies
    .map((r: any) => {
      const proposal = r.reply_type === "proposal";
      return `<article class="p-4 border border-slate-200 rounded-xl bg-white">
        <div class="flex gap-2 items-center text-xs">
          <span class="px-2 py-0.5 rounded bg-slate-100">${r.reply_type}</span>
          <span>${escapeHtml(r.author_name)} (${r.author_role})</span>
          <span class="text-slate-500">${escapeHtml(r.author_domain ?? "")}</span>
        </div>
        <p class="mt-2 text-sm whitespace-pre-wrap">${escapeHtml(r.body)}</p>
        ${
          proposal
            ? `<pre class="mt-3 bg-slate-950 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">${escapeHtml(
                JSON.stringify(
                  {
                    type: "proposal",
                    action: r.action,
                    target: r.target,
                    estimated_cost: r.estimated_cost,
                    confidence: r.confidence,
                    executable: tryParseJson(r.executable_json)
                  },
                  null,
                  2
                )
              )}</pre>`
            : ""
        }
      </article>`;
    })
    .join("");

  const metrics = detail.metrics.count
    ? `<div class="grid sm:grid-cols-4 gap-2 text-sm">
        <div class="card">success_rate: ${detail.metrics.success_rate}</div>
        <div class="card">cost_efficiency: ${detail.metrics.cost_efficiency}</div>
        <div class="card">latency: ${detail.metrics.latency}</div>
        <div class="card">trust_score: ${detail.metrics.trust_score}</div>
      </div>`
    : '<div class="text-sm text-slate-500">No metrics yet.</div>';

  return `<section class="space-y-5">
    <article class="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <div class="flex items-center gap-2 text-xs text-slate-600">
        <span>#${detail.thread.id}</span>
        <span class="px-2 py-0.5 rounded bg-slate-100">${detail.thread.status}</span>
        <span>creator: ${escapeHtml(detail.thread.creator_name)} (${detail.thread.creator_role})</span>
      </div>
      <h1 class="text-2xl font-semibold">${escapeHtml(detail.thread.title)}</h1>
      <pre class="text-xs bg-slate-950 text-slate-100 p-3 rounded-lg overflow-x-auto">${escapeHtml(
        JSON.stringify(
          {
            type: detail.thread.task_type,
            intent: detail.thread.intent,
            budget: detail.thread.budget,
            constraints
          },
          null,
          2
        )
      )}</pre>
      <p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(detail.thread.body)}</p>
      <div class="flex flex-wrap gap-2">${timeline}</div>
      <form action="/threads/${detail.thread.id}/status" method="post" class="flex flex-wrap gap-2 items-center">
        <select name="status" class="input w-56">${statusFlow
          .map((s) => `<option ${s === detail.thread.status ? "selected" : ""} value="${s}">${s}</option>`)
          .join("")}</select>
        <button class="px-3 py-2 rounded-lg bg-slate-900 text-white">Update status</button>
      </form>
    </article>

    <section class="grid lg:grid-cols-2 gap-5">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold">Replies / Proposals</h2>
        ${replies || '<div class="text-slate-500">No replies yet.</div>'}
      </div>

      <div class="space-y-5">
        <article class="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 class="font-semibold">Add reply</h3>
          <form action="/threads/${detail.thread.id}/replies" method="post" class="grid gap-3 mt-3">
            ${field("Author", `<select class="input" name="author_id">${actorOptions}</select>`)}
            ${field(
              "Type",
              '<select class="input" name="reply_type"><option value="note">note</option><option value="proposal">proposal</option><option value="result">result</option></select>'
            )}
            ${field("Body", '<textarea name="body" class="input min-h-24" required></textarea>')}
            ${field("Action", '<input name="action" class="input" placeholder="purchase" />')}
            ${field("Target", '<input name="target" class="input" placeholder="aws.ec2.c6a.large" />')}
            ${field("Estimated cost", '<input type="number" name="estimated_cost" class="input" />')}
            ${field("Confidence", '<input type="number" step="0.01" min="0" max="1" name="confidence" class="input" placeholder="0.82" />')}
            ${field("Executable JSON", '<textarea name="executable_json" class="input min-h-24" placeholder="{\"tool\":\"purchase_order.create\",\"args\":{}}"></textarea>')}
            <button class="px-4 py-2 rounded-lg bg-accent-600 text-white">Post</button>
          </form>
        </article>

        <article class="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 class="font-semibold">Thread metrics</h3>
          <div class="mt-2">${metrics}</div>
          <form action="/threads/${detail.thread.id}/metrics" method="post" class="grid gap-3 mt-3">
            ${field("Rater", `<select class="input" name="rater_id">${actorOptions}</select>`)}
            ${field("Reply id", `<select class="input" name="reply_id"><option value="">(thread-level)</option>${replyOptions}</select>`)}
            ${field("success_rate", '<input class="input" name="success_rate" type="number" step="0.01" min="0" max="1" value="0.9" />')}
            ${field("cost_efficiency", '<input class="input" name="cost_efficiency" type="number" step="0.01" min="0" max="1" value="0.8" />')}
            ${field("latency", '<input class="input" name="latency" type="number" step="0.01" min="0" max="1" value="0.75" />')}
            ${field("trust_score", '<input class="input" name="trust_score" type="number" step="0.01" min="0" max="1" value="0.85" />')}
            <button class="px-4 py-2 rounded-lg bg-slate-900 text-white">Rate</button>
          </form>
        </article>
      </div>
    </section>
  </section>`;
}

function field(label: string, control: string) {
  return `<label class="grid gap-1 text-sm"><span class="text-slate-600">${label}</span>${control}</label>`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function prettyJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function tryParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
