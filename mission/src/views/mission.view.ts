import type { Actor, ThreadDetail, ThreadListItem, ThreadStatus } from "../models/mission.model";

export function renderLayout(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} - Agent Mission</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="min-h-screen bg-board-50 text-slate-900">
  <header class="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0">
    <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
      <a href="/missions" class="font-semibold tracking-tight text-lg">Agent Mission</a>
      <div class="text-sm text-slate-600 flex gap-4">
        <a href="/missions">Missions</a>
        <a href="/missions/new">New Mission</a>
        <a href="/api/missions">JSON API</a>
      </div>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 py-6">${body}</main>
</body>
</html>`;
}

export function renderMissionList(missions: ThreadListItem[], currentStatus: ThreadStatus | undefined, statusFlow: ThreadStatus[]) {
  const chips = statusFlow
    .map((s) => {
      const active = s === currentStatus;
      return `<a href="/missions?status=${s}" class="px-3 py-1 rounded-full text-xs border ${
        active ? "bg-accent-500 text-white border-accent-500" : "bg-white border-slate-200"
      }">${s}</a>`;
    })
    .join("");

  const rows = missions
    .map(
      (m) => `<a href="/missions/${m.id}" class="block bg-white border border-slate-200 rounded-xl p-4 hover:border-accent-600 transition-colors">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">${m.status}</span>
        <span class="text-xs text-slate-500">#${m.id}</span>
        <span class="text-xs text-slate-500">by ${escapeHtml(m.creator_name)}</span>
      </div>
      <h3 class="text-lg mt-2 font-semibold">${escapeHtml(m.title)}</h3>
      <p class="text-sm text-slate-600 mt-1">intent: <code>${escapeHtml(m.intent)}</code></p>
      <div class="text-sm text-slate-600 mt-2 flex gap-4">
        <span>budget: ${m.budget ?? "-"}</span>
        <span>replies: ${m.reply_count}</span>
        <span>avg confidence: ${m.avg_confidence}</span>
      </div>
      <div class="text-xs mt-2 text-slate-500">lifecycle: ${m.lifecycle_status} | stage: ${m.stage} | selected: ${
        m.selected_proposal_id ?? "-"
      }</div>
    </a>`
    )
    .join("");

  return `<section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">${chips}<a href="/missions" class="text-xs underline">clear</a></div>
    <div class="grid gap-3">${rows || '<div class="text-slate-500">No missions yet.</div>'}</div>
  </section>`;
}

export function renderNewMissionForm(actors: Actor[]) {
  const actorOptions = actors.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${a.role})</option>`).join("");

  return `<section class="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl">
    <h2 class="text-xl font-semibold">Create structured mission</h2>
    <form action="/missions" method="post" class="grid gap-4 mt-4">
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

export function renderMissionDetail(detail: ThreadDetail, actors: Actor[], statusFlow: ThreadStatus[]) {
  const actorOptions = actors.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${a.role})</option>`).join("");
  const replyOptions = detail.replies.map((r) => `<option value="${r.id}">#${r.id}</option>`).join("");
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
    .map((r) => {
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

  const proposalCards = detail.proposals
    .map(
      (p) => `<article class="p-3 border border-slate-200 rounded-lg bg-white text-sm">
        <div class="text-xs text-slate-500">proposal #${p.id} by agent ${p.agent_id}</div>
        <div>cost: ${p.cost_estimate ?? "-"} | latency: ${p.latency_estimate ?? "-"} | confidence: ${p.confidence ?? "-"}</div>
      </article>`
    )
    .join("");

  const executionCards = detail.executions
    .map(
      (e) => `<article class="p-3 border border-slate-200 rounded-lg bg-white text-sm">
        <div class="text-xs text-slate-500">execution #${e.id} proposal #${e.proposal_id}</div>
        <div>status: ${e.status}</div>
      </article>`
    )
    .join("");

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
            constraints,
            lifecycle_status: detail.thread.lifecycle_status,
            stage: detail.thread.stage,
            selected_proposal_id: detail.thread.selected_proposal_id,
            assigned_agent_id: detail.thread.assigned_agent_id
          },
          null,
          2
        )
      )}</pre>
      <p class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(detail.thread.body)}</p>
      <div class="flex flex-wrap gap-2">${timeline}</div>
      <form action="/missions/${detail.thread.id}/status" method="post" class="flex flex-wrap gap-2 items-center">
        <select name="status" class="input w-56">${statusFlow
          .map((s) => `<option ${s === detail.thread.status ? "selected" : ""} value="${s}">${s}</option>`)
          .join("")}</select>
        <button class="px-3 py-2 rounded-lg bg-slate-900 text-white">Update status</button>
      </form>
    </article>

    <section class="grid lg:grid-cols-2 gap-5">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold">Mission Updates / Proposals</h2>
        ${replies || '<div class="text-slate-500">No replies yet.</div>'}
        <h3 class="text-md font-semibold mt-3">Normalized proposals</h3>
        ${proposalCards || '<div class="text-slate-500">No proposals yet.</div>'}
        <h3 class="text-md font-semibold mt-3">Executions</h3>
        ${executionCards || '<div class="text-slate-500">No executions yet.</div>'}
      </div>

      <div class="space-y-5">
        <article class="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 class="font-semibold">Add reply</h3>
          <form action="/missions/${detail.thread.id}/replies" method="post" class="grid gap-3 mt-3">
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
          <form action="/missions/${detail.thread.id}/metrics" method="post" class="grid gap-3 mt-3">
            ${field("Rater", `<select class="input" name="rater_id">${actorOptions}</select>`)}
            ${field("Reply id", `<select class="input" name="reply_id"><option value="">(mission-level)</option>${replyOptions}</select>`)}
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
