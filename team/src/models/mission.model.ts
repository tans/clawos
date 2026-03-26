import { db } from "../db";

export type ThreadStatus = "task" | "plan" | "subtasks" | "execution" | "result" | "closed";
export type ReplyType = "note" | "proposal" | "result";
export type ExecutionStatus = "pending" | "running" | "done" | "failed";

type ActorRole = "human" | "agent";
type ThreadStage = "task" | "plan" | "execution" | "result";
type ThreadLifecycle = "open" | "closed";

export type Proposal = {
  id: number;
  thread_id: number;
  type: "proposal" | "result";
  plan_json: string;
  cost_estimate: number | null;
  latency_estimate: number | null;
  confidence: number | null;
  agent_id: number;
  created_at: string;
};

export type Execution = {
  id: number;
  thread_id: number;
  proposal_id: number;
  executor_agent_id: number;
  status: ExecutionStatus;
  logs_json: string;
  result_json: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  type: string;
  payload_json: string;
  created_at: string;
};

export function initMissionTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mission_actors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('human', 'agent')),
      domain TEXT DEFAULT '',
      trust_score REAL NOT NULL DEFAULT 0.5,
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mission_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'request',
      intent TEXT NOT NULL,
      budget REAL,
      constraints_json TEXT NOT NULL DEFAULT '{}',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'task'
        CHECK(status IN ('task', 'plan', 'subtasks', 'execution', 'result', 'closed')),
      lifecycle_status TEXT NOT NULL DEFAULT 'open' CHECK(lifecycle_status IN ('open','closed')),
      stage TEXT NOT NULL DEFAULT 'task' CHECK(stage IN ('task','plan','execution','result')),
      selected_proposal_id INTEGER,
      assigned_agent_id INTEGER,
      creator_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES mission_actors(id)
    );

    CREATE TABLE IF NOT EXISTS mission_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      reply_type TEXT NOT NULL CHECK(reply_type IN ('note', 'proposal', 'result')),
      body TEXT NOT NULL DEFAULT '',
      action TEXT DEFAULT '',
      target TEXT DEFAULT '',
      estimated_cost REAL,
      confidence REAL,
      executable_json TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES mission_threads(id),
      FOREIGN KEY (author_id) REFERENCES mission_actors(id)
    );

    CREATE TABLE IF NOT EXISTS mission_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('proposal', 'result')),
      plan_json TEXT NOT NULL DEFAULT '[]',
      cost_estimate REAL,
      latency_estimate INTEGER,
      confidence REAL,
      agent_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES mission_threads(id),
      FOREIGN KEY (agent_id) REFERENCES mission_actors(id)
    );

    CREATE TABLE IF NOT EXISTS mission_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      proposal_id INTEGER NOT NULL,
      executor_agent_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'done', 'failed')),
      logs_json TEXT NOT NULL DEFAULT '[]',
      result_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES mission_threads(id),
      FOREIGN KEY (proposal_id) REFERENCES mission_proposals(id),
      FOREIGN KEY (executor_agent_id) REFERENCES mission_actors(id)
    );

    CREATE TABLE IF NOT EXISTS mission_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      reply_id INTEGER,
      rater_id INTEGER NOT NULL,
      success_rate REAL NOT NULL,
      cost_efficiency REAL NOT NULL,
      latency REAL NOT NULL,
      trust_score REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES mission_threads(id),
      FOREIGN KEY (reply_id) REFERENCES mission_replies(id),
      FOREIGN KEY (rater_id) REFERENCES mission_actors(id)
    );

    CREATE TABLE IF NOT EXISTS mission_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_mission_threads_status ON mission_threads(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mission_proposals_thread ON mission_proposals(thread_id);
    CREATE INDEX IF NOT EXISTS idx_mission_executions_thread ON mission_executions(thread_id);
    CREATE INDEX IF NOT EXISTS idx_mission_events_id ON mission_events(id);
  `);

  const actorCount = db.query("SELECT COUNT(*) AS count FROM mission_actors").get() as { count: number };
  if (actorCount.count === 0) {
    db.exec(`
      INSERT INTO mission_actors(name, role, domain, trust_score, capabilities_json) VALUES
      ('Team Operator', 'human', 'ops', 0.92, '["*:"]'),
      ('Team Agent', 'agent', 'automation', 0.86, '["*:"]');
    `);
  }
}

export function listThreads(status?: ThreadStatus) {
  const sql = `
    SELECT
      t.id,
      t.title,
      t.intent,
      t.budget,
      t.status,
      t.lifecycle_status,
      t.stage,
      t.selected_proposal_id,
      t.assigned_agent_id,
      t.created_at,
      t.updated_at,
      a.name AS creator_name,
      COALESCE((SELECT COUNT(*) FROM mission_replies r WHERE r.thread_id = t.id), 0) AS reply_count,
      COALESCE((SELECT ROUND(AVG(confidence), 2) FROM mission_replies r WHERE r.thread_id = t.id AND r.confidence IS NOT NULL), 0) AS avg_confidence
    FROM mission_threads t
    JOIN mission_actors a ON a.id = t.creator_id
    ${status ? "WHERE t.status = ?" : ""}
    ORDER BY t.updated_at DESC, t.id DESC
  `;
  return (status ? db.query(sql).all(status) : db.query(sql).all()) as Array<Record<string, unknown>>;
}

export function getThread(threadId: number) {
  const thread = db
    .query(`
      SELECT t.*, a.name AS creator_name, a.role AS creator_role
      FROM mission_threads t
      JOIN mission_actors a ON a.id = t.creator_id
      WHERE t.id = ?
    `)
    .get(threadId) as Record<string, unknown> | undefined;

  if (!thread) return null;

  const replies = db
    .query(`
      SELECT r.*, a.name AS author_name, a.role AS author_role, a.domain AS author_domain
      FROM mission_replies r
      JOIN mission_actors a ON a.id = r.author_id
      WHERE r.thread_id = ?
      ORDER BY r.id ASC
    `)
    .all(threadId) as Array<Record<string, unknown>>;

  const proposals = listProposals(threadId);
  const executions = listExecutions(threadId);

  const metrics = db
    .query(`
      SELECT
        ROUND(AVG(success_rate), 2) AS success_rate,
        ROUND(AVG(cost_efficiency), 2) AS cost_efficiency,
        ROUND(AVG(latency), 2) AS latency,
        ROUND(AVG(trust_score), 2) AS trust_score,
        COUNT(*) AS count
      FROM mission_metrics
      WHERE thread_id = ?
    `)
    .get(threadId) as Record<string, unknown>;

  return { thread, replies, proposals, executions, metrics };
}

export function createThread(input: {
  title: string;
  intent: string;
  budget?: number | null;
  constraints_json: string;
  body: string;
  creator_id: number;
}) {
  const row = db
    .query(`
      INSERT INTO mission_threads (title, intent, budget, constraints_json, body, status, lifecycle_status, stage, creator_id)
      VALUES (?, ?, ?, ?, ?, 'task', 'open', 'task', ?)
      RETURNING id
    `)
    .get(input.title, input.intent, input.budget ?? null, input.constraints_json, input.body, input.creator_id) as {
    id: number;
  };

  addEvent("new_task", { thread_id: row.id, intent: input.intent, title: input.title });
  return row.id;
}

export function createReply(input: {
  thread_id: number;
  author_id: number;
  reply_type: ReplyType;
  body: string;
  action?: string;
  target?: string;
  estimated_cost?: number | null;
  confidence?: number | null;
  executable_json?: string;
}) {
  db.query(`
    INSERT INTO mission_replies(thread_id, author_id, reply_type, body, action, target, estimated_cost, confidence, executable_json)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.thread_id,
    input.author_id,
    input.reply_type,
    input.body,
    input.action ?? "",
    input.target ?? "",
    input.estimated_cost ?? null,
    input.confidence ?? null,
    input.executable_json ?? ""
  );

  db.query("UPDATE mission_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);
}

export function createProposal(input: {
  thread_id: number;
  type?: "proposal" | "result";
  plan_json: string;
  cost_estimate?: number | null;
  latency_estimate?: number | null;
  confidence?: number | null;
  agent_id: number;
}) {
  const row = db
    .query(`
      INSERT INTO mission_proposals(thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `)
    .get(
      input.thread_id,
      input.type ?? "proposal",
      input.plan_json,
      input.cost_estimate ?? null,
      input.latency_estimate ?? null,
      input.confidence ?? null,
      input.agent_id
    ) as { id: number };

  db.query("UPDATE mission_threads SET stage = 'plan', status = 'plan', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);
  addEvent("proposal_submitted", { thread_id: input.thread_id, proposal_id: row.id, agent_id: input.agent_id });
  return row.id;
}

export function listProposals(threadId: number): Proposal[] {
  return db
    .query(`
      SELECT id, thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id, created_at
      FROM mission_proposals
      WHERE thread_id = ?
      ORDER BY id ASC
    `)
    .all(threadId) as Proposal[];
}

export function selectProposal(input: { thread_id: number; proposal_id: number; assigned_agent_id?: number | null }) {
  const proposal = db
    .query("SELECT id, agent_id FROM mission_proposals WHERE id = ? AND thread_id = ?")
    .get(input.proposal_id, input.thread_id) as { id: number; agent_id: number } | undefined;

  if (!proposal) return null;

  const assigned = input.assigned_agent_id ?? proposal.agent_id;
  db.query(`
      UPDATE mission_threads
      SET selected_proposal_id = ?, assigned_agent_id = ?, stage = 'execution', status = 'execution', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.proposal_id, assigned, input.thread_id);

  addEvent("proposal_selected", {
    thread_id: input.thread_id,
    proposal_id: input.proposal_id,
    assigned_agent_id: assigned,
  });

  return { assigned_agent_id: assigned };
}

export function createExecution(input: {
  thread_id: number;
  proposal_id: number;
  executor_agent_id: number;
  status?: ExecutionStatus;
  logs_json?: string;
  result_json?: string;
}) {
  const row = db
    .query(`
      INSERT INTO mission_executions(thread_id, proposal_id, executor_agent_id, status, logs_json, result_json, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'running' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
      RETURNING id
    `)
    .get(
      input.thread_id,
      input.proposal_id,
      input.executor_agent_id,
      input.status ?? "pending",
      input.logs_json ?? "[]",
      input.result_json ?? "{}",
      input.status ?? "pending"
    ) as { id: number };

  db.query("UPDATE mission_threads SET stage = 'execution', status = 'execution', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);

  addEvent("execution_created", {
    execution_id: row.id,
    thread_id: input.thread_id,
    proposal_id: input.proposal_id,
    executor_agent_id: input.executor_agent_id,
  });

  return row.id;
}

export function updateExecution(input: {
  execution_id: number;
  status?: ExecutionStatus;
  logs_json?: string;
  result_json?: string;
}) {
  const curr = db
    .query("SELECT id, thread_id, status FROM mission_executions WHERE id = ?")
    .get(input.execution_id) as { id: number; thread_id: number; status: ExecutionStatus } | undefined;
  if (!curr) return null;

  const nextStatus = input.status ?? curr.status;

  db.query(`
      UPDATE mission_executions
      SET status = ?,
          logs_json = COALESCE(?, logs_json),
          result_json = COALESCE(?, result_json),
          started_at = CASE WHEN started_at IS NULL AND ? = 'running' THEN CURRENT_TIMESTAMP ELSE started_at END,
          finished_at = CASE WHEN ? IN ('done','failed') THEN CURRENT_TIMESTAMP ELSE finished_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextStatus, input.logs_json ?? null, input.result_json ?? null, nextStatus, nextStatus, input.execution_id);

  if (nextStatus === "done") {
    db.query(
      "UPDATE mission_threads SET stage = 'result', status = 'closed', lifecycle_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(curr.thread_id);
  }

  addEvent("execution_update", {
    execution_id: input.execution_id,
    thread_id: curr.thread_id,
    status: nextStatus,
  });

  return { thread_id: curr.thread_id, status: nextStatus };
}

export function listAgentTasks(input: { agent_id?: number; intent?: string; limit?: number }) {
  const limit = input.limit ?? 20;
  let intentList: string[] = [];

  if (input.agent_id) {
    const row = db
      .query("SELECT capabilities_json FROM mission_actors WHERE id = ? AND role = 'agent'")
      .get(input.agent_id) as { capabilities_json: string } | undefined;
    if (row) {
      try {
        intentList = JSON.parse(row.capabilities_json) as string[];
      } catch {
        intentList = [];
      }
    }
  }

  const tasks = db
    .query(`
      SELECT id, title, intent, budget, constraints_json, body, stage, lifecycle_status, selected_proposal_id, assigned_agent_id, created_at
      FROM mission_threads
      WHERE lifecycle_status = 'open'
        AND (selected_proposal_id IS NULL OR assigned_agent_id = ?)
      ORDER BY created_at ASC
      LIMIT ?
    `)
    .all(input.agent_id ?? -1, limit) as Array<{
    id: number;
    title: string;
    intent: string;
    budget: number | null;
    constraints_json: string;
    body: string;
    stage: ThreadStage;
    lifecycle_status: ThreadLifecycle;
    selected_proposal_id: number | null;
    assigned_agent_id: number | null;
    created_at: string;
  }>;

  return tasks.filter((t) => {
    if (input.intent && t.intent !== input.intent) return false;
    if (!intentList.length) return true;
    return intentList.includes("*:") || intentList.includes(t.intent);
  });
}

export function addEvent(type: string, payload: unknown) {
  db.query("INSERT INTO mission_events(type, payload_json) VALUES(?, ?)").run(type, JSON.stringify(payload));
}

export function listEventsAfter(lastId: number, limit = 100): EventRow[] {
  return db
    .query(`
      SELECT id, type, payload_json, created_at
      FROM mission_events
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `)
    .all(lastId, limit) as EventRow[];
}

export function listExecutions(threadId?: number): Execution[] {
  const sql = `
    SELECT id, thread_id, proposal_id, executor_agent_id, status, logs_json, result_json, started_at, finished_at, created_at, updated_at
    FROM mission_executions
    ${threadId ? "WHERE thread_id = ?" : ""}
    ORDER BY id DESC
    LIMIT 200
  `;
  return (threadId ? db.query(sql).all(threadId) : db.query(sql).all()) as Execution[];
}
