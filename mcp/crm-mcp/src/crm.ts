import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type {
  CustomerInput,
  CustomerRecord,
  DealInput,
  DealRecord,
  InteractionInput,
  InteractionRecord,
} from "./types";

const DEFAULT_DB_PATH = resolve(import.meta.dir, "..", "data", "crm.sqlite");

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} 不能为空`);
  }
  return value.trim();
}

function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((value) => {
      const text = value == null ? "" : String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
    .join(",");
}

export class CrmStore {
  private readonly db: Database;

  constructor(dbPath = DEFAULT_DB_PATH) {
    const resolved = resolve(dbPath);
    mkdirSync(dirname(resolved), { recursive: true });
    this.db = new Database(resolved, { create: true });
    this.initSchema();
  }

  initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'note',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'lead',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_customer_id ON interactions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
    `);
  }

  createCustomer(input: CustomerInput): CustomerRecord {
    const name = assertNonEmpty(input.name, "name");
    const stmt = this.db.prepare(
      "INSERT INTO customers (name, email, phone, company) VALUES (?, ?, ?, ?) RETURNING id, name, email, phone, company, created_at as createdAt",
    );
    return stmt.get(name, input.email?.trim() || null, input.phone?.trim() || null, input.company?.trim() || null) as CustomerRecord;
  }

  listCustomers(limit = 50): CustomerRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 50;
    const stmt = this.db.prepare(
      "SELECT id, name, email, phone, company, created_at as createdAt FROM customers ORDER BY id DESC LIMIT ?",
    );
    return stmt.all(safeLimit) as CustomerRecord[];
  }

  createInteraction(input: InteractionInput): InteractionRecord {
    const note = assertNonEmpty(input.note, "note");
    const channel = input.channel?.trim() || "note";
    const stmt = this.db.prepare(
      "INSERT INTO interactions (customer_id, note, channel) VALUES (?, ?, ?) RETURNING id, customer_id as customerId, note, channel, created_at as createdAt",
    );
    return stmt.get(input.customerId, note, channel) as InteractionRecord;
  }

  createDeal(input: DealInput): DealRecord {
    const title = assertNonEmpty(input.title, "title");
    const amount = Number.isFinite(input.amount) ? Number(input.amount) : 0;
    const stage = input.stage?.trim() || "lead";
    const stmt = this.db.prepare(
      "INSERT INTO deals (customer_id, title, amount, stage) VALUES (?, ?, ?, ?) RETURNING id, customer_id as customerId, title, amount, stage, created_at as createdAt",
    );
    return stmt.get(input.customerId, title, amount, stage) as DealRecord;
  }

  listDeals(customerId?: number): DealRecord[] {
    if (customerId && Number.isFinite(customerId)) {
      const stmt = this.db.prepare(
        "SELECT id, customer_id as customerId, title, amount, stage, created_at as createdAt FROM deals WHERE customer_id = ? ORDER BY id DESC",
      );
      return stmt.all(customerId) as DealRecord[];
    }
    const stmt = this.db.prepare(
      "SELECT id, customer_id as customerId, title, amount, stage, created_at as createdAt FROM deals ORDER BY id DESC LIMIT 200",
    );
    return stmt.all() as DealRecord[];
  }

  async exportCustomersCsv(filePath: string): Promise<{ filePath: string; count: number }> {
    const outputPath = resolve(filePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    const rows = this.db
      .prepare(
        `SELECT
          c.id,
          c.name,
          c.email,
          c.phone,
          c.company,
          c.created_at as createdAt,
          COUNT(DISTINCT i.id) as interactionCount,
          COUNT(DISTINCT d.id) as dealCount,
          COALESCE(SUM(d.amount), 0) as totalDealAmount
        FROM customers c
        LEFT JOIN interactions i ON i.customer_id = c.id
        LEFT JOIN deals d ON d.customer_id = c.id
        GROUP BY c.id
        ORDER BY c.id DESC`,
      )
      .all() as Array<{
      id: number;
      name: string;
      email: string | null;
      phone: string | null;
      company: string | null;
      createdAt: string;
      interactionCount: number;
      dealCount: number;
      totalDealAmount: number;
    }>;

    const lines = [
      toCsvRow([
        "id",
        "name",
        "email",
        "phone",
        "company",
        "createdAt",
        "interactionCount",
        "dealCount",
        "totalDealAmount",
      ]),
      ...rows.map((row) =>
        toCsvRow([
          row.id,
          row.name,
          row.email,
          row.phone,
          row.company,
          row.createdAt,
          row.interactionCount,
          row.dealCount,
          row.totalDealAmount,
        ]),
      ),
    ];

    await writeFile(outputPath, `${lines.join("\n")}\n`, "utf-8");
    return { filePath: outputPath, count: rows.length };
  }

  close(): void {
    this.db.close();
  }
}

export function createCrmStore(dbPath?: string): CrmStore {
  return new CrmStore(dbPath);
}
