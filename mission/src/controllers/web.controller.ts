import type { Context, Hono } from "hono";
import { statusFlow } from "../lib/constants";
import {
  addMetric,
  createReply,
  createThread,
  getThread,
  listActors,
  listThreads,
  setThreadStatus,
  type ReplyType,
  type ThreadStatus
} from "../models/mission.model";
import { renderLayout, renderMissionDetail, renderMissionList, renderNewMissionForm } from "../views/mission.view";

export function registerWebRoutes(app: Hono) {
  app.get("/", (c) => c.redirect("/missions"));
  app.get("/missions", missionsPage);
  app.get("/threads", missionsPage);

  app.get("/missions/new", newMissionPage);
  app.get("/threads/new", newMissionPage);

  app.post("/missions", createMissionFromForm);
  app.post("/threads", createMissionFromForm);

  app.get("/missions/:id", missionDetailPage);
  app.get("/threads/:id", missionDetailPage);

  app.post("/missions/:id/status", updateMissionStatus);
  app.post("/threads/:id/status", updateMissionStatus);

  app.post("/missions/:id/replies", addMissionReply);
  app.post("/threads/:id/replies", addMissionReply);

  app.post("/missions/:id/metrics", addMissionMetric);
  app.post("/threads/:id/metrics", addMissionMetric);
}

function missionsPage(c: Context) {
  const status = c.req.query("status") as ThreadStatus | undefined;
  const missions = listThreads(status);
  return c.html(renderLayout("Agent Mission", renderMissionList(missions, status, statusFlow)));
}

function newMissionPage(c: Context) {
  const actors = listActors();
  return c.html(renderLayout("New Mission", renderNewMissionForm(actors)));
}

async function createMissionFromForm(c: Context) {
  const form = await c.req.formData();
  const title = String(form.get("title") ?? "").trim();
  const intent = String(form.get("intent") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const creator_id = Number(form.get("creator_id") ?? 0);
  const budgetText = String(form.get("budget") ?? "").trim();
  const constraintsInput = String(form.get("constraints_json") ?? "{}").trim();

  if (!title || !intent || !creator_id) return c.text("title / intent / creator_id required", 400);

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

  return c.redirect(`/missions/${id}`);
}

function missionDetailPage(c: Context) {
  const id = Number(c.req.param("id"));
  const detail = getThread(id);
  if (!detail) return c.text("mission not found", 404);

  const actors = listActors();
  return c.html(renderLayout(detail.thread.title, renderMissionDetail(detail, actors, statusFlow)));
}

async function updateMissionStatus(c: Context) {
  const missionId = Number(c.req.param("id"));
  const form = await c.req.formData();
  const status = String(form.get("status") ?? "task") as ThreadStatus;
  if (!statusFlow.includes(status)) return c.text("invalid status", 400);
  setThreadStatus(missionId, status);
  return c.redirect(`/missions/${missionId}`);
}

async function addMissionReply(c: Context) {
  const missionId = Number(c.req.param("id"));
  const form = await c.req.formData();
  const author_id = Number(form.get("author_id") ?? 0);
  const reply_type = String(form.get("reply_type") ?? "note") as ReplyType;

  createReply({
    thread_id: missionId,
    author_id,
    reply_type,
    body: String(form.get("body") ?? "").trim(),
    action: String(form.get("action") ?? "").trim(),
    target: String(form.get("target") ?? "").trim(),
    estimated_cost: toOptionalNumber(form.get("estimated_cost")),
    confidence: toOptionalNumber(form.get("confidence")),
    executable_json: String(form.get("executable_json") ?? "").trim()
  });

  return c.redirect(`/missions/${missionId}`);
}

async function addMissionMetric(c: Context) {
  const missionId = Number(c.req.param("id"));
  const form = await c.req.formData();
  addMetric({
    thread_id: missionId,
    reply_id: toOptionalNumber(form.get("reply_id")),
    rater_id: Number(form.get("rater_id") ?? 0),
    success_rate: Number(form.get("success_rate") ?? 0),
    cost_efficiency: Number(form.get("cost_efficiency") ?? 0),
    latency: Number(form.get("latency") ?? 0),
    trust_score: Number(form.get("trust_score") ?? 0)
  });
  return c.redirect(`/missions/${missionId}`);
}

function toOptionalNumber(value: FormDataEntryValue | string | undefined | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}
