import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ActorRole = "human" | "agent";
export type ThreadStatus = "task" | "plan" | "subtasks" | "execution" | "result" | "closed";
export type ReplyType = "note" | "proposal" | "result";

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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      task_type TEXT NOT NULL DEFAULT 'request',
      intent TEXT NOT NULL,
      budget INTEGER,
      constraints_json TEXT NOT NULL DEFAULT '{}',
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'task'
        CHECK(status IN ('task', 'plan', 'subtasks', 'execution', 'result', 'closed')),
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
      estimated_cost INTEGER,
      confidence REAL,
      executable_json TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (thread_id) REFERENCES threads(id),
      FOREIGN KEY (author_id) REFERENCES actors(id)
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
  `);

  const actorCount = db.query("SELECT COUNT(*) as count FROM actors").get() as { count: number };
  if (actorCount.count === 0) {
    db.exec(`
      INSERT INTO actors(name, role, domain, trust_score) VALUES
      ('Ke (buyer)', 'human', 'procurement', 0.92),
      ('FloraSupply Agent', 'agent', 'flowers.supplier', 0.81),
      ('LogiChain Agent', 'agent', 'logistics', 0.77),
      ('RiskGuard Agent', 'agent', 'compliance', 0.84);

      INSERT INTO threads(title, task_type, intent, budget, constraints_json, body, status, creator_id)
      VALUES (
        '东京门店 1000 支玫瑰采购',
        'request',
        'buy_flower_batch',
        500000,
        '{"location":"JP-Tokyo","deadline_days":3,"flower":"rose","quantity":1000}',
        '需要可追溯供应链，优先稳定履约。',
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
    `);
  }
}

export function listActors() {
  return db
    .query("SELECT id, name, role, domain, trust_score FROM actors ORDER BY role DESC, id ASC")
    .all() as Array<{ id: number; name: string; role: ActorRole; domain: string; trust_score: number }>;
}

export function listThreads(status?: ThreadStatus) {
  const sql = `
    SELECT
      t.id,
      t.title,
      t.intent,
      t.budget,
      t.status,
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
  return status ? db.query(sql).all(status) : db.query(sql).all();
}

export function getThread(threadId: number) {
  const thread = db
    .query(`
      SELECT t.*, a.name AS creator_name, a.role AS creator_role
      FROM threads t
      JOIN actors a ON a.id = t.creator_id
      WHERE t.id = ?
    `)
    .get(threadId) as
    | {
        id: number;
        title: string;
        task_type: string;
        intent: string;
        budget: number | null;
        constraints_json: string;
        body: string;
        status: ThreadStatus;
        creator_id: number;
        created_at: string;
        updated_at: string;
        creator_name: string;
        creator_role: ActorRole;
      }
    | undefined;

  if (!thread) return null;

  const replies = db
    .query(`
      SELECT r.*, a.name AS author_name, a.role AS author_role, a.domain AS author_domain
      FROM replies r
      JOIN actors a ON a.id = r.author_id
      WHERE r.thread_id = ?
      ORDER BY r.id ASC
    `)
    .all(threadId);

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
    .get(threadId) as {
    success_rate: number | null;
    cost_efficiency: number | null;
    latency: number | null;
    trust_score: number | null;
    count: number;
  };

  return { thread, replies, metrics };
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
    INSERT INTO threads (title, intent, budget, constraints_json, body, creator_id)
    VALUES (?, ?, ?, ?, ?, ?)
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
