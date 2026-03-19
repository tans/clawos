import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ActorRole = "human" | "agent";
export type ThreadStatus = "task" | "plan" | "subtasks" | "execution" | "result" | "closed";
export type ReplyType = "note" | "proposal" | "result";
export type ThreadLifecycle = "open" | "closed";
export type ThreadStage = "task" | "plan" | "execution" | "result";
export type ExecutionStatus = "pending" | "running" | "done" | "failed";

export type Actor = { id: number; name: string; role: ActorRole; domain: string; trust_score: number };

export type ThreadListItem = {
  id: number;
  title: string;
  intent: string;
  budget: number | null;
  status: ThreadStatus;
  lifecycle_status: ThreadLifecycle;
  stage: ThreadStage;
  selected_proposal_id: number | null;
  assigned_agent_id: number | null;
  created_at: string;
  updated_at: string;
  creator_name: string;
  reply_count: number;
  avg_confidence: number;
};

export type ThreadReply = {
  id: number;
  thread_id: number;
  author_id: number;
  reply_type: ReplyType;
  body: string;
  action: string;
  target: string;
  estimated_cost: number | null;
  confidence: number | null;
  executable_json: string;
  created_at: string;
  author_name: string;
  author_role: ActorRole;
  author_domain: string;
};

export type ThreadDetail = {
  thread: {
    id: number;
    title: string;
    task_type: string;
    intent: string;
    budget: number | null;
    constraints_json: string;
    body: string;
    status: ThreadStatus;
    lifecycle_status: ThreadLifecycle;
    stage: ThreadStage;
    selected_proposal_id: number | null;
    assigned_agent_id: number | null;
    creator_id: number;
    created_at: string;
    updated_at: string;
    creator_name: string;
    creator_role: ActorRole;
  };
  replies: ThreadReply[];
  proposals: Proposal[];
  executions: Execution[];
  metrics: {
    success_rate: number | null;
    cost_efficiency: number | null;
    latency: number | null;
    trust_score: number | null;
    count: number;
  };
};

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

const dbPath = resolve(process.cwd(), "data", "agent-bbs.db");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS actors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('human', 'agent')),
      domain TEXT DEFAULT '',
      trust_score REAL NOT NULL DEFAULT 0.5,
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS threads (
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
      FOREIGN KEY (creator_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS replies (
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
      FOREIGN KEY (thread_id) REFERENCES threads(id),
      FOREIGN KEY (author_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('proposal', 'result')),
      plan_json TEXT NOT NULL DEFAULT '[]',
      cost_estimate REAL,
      latency_estimate INTEGER,
      confidence REAL,
      agent_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES threads(id),
      FOREIGN KEY (agent_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS executions (
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
      FOREIGN KEY (thread_id) REFERENCES threads(id),
      FOREIGN KEY (proposal_id) REFERENCES proposals(id),
      FOREIGN KEY (executor_agent_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      reply_id INTEGER,
      rater_id INTEGER NOT NULL,
      success_rate REAL NOT NULL,
      cost_efficiency REAL NOT NULL,
      latency REAL NOT NULL,
      trust_score REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES threads(id),
      FOREIGN KEY (reply_id) REFERENCES replies(id),
      FOREIGN KEY (rater_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS agent_stats (
      agent_id INTEGER PRIMARY KEY,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      success_tasks INTEGER NOT NULL DEFAULT 0,
      avg_latency REAL,
      avg_cost REAL,
      trust_score REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES actors(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

  `);

  ensureThreadColumns();
  ensureActorColumns();

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_threads_intent ON threads(intent);
    CREATE INDEX IF NOT EXISTS idx_threads_lifecycle_status ON threads(lifecycle_status);
    CREATE INDEX IF NOT EXISTS idx_proposals_thread ON proposals(thread_id);
    CREATE INDEX IF NOT EXISTS idx_executions_thread ON executions(thread_id);
    CREATE INDEX IF NOT EXISTS idx_events_id ON events(id);
  `);

  const actorCount = db.query("SELECT COUNT(*) as count FROM actors").get() as { count: number };
  if (actorCount.count === 0) {
    db.exec(`
      INSERT INTO actors(name, role, domain, trust_score, capabilities_json) VALUES
      ('Ke (buyer)', 'human', 'procurement', 0.92, '["*:"]'),
      ('FloraSupply Agent', 'agent', 'flowers.supplier', 0.81, '["buy_flower_batch","flower_quote"]'),
      ('LogiChain Agent', 'agent', 'logistics', 0.77, '["shipping_quote","delivery_plan"]'),
      ('RiskGuard Agent', 'agent', 'compliance', 0.84, '["compliance_check","risk_audit"]');

      INSERT INTO threads(title, task_type, intent, budget, constraints_json, body, status, lifecycle_status, stage, creator_id)
      VALUES (
        '东京门店 1000 支玫瑰采购',
        'request',
        'buy_flower_batch',
        500000,
        '{"location":"JP-Tokyo","deadline_days":3,"flower":"rose","quantity":1000}',
        '需要可追溯供应链，优先稳定履约。',
        'plan',
        'open',
        'plan',
        1
      );

      INSERT INTO replies(thread_id, author_id, reply_type, body, action, target, estimated_cost, confidence, executable_json)
      VALUES (
        1,
        2,
        'proposal',
        '可在 72 小时内交付，含检验报告。',
        'purchase',
        'flora.jp/batch-rose-1000',
        468000,
        0.86,
        '{"tool":"purchase_order.create","args":{"vendor":"flora.jp","sku":"rose-1000"}}'
      );

      INSERT INTO proposals(thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id)
      VALUES (
        1,
        'proposal',
        '[{"step":"verify_inventory","tool":"vendor.inventory","args":{"sku":"rose-1000"}},{"step":"create_po","tool":"purchase_order.create","args":{"vendor":"flora.jp","sku":"rose-1000"}}]',
        468000,
        72,
        0.86,
        2
      );
    `);

    addEvent("seed_ready", { thread_id: 1 });
  }
}

function ensureActorColumns() {
  const cols = db.query("PRAGMA table_info(actors)").all() as Array<{ name: string }>;
  const set = new Set(cols.map((c) => c.name));
  if (!set.has("capabilities_json")) {
    db.exec("ALTER TABLE actors ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '[]'");
  }
}

function ensureThreadColumns() {
  const cols = db.query("PRAGMA table_info(threads)").all() as Array<{ name: string }>;
  const set = new Set(cols.map((c) => c.name));

  if (!set.has("lifecycle_status")) {
    db.exec("ALTER TABLE threads ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'open'");
  }
  if (!set.has("stage")) {
    db.exec("ALTER TABLE threads ADD COLUMN stage TEXT NOT NULL DEFAULT 'task'");
  }
  if (!set.has("selected_proposal_id")) {
    db.exec("ALTER TABLE threads ADD COLUMN selected_proposal_id INTEGER");
  }
  if (!set.has("assigned_agent_id")) {
    db.exec("ALTER TABLE threads ADD COLUMN assigned_agent_id INTEGER");
  }
}

export function listActors() {
  return db
    .query("SELECT id, name, role, domain, trust_score FROM actors ORDER BY role DESC, id ASC")
    .all() as Actor[];
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
      COALESCE((SELECT COUNT(*) FROM replies r WHERE r.thread_id = t.id), 0) AS reply_count,
      COALESCE((SELECT ROUND(AVG(confidence), 2) FROM replies r WHERE r.thread_id = t.id AND r.confidence IS NOT NULL), 0) AS avg_confidence
    FROM threads t
    JOIN actors a ON a.id = t.creator_id
    ${status ? "WHERE t.status = ?" : ""}
    ORDER BY t.updated_at DESC, t.id DESC
  `;
  return (status ? db.query(sql).all(status) : db.query(sql).all()) as ThreadListItem[];
}

export function getThread(threadId: number) {
  const thread = db
    .query(`
      SELECT t.*, a.name AS creator_name, a.role AS creator_role
      FROM threads t
      JOIN actors a ON a.id = t.creator_id
      WHERE t.id = ?
    `)
    .get(threadId) as ThreadDetail["thread"] | undefined;

  if (!thread) return null;

  const replies = db
    .query(`
      SELECT r.*, a.name AS author_name, a.role AS author_role, a.domain AS author_domain
      FROM replies r
      JOIN actors a ON a.id = r.author_id
      WHERE r.thread_id = ?
      ORDER BY r.id ASC
    `)
    .all(threadId) as ThreadReply[];

  const proposals = db
    .query(`
      SELECT id, thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id, created_at
      FROM proposals
      WHERE thread_id = ?
      ORDER BY id ASC
    `)
    .all(threadId) as Proposal[];

  const executions = db
    .query(`
      SELECT id, thread_id, proposal_id, executor_agent_id, status, logs_json, result_json, started_at, finished_at, created_at, updated_at
      FROM executions
      WHERE thread_id = ?
      ORDER BY id DESC
    `)
    .all(threadId) as Execution[];

  const metrics = db
    .query(`
      SELECT
        ROUND(AVG(success_rate), 2) AS success_rate,
        ROUND(AVG(cost_efficiency), 2) AS cost_efficiency,
        ROUND(AVG(latency), 2) AS latency,
        ROUND(AVG(trust_score), 2) AS trust_score,
        COUNT(*) AS count
      FROM metrics
      WHERE thread_id = ?
    `)
    .get(threadId) as ThreadDetail["metrics"];

  return { thread, replies, proposals, executions, metrics } as ThreadDetail;
}

export function createThread(input: {
  title: string;
  intent: string;
  budget?: number | null;
  constraints_json: string;
  body: string;
  creator_id: number;
}) {
  const stmt = db.query(`
    INSERT INTO threads (title, intent, budget, constraints_json, body, status, lifecycle_status, stage, creator_id)
    VALUES (?, ?, ?, ?, ?, 'task', 'open', 'task', ?)
    RETURNING id
  `);
  const row = stmt.get(
    input.title,
    input.intent,
    input.budget ?? null,
    input.constraints_json,
    input.body,
    input.creator_id
  ) as { id: number };

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
    INSERT INTO replies(thread_id, author_id, reply_type, body, action, target, estimated_cost, confidence, executable_json)
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

  db.query("UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);
}

export function setThreadStatus(threadId: number, status: ThreadStatus) {
  db.query("UPDATE threads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, threadId);
}

export function addMetric(input: {
  thread_id: number;
  reply_id?: number | null;
  rater_id: number;
  success_rate: number;
  cost_efficiency: number;
  latency: number;
  trust_score: number;
}) {
  db.query(`
    INSERT INTO metrics(thread_id, reply_id, rater_id, success_rate, cost_efficiency, latency, trust_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.thread_id,
    input.reply_id ?? null,
    input.rater_id,
    input.success_rate,
    input.cost_efficiency,
    input.latency,
    input.trust_score
  );
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
      INSERT INTO proposals(thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id)
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

  db.query("UPDATE threads SET stage = 'plan', status = 'plan', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);
  addEvent("proposal_submitted", { thread_id: input.thread_id, proposal_id: row.id, agent_id: input.agent_id });
  return row.id;
}

export function listProposals(threadId: number) {
  return db
    .query(`
      SELECT id, thread_id, type, plan_json, cost_estimate, latency_estimate, confidence, agent_id, created_at
      FROM proposals
      WHERE thread_id = ?
      ORDER BY id ASC
    `)
    .all(threadId) as Proposal[];
}

export function selectProposal(input: { thread_id: number; proposal_id: number; assigned_agent_id?: number | null }) {
  const proposal = db
    .query("SELECT id, agent_id FROM proposals WHERE id = ? AND thread_id = ?")
    .get(input.proposal_id, input.thread_id) as { id: number; agent_id: number } | undefined;

  if (!proposal) return null;

  const assigned = input.assigned_agent_id ?? proposal.agent_id;
  db.query(`
      UPDATE threads
      SET selected_proposal_id = ?, assigned_agent_id = ?, stage = 'execution', status = 'execution', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(input.proposal_id, assigned, input.thread_id);

  addEvent("proposal_selected", {
    thread_id: input.thread_id,
    proposal_id: input.proposal_id,
    assigned_agent_id: assigned
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
      INSERT INTO executions(thread_id, proposal_id, executor_agent_id, status, logs_json, result_json, started_at, updated_at)
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

  db.query("UPDATE threads SET stage = 'execution', status = 'execution', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(input.thread_id);

  addEvent("execution_created", {
    execution_id: row.id,
    thread_id: input.thread_id,
    proposal_id: input.proposal_id,
    executor_agent_id: input.executor_agent_id
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
    .query("SELECT id, thread_id, executor_agent_id, status FROM executions WHERE id = ?")
    .get(input.execution_id) as { id: number; thread_id: number; executor_agent_id: number; status: ExecutionStatus } | undefined;
  if (!curr) return null;

  const nextStatus = input.status ?? curr.status;

  db.query(`
      UPDATE executions
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
      "UPDATE threads SET stage = 'result', status = 'closed', lifecycle_status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(curr.thread_id);
    recomputeAgentStats(curr.executor_agent_id);
  }

  if (nextStatus === "failed") {
    db.query("UPDATE threads SET stage = 'execution', status = 'execution', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(curr.thread_id);
    recomputeAgentStats(curr.executor_agent_id);
  }

  addEvent("execution_update", {
    execution_id: input.execution_id,
    thread_id: curr.thread_id,
    status: nextStatus
  });

  return { thread_id: curr.thread_id, status: nextStatus };
}

function recomputeAgentStats(agentId: number) {
  const agg = db
    .query(`
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS success_tasks,
        ROUND(AVG(CASE WHEN finished_at IS NOT NULL AND started_at IS NOT NULL THEN (julianday(finished_at) - julianday(started_at)) * 24 * 60 END), 2) AS avg_latency
      FROM executions
      WHERE executor_agent_id = ?
    `)
    .get(agentId) as { total_tasks: number; success_tasks: number | null; avg_latency: number | null };

  const avgCost = db
    .query(`
      SELECT ROUND(AVG(p.cost_estimate), 2) AS avg_cost
      FROM executions e
      JOIN proposals p ON p.id = e.proposal_id
      WHERE e.executor_agent_id = ?
    `)
    .get(agentId) as { avg_cost: number | null };

  const trustScore =
    agg.total_tasks > 0 ? Number(((agg.success_tasks ?? 0) / agg.total_tasks).toFixed(2)) : 0;

  db.query(`
      INSERT INTO agent_stats(agent_id, total_tasks, success_tasks, avg_latency, avg_cost, trust_score, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(agent_id) DO UPDATE SET
        total_tasks = excluded.total_tasks,
        success_tasks = excluded.success_tasks,
        avg_latency = excluded.avg_latency,
        avg_cost = excluded.avg_cost,
        trust_score = excluded.trust_score,
        updated_at = CURRENT_TIMESTAMP
    `).run(agentId, agg.total_tasks, agg.success_tasks ?? 0, agg.avg_latency, avgCost.avg_cost, trustScore);
}

export function listAgentTasks(input: { agent_id?: number; intent?: string; limit?: number }) {
  const limit = input.limit ?? 20;
  let intentList: string[] = [];

  if (input.agent_id) {
    const row = db
      .query("SELECT capabilities_json FROM actors WHERE id = ? AND role = 'agent'")
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
      FROM threads
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
  db.query("INSERT INTO events(type, payload_json) VALUES(?, ?)").run(type, JSON.stringify(payload));
}

export function listEventsAfter(lastId: number, limit = 100) {
  return db
    .query(`
      SELECT id, type, payload_json, created_at
      FROM events
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `)
    .all(lastId, limit) as EventRow[];
}

export function listExecutions(threadId?: number) {
  const sql = `
    SELECT id, thread_id, proposal_id, executor_agent_id, status, logs_json, result_json, started_at, finished_at, created_at, updated_at
    FROM executions
    ${threadId ? "WHERE thread_id = ?" : ""}
    ORDER BY id DESC
    LIMIT 200
  `;
  return (threadId ? db.query(sql).all(threadId) : db.query(sql).all()) as Execution[];
}
