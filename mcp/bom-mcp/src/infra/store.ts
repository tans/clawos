import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BomLine, JobRecord, QuoteResult, SubmitBomInput } from "../types";

export interface JobData {
  job: JobRecord;
  input: SubmitBomInput;
  lines: BomLine[];
  quote?: QuoteResult;
}

const DB_PATH = resolve(process.cwd(), "artifacts", "mcp", "bom-mcp", "bom-mcp.sqlite");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS quote_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  progress INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  customer TEXT,
  line_count INTEGER NOT NULL,
  input_json TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS bom_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  part_number TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL,
  description TEXT,
  FOREIGN KEY(task_id) REFERENCES quote_tasks(id)
);

CREATE TABLE IF NOT EXISTS quote_results (
  task_id TEXT PRIMARY KEY,
  quote_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES quote_tasks(id)
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  format TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES quote_tasks(id)
);

CREATE TABLE IF NOT EXISTS part_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number_norm TEXT NOT NULL,
  supplier TEXT,
  currency TEXT NOT NULL DEFAULT 'CNY',
  unit_price REAL NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  effective_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS price_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number_norm TEXT NOT NULL,
  old_price REAL,
  new_price REAL NOT NULL,
  reason TEXT,
  operator_type TEXT NOT NULL,
  operator_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
`);

function insertTask(data: JobData): void {
  const insertTaskStmt = db.prepare(`
    INSERT INTO quote_tasks (
      id, status, created_at, updated_at, progress, source_type, customer, line_count, input_json, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLineStmt = db.prepare(`
    INSERT INTO bom_lines (task_id, line_no, part_number, quantity, unit_price, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    insertTaskStmt.run(
      data.job.jobId,
      data.job.status,
      data.job.createdAt,
      data.job.updatedAt,
      data.job.progress,
      data.job.inputMeta.sourceType,
      data.job.inputMeta.customer ?? null,
      data.job.inputMeta.lineCount,
      JSON.stringify(data.input),
      data.job.error ?? null,
    );

    data.lines.forEach((line, idx) => {
      insertLineStmt.run(
        data.job.jobId,
        idx + 1,
        line.partNumber,
        line.quantity,
        line.unitPrice ?? null,
        line.description ?? null,
      );
    });

    insertTaskEvent(data.job.jobId, "task_created", {
      lineCount: data.lines.length,
      sourceType: data.job.inputMeta.sourceType,
    });
  });

  run();
}

function mapJobData(jobId: string): JobData | null {
  const taskRow = db
    .prepare(
      `SELECT id, status, created_at, updated_at, progress, source_type, customer, line_count, input_json, error
       FROM quote_tasks WHERE id = ?`,
    )
    .get(jobId) as
    | {
        id: string;
        status: JobRecord["status"];
        created_at: string;
        updated_at: string;
        progress: number;
        source_type: JobRecord["inputMeta"]["sourceType"];
        customer: string | null;
        line_count: number;
        input_json: string;
        error: string | null;
      }
    | undefined;

  if (!taskRow) {
    return null;
  }

  const lineRows = db
    .prepare(
      `SELECT part_number, quantity, unit_price, description
       FROM bom_lines WHERE task_id = ? ORDER BY line_no ASC`,
    )
    .all(jobId) as Array<{
      part_number: string;
      quantity: number;
      unit_price: number | null;
      description: string | null;
    }>;

  const quoteRow = db.prepare(`SELECT quote_json FROM quote_results WHERE task_id = ?`).get(jobId) as
    | { quote_json: string }
    | undefined;

  return {
    job: {
      jobId: taskRow.id,
      status: taskRow.status,
      createdAt: taskRow.created_at,
      updatedAt: taskRow.updated_at,
      progress: taskRow.progress,
      inputMeta: {
        sourceType: taskRow.source_type,
        lineCount: taskRow.line_count,
        customer: taskRow.customer ?? undefined,
      },
      error: taskRow.error ?? undefined,
    },
    input: JSON.parse(taskRow.input_json) as SubmitBomInput,
    lines: lineRows.map((row) => ({
      partNumber: row.part_number,
      quantity: row.quantity,
      unitPrice: row.unit_price ?? undefined,
      description: row.description ?? undefined,
    })),
    quote: quoteRow ? (JSON.parse(quoteRow.quote_json) as QuoteResult) : undefined,
  };
}

function persistJobData(data: JobData): void {
  const updateTaskStmt = db.prepare(`
    UPDATE quote_tasks
       SET status = ?, updated_at = ?, progress = ?, source_type = ?, customer = ?, line_count = ?, input_json = ?, error = ?
     WHERE id = ?
  `);

  const upsertQuoteStmt = db.prepare(`
    INSERT INTO quote_results (task_id, quote_json, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET quote_json = excluded.quote_json, created_at = excluded.created_at
  `);

  const run = db.transaction(() => {
    updateTaskStmt.run(
      data.job.status,
      data.job.updatedAt,
      data.job.progress,
      data.job.inputMeta.sourceType,
      data.job.inputMeta.customer ?? null,
      data.job.inputMeta.lineCount,
      JSON.stringify(data.input),
      data.job.error ?? null,
      data.job.jobId,
    );

    if (data.quote) {
      upsertQuoteStmt.run(data.job.jobId, JSON.stringify(data.quote), new Date().toISOString());
    }

    insertTaskEvent(data.job.jobId, "task_updated", {
      status: data.job.status,
      progress: data.job.progress,
      hasQuote: Boolean(data.quote),
    });
  });

  run();
}

export function createJob(data: JobData): void {
  insertTask(data);
}

export function getJob(jobId: string): JobData | null {
  return mapJobData(jobId);
}

export function updateJob(jobId: string, updater: (data: JobData) => JobData): JobData | null {
  const current = mapJobData(jobId);
  if (!current) {
    return null;
  }
  const next = updater(current);
  persistJobData(next);
  return next;
}

export function recordExport(params: {
  exportId: string;
  jobId: string;
  format: string;
  filePath: string;
  checksum?: string;
}): void {
  db.prepare(
    `INSERT INTO exports (id, task_id, format, file_path, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    params.exportId,
    params.jobId,
    params.format,
    params.filePath,
    params.checksum ?? null,
    new Date().toISOString(),
  );

  insertTaskEvent(params.jobId, "export_created", {
    exportId: params.exportId,
    format: params.format,
    filePath: params.filePath,
  });
}

export function upsertManualPartPrice(params: {
  partNumber: string;
  unitPrice: number;
  supplier?: string;
  currency?: string;
  sourceType?: "manual" | "nl" | "manual_quote_sheet";
  sourceRef?: string;
  reason?: string;
  operatorType: "agent" | "human";
  operatorId?: string;
}): void {
  const now = new Date().toISOString();
  const normalizedPart = params.partNumber.trim().toUpperCase();

  const latest = db
    .prepare(
      `SELECT unit_price FROM part_prices WHERE part_number_norm = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
    )
    .get(normalizedPart) as { unit_price: number } | undefined;

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO part_prices (
        part_number_norm, supplier, currency, unit_price, source_type, source_ref, effective_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      normalizedPart,
      params.supplier ?? null,
      params.currency ?? "CNY",
      params.unitPrice,
      params.sourceType ?? "manual",
      params.sourceRef ?? null,
      now,
    );

    db.prepare(
      `INSERT INTO price_adjustments (
        part_number_norm, old_price, new_price, reason, operator_type, operator_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      normalizedPart,
      latest?.unit_price ?? null,
      params.unitPrice,
      params.reason ?? null,
      params.operatorType,
      params.operatorId ?? null,
      now,
    );
  });

  run();
}


export function getLatestPartPrice(partNumber: string): number | null {
  const normalizedPart = partNumber.trim().toUpperCase();
  const row = db
    .prepare(
      `SELECT unit_price FROM part_prices WHERE part_number_norm = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
    )
    .get(normalizedPart) as { unit_price: number } | undefined;
  return row ? row.unit_price : null;
}

function insertTaskEvent(taskId: string, eventType: string, payload: Record<string, unknown>): void {
  db.prepare(`INSERT INTO task_events (task_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)`).run(
    taskId,
    eventType,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}
