import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { BomLine, JobRecord, QuoteResult, SubmitBomInput } from "../types";
import { resolveRuntimeEnv } from "../runtime-env";

export interface JobData {
  job: JobRecord;
  input: SubmitBomInput;
  lines: BomLine[];
  quote?: QuoteResult;
}

export interface StoredPartPrice {
  unitPrice: number;
  supplier?: string;
  currency: string;
  sourceType: "manual" | "nl" | "manual_quote_sheet" | "catalog" | "digikey_cn" | "ickey_cn" | "ic_net";
  sourceRef?: string;
  effectiveAt: string;
  expiresAt?: string;
}

const runtimeEnv = resolveRuntimeEnv();
const DB_PATH = runtimeEnv.dbPath;
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

function serializeSubmitBomInput(input: SubmitBomInput): SubmitBomInput {
  if (input.content instanceof Uint8Array) {
    return { ...input, content: Array.from(input.content) };
  }
  if (input.content instanceof ArrayBuffer) {
    return { ...input, content: Array.from(new Uint8Array(input.content)) };
  }
  return input;
}

function deserializeSubmitBomInput(input: SubmitBomInput): SubmitBomInput {
  return input;
}

function ensureBomLinesColumn(columnName: string, definition: string): void {
  try {
    db.exec(`ALTER TABLE bom_lines ADD COLUMN ${definition};`);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (!message.includes(`duplicate column name: ${columnName.toLowerCase()}`)) {
      throw error;
    }
  }
}

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
  designator TEXT,
  manufacturer TEXT,
  raw_text TEXT,
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

ensureBomLinesColumn("designator", "designator TEXT");
ensureBomLinesColumn("manufacturer", "manufacturer TEXT");
ensureBomLinesColumn("raw_text", "raw_text TEXT");

function insertTask(data: JobData): void {
  const insertTaskStmt = db.prepare(`
    INSERT INTO quote_tasks (
      id, status, created_at, updated_at, progress, source_type, customer, line_count, input_json, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLineStmt = db.prepare(`
    INSERT INTO bom_lines (
      task_id, line_no, part_number, quantity, unit_price, description, designator, manufacturer, raw_text
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(serializeSubmitBomInput(data.input)),
      data.job.error ?? null,
    );

    data.lines.forEach((line, idx) => {
      insertLineStmt.run(
        data.job.jobId,
        line.lineNo ?? idx + 1,
        line.partNumber,
        line.quantity,
        line.unitPrice ?? null,
        line.description ?? null,
        line.designator ?? null,
        line.manufacturer ?? null,
        line.rawText ?? null,
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
      `SELECT line_no, part_number, quantity, unit_price, description, designator, manufacturer
             , raw_text
       FROM bom_lines WHERE task_id = ? ORDER BY line_no ASC`,
    )
    .all(jobId) as Array<{
      line_no: number;
      part_number: string;
      quantity: number;
      unit_price: number | null;
      description: string | null;
      designator: string | null;
      manufacturer: string | null;
      raw_text: string | null;
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
    input: deserializeSubmitBomInput(JSON.parse(taskRow.input_json) as SubmitBomInput),
    lines: lineRows.map((row) => ({
      lineNo: row.line_no,
      partNumber: row.part_number,
      quantity: row.quantity,
      unitPrice: row.unit_price ?? undefined,
      description: row.description ?? undefined,
      designator: row.designator ?? undefined,
      manufacturer: row.manufacturer ?? undefined,
      rawText: row.raw_text ?? undefined,
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
      JSON.stringify(serializeSubmitBomInput(data.input)),
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

export function upsertWebPartPrice(params: {
  partNumber: string;
  unitPrice: number;
  supplier: "digikey_cn" | "ickey_cn" | "ic_net";
  currency?: string;
  sourceRef?: string;
}): void {
  const now = new Date().toISOString();
  const ttlDays = params.supplier === "digikey_cn" ? 7 : 3;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const normalizedPart = params.partNumber.trim().toUpperCase();

  const latest = db
    .prepare(
      `SELECT unit_price FROM part_prices WHERE part_number_norm = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
    )
    .get(normalizedPart) as { unit_price: number } | undefined;

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO part_prices (
        part_number_norm, supplier, currency, unit_price, source_type, source_ref, effective_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      normalizedPart,
      params.supplier,
      params.currency ?? "CNY",
      params.unitPrice,
      params.supplier,
      params.sourceRef ?? null,
      now,
      expiresAt,
    );

    db.prepare(
      `INSERT INTO price_adjustments (
        part_number_norm, old_price, new_price, reason, operator_type, operator_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      normalizedPart,
      latest?.unit_price ?? null,
      params.unitPrice,
      `web price cache refresh (${params.supplier})`,
      "agent",
      null,
      now,
    );
  });

  run();
}


export function getLatestPartPrice(partNumber: string): StoredPartPrice | null {
  const normalizedPart = partNumber.trim().toUpperCase();
  const row = db
    .prepare(
      `SELECT unit_price, supplier, currency, source_type, source_ref, effective_at, expires_at
       FROM part_prices WHERE part_number_norm = ? ORDER BY effective_at DESC, id DESC LIMIT 1`,
    )
    .get(normalizedPart) as
    | {
        unit_price: number;
        supplier: string | null;
        currency: string;
        source_type: StoredPartPrice["sourceType"];
        source_ref: string | null;
        effective_at: string;
        expires_at: string | null;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    unitPrice: row.unit_price,
    supplier: row.supplier ?? undefined,
    currency: row.currency,
    sourceType: row.source_type,
    sourceRef: row.source_ref ?? undefined,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

function insertTaskEvent(taskId: string, eventType: string, payload: Record<string, unknown>): void {
  db.prepare(`INSERT INTO task_events (task_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?)`).run(
    taskId,
    eventType,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}
