import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type AccountRow = {
  id: string;
  name: string;
  currency: string;
  balanceCents: number;
  planCode: string | null;
  planExpiresAt: number | null;
  status: string;
  createdAt: number;
  updatedAt: number;
};

export type RechargeResult = {
  orderId: string;
  accountId: string;
  amountCents: number;
  currency: string;
  balanceCents: number;
  createdAt: number;
  idempotent: boolean;
};

export type RenewResult = {
  orderId: string;
  accountId: string;
  planCode: string;
  months: number;
  amountCents: number;
  currency: string;
  expiresAt: number;
  createdAt: number;
  idempotent: boolean;
};

export type UsageChargeResult = {
  accountId: string;
  chargedCents: number;
  balanceCents: number;
  planActive: boolean;
  planExpiresAt: number | null;
};

export type UsageSummaryResult = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  chargedCents: number;
  currency: string;
  byModel: Array<{
    modelAlias: string;
    resolvedModel: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number;
    chargedCents: number;
  }>;
};

export class BillingError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "token.db");
export const TOKEN_DB_PATH = process.env.TOKEN_DB_PATH?.trim() || process.env.ROUTER_DB_PATH?.trim() || DEFAULT_DB_PATH;

mkdirSync(path.dirname(TOKEN_DB_PATH), { recursive: true });

const db = new Database(TOKEN_DB_PATH, { create: true, strict: true });

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  plan_code TEXT,
  plan_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_mask TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recharge_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  channel TEXT NOT NULL,
  out_trade_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS renew_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  months INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  channel TEXT NOT NULL,
  out_trade_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  paid_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL,
  delta_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  model_alias TEXT NOT NULL,
  resolved_model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  charged_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_account_created ON usage_records(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON ledger_entries(account_id, created_at DESC);
`);

const getAccountStmt = db.query(`
  SELECT
    id,
    name,
    currency,
    balance_cents AS balanceCents,
    plan_code AS planCode,
    plan_expires_at AS planExpiresAt,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM accounts
  WHERE id = ?
`);

export function initializeBilling(args: {
  defaultAccountId: string;
  defaultAccountName: string;
  defaultCurrency?: string;
  seedApiKeys: Array<{ accountId: string; token: string }>;
}): void {
  ensureAccount(args.defaultAccountId, args.defaultAccountName, args.defaultCurrency || "CNY");

  for (const item of args.seedApiKeys) {
    ensureAccount(item.accountId, `Account ${item.accountId}`, args.defaultCurrency || "CNY");
    ensureApiKey(item.accountId, item.token);
  }
}

export function ensureAccount(accountId: string, name: string, currency: string): AccountRow {
  const now = nowMs();
  const exists = getAccount(accountId);
  if (exists) {
    return exists;
  }

  db.prepare(
    `INSERT INTO accounts (id, name, currency, balance_cents, status, created_at, updated_at)
     VALUES (?, ?, ?, 0, 'active', ?, ?)`
  ).run(accountId, name, currency, now, now);

  const account = getAccount(accountId);
  if (!account) {
    throw new BillingError("ACCOUNT_CREATE_FAILED", "创建账户失败。", 500);
  }
  return account;
}

export function getAccount(accountId: string): AccountRow | null {
  return getAccountStmt.get(accountId) as AccountRow | null;
}

export function resolveAccountByToken(token: string): { accountId: string; keyId: string } | null {
  const hash = sha256(token);
  const row = db
    .query(
      `SELECT id, account_id AS accountId
       FROM api_keys
       WHERE key_hash = ? AND status = 'active'`
    )
    .get(hash) as { id: string; accountId: string } | null;

  if (!row) {
    return null;
  }

  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(nowMs(), row.id);
  return { accountId: row.accountId, keyId: row.id };
}

function ensureApiKey(accountId: string, token: string): void {
  const normalized = token.trim();
  if (!normalized) {
    return;
  }

  const hash = sha256(normalized);
  const exists = db.query("SELECT id FROM api_keys WHERE key_hash = ?").get(hash) as { id: string } | null;
  if (exists) {
    return;
  }

  const now = nowMs();
  db.prepare(
    `INSERT INTO api_keys (id, account_id, key_hash, key_mask, status, created_at, last_used_at)
     VALUES (?, ?, ?, ?, 'active', ?, NULL)`
  ).run(newId("key"), accountId, hash, maskToken(normalized), now);
}

export function canServeRequest(account: AccountRow, minRequiredBalanceCents = 0): { ok: boolean; planActive: boolean } {
  const now = nowMs();
  const planActive = Boolean(account.planExpiresAt && account.planExpiresAt > now);

  if (account.status !== "active") {
    return { ok: false, planActive };
  }

  if (planActive) {
    return { ok: true, planActive };
  }

  return { ok: account.balanceCents >= Math.max(0, minRequiredBalanceCents), planActive };
}

export function rechargeAccount(args: {
  accountId: string;
  amountCents: number;
  currency: string;
  channel: string;
  outTradeNo: string;
}): RechargeResult {
  if (args.amountCents <= 0) {
    throw new BillingError("INVALID_AMOUNT", "充值金额必须大于 0。", 400);
  }

  const account = getAccount(args.accountId);
  if (!account) {
    throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
  }

  const existing = db
    .query(
      `SELECT
         id,
         account_id AS accountId,
         amount_cents AS amountCents,
         currency,
         created_at AS createdAt
       FROM recharge_orders
       WHERE out_trade_no = ?`
    )
    .get(args.outTradeNo) as
    | {
        id: string;
        accountId: string;
        amountCents: number;
        currency: string;
        createdAt: number;
      }
    | null;

  if (existing) {
    if (existing.accountId !== args.accountId) {
      throw new BillingError("OUT_TRADE_CONFLICT", "outTradeNo 已被其他账户使用。", 409);
    }

    const latest = getAccount(args.accountId);
    if (!latest) {
      throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
    }

    return {
      orderId: existing.id,
      accountId: existing.accountId,
      amountCents: existing.amountCents,
      currency: existing.currency,
      balanceCents: latest.balanceCents,
      createdAt: existing.createdAt,
      idempotent: true,
    };
  }

  const run = db.transaction(() => {
    const now = nowMs();
    const current = getAccount(args.accountId);
    if (!current) {
      throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
    }

    const orderId = newId("recharge");
    const nextBalance = current.balanceCents + args.amountCents;

    db.prepare(
      `UPDATE accounts
       SET balance_cents = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextBalance, now, current.id);

    db.prepare(
      `INSERT INTO recharge_orders
       (id, account_id, amount_cents, currency, channel, out_trade_no, status, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)`
    ).run(orderId, current.id, args.amountCents, args.currency, args.channel, args.outTradeNo, now, now);

    db.prepare(
      `INSERT INTO ledger_entries
       (id, account_id, type, delta_cents, balance_after_cents, currency, ref_type, ref_id, detail, created_at)
       VALUES (?, ?, 'recharge', ?, ?, ?, 'recharge_order', ?, ?, ?)`
    ).run(
      newId("ledger"),
      current.id,
      args.amountCents,
      nextBalance,
      args.currency,
      orderId,
      JSON.stringify({ channel: args.channel, outTradeNo: args.outTradeNo }),
      now,
    );

    return {
      orderId,
      accountId: current.id,
      amountCents: args.amountCents,
      currency: args.currency,
      balanceCents: nextBalance,
      createdAt: now,
      idempotent: false,
    } satisfies RechargeResult;
  });

  return run();
}

export function renewPlan(args: {
  accountId: string;
  planCode: string;
  months: number;
  amountCents: number;
  currency: string;
  channel: string;
  outTradeNo: string;
}): RenewResult {
  if (args.months <= 0 || !Number.isInteger(args.months)) {
    throw new BillingError("INVALID_MONTHS", "months 必须是正整数。", 400);
  }
  if (args.amountCents < 0) {
    throw new BillingError("INVALID_AMOUNT", "续费金额不能小于 0。", 400);
  }

  const account = getAccount(args.accountId);
  if (!account) {
    throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
  }

  const existing = db
    .query(
      `SELECT
         id,
         account_id AS accountId,
         plan_code AS planCode,
         months,
         amount_cents AS amountCents,
         currency,
         expires_at AS expiresAt,
         created_at AS createdAt
       FROM renew_orders
       WHERE out_trade_no = ?`
    )
    .get(args.outTradeNo) as
    | {
        id: string;
        accountId: string;
        planCode: string;
        months: number;
        amountCents: number;
        currency: string;
        expiresAt: number;
        createdAt: number;
      }
    | null;

  if (existing) {
    if (existing.accountId !== args.accountId) {
      throw new BillingError("OUT_TRADE_CONFLICT", "outTradeNo 已被其他账户使用。", 409);
    }

    return {
      orderId: existing.id,
      accountId: existing.accountId,
      planCode: existing.planCode,
      months: existing.months,
      amountCents: existing.amountCents,
      currency: existing.currency,
      expiresAt: existing.expiresAt,
      createdAt: existing.createdAt,
      idempotent: true,
    };
  }

  const run = db.transaction(() => {
    const now = nowMs();
    const current = getAccount(args.accountId);
    if (!current) {
      throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
    }

    const orderId = newId("renew");
    const baseAt = current.planExpiresAt && current.planExpiresAt > now ? current.planExpiresAt : now;
    const expiresAt = addMonths(baseAt, args.months);

    db.prepare(
      `UPDATE accounts
       SET plan_code = ?, plan_expires_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(args.planCode, expiresAt, now, current.id);

    db.prepare(
      `INSERT INTO renew_orders
       (id, account_id, plan_code, months, amount_cents, currency, channel, out_trade_no, status, created_at, paid_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`
    ).run(orderId, current.id, args.planCode, args.months, args.amountCents, args.currency, args.channel, args.outTradeNo, now, now, expiresAt);

    db.prepare(
      `INSERT INTO ledger_entries
       (id, account_id, type, delta_cents, balance_after_cents, currency, ref_type, ref_id, detail, created_at)
       VALUES (?, ?, 'renew', 0, ?, ?, 'renew_order', ?, ?, ?)`
    ).run(
      newId("ledger"),
      current.id,
      current.balanceCents,
      args.currency,
      orderId,
      JSON.stringify({ channel: args.channel, outTradeNo: args.outTradeNo, planCode: args.planCode, months: args.months }),
      now,
    );

    return {
      orderId,
      accountId: current.id,
      planCode: args.planCode,
      months: args.months,
      amountCents: args.amountCents,
      currency: args.currency,
      expiresAt,
      createdAt: now,
      idempotent: false,
    } satisfies RenewResult;
  });

  return run();
}

export function chargeUsage(args: {
  accountId: string;
  requestId: string;
  modelAlias: string;
  resolvedModel: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
  currency: string;
}): UsageChargeResult {
  if (args.costCents < 0) {
    throw new BillingError("INVALID_COST", "costCents 不能小于 0。", 400);
  }

  const run = db.transaction(() => {
    const now = nowMs();
    const current = getAccount(args.accountId);
    if (!current) {
      throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
    }

    const planActive = Boolean(current.planExpiresAt && current.planExpiresAt > now);
    const chargedCents = planActive ? 0 : args.costCents;

    if (current.status !== "active") {
      throw new BillingError("ACCOUNT_DISABLED", "账户不可用。", 403);
    }

    if (!planActive && current.balanceCents < chargedCents) {
      throw new BillingError("INSUFFICIENT_BALANCE", "余额不足，请充值或续费后重试。", 402);
    }

    const nextBalance = current.balanceCents - chargedCents;

    if (chargedCents > 0) {
      db.prepare(
        `UPDATE accounts
         SET balance_cents = ?, updated_at = ?
         WHERE id = ?`
      ).run(nextBalance, now, current.id);

      db.prepare(
        `INSERT INTO ledger_entries
         (id, account_id, type, delta_cents, balance_after_cents, currency, ref_type, ref_id, detail, created_at)
         VALUES (?, ?, 'inference', ?, ?, ?, 'request', ?, ?, ?)`
      ).run(
        newId("ledger"),
        current.id,
        -chargedCents,
        nextBalance,
        args.currency,
        args.requestId,
        JSON.stringify({ modelAlias: args.modelAlias, resolvedModel: args.resolvedModel, totalTokens: args.totalTokens }),
        now,
      );
    }

    db.prepare(
      `INSERT INTO usage_records
       (id, account_id, request_id, model_alias, resolved_model, prompt_tokens, completion_tokens, total_tokens, cost_cents, charged_cents, currency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId("usage"),
      current.id,
      args.requestId,
      args.modelAlias,
      args.resolvedModel,
      Math.max(0, Math.floor(args.promptTokens)),
      Math.max(0, Math.floor(args.completionTokens)),
      Math.max(0, Math.floor(args.totalTokens)),
      Math.max(0, Math.floor(args.costCents)),
      Math.max(0, Math.floor(chargedCents)),
      args.currency,
      now,
    );

    return {
      accountId: current.id,
      chargedCents,
      balanceCents: nextBalance,
      planActive,
      planExpiresAt: current.planExpiresAt,
    } satisfies UsageChargeResult;
  });

  return run();
}

export function getUsageSummary(args: {
  accountId: string;
  fromMs: number;
  toMs: number;
  modelLimit?: number;
}): UsageSummaryResult {
  const account = getAccount(args.accountId);
  if (!account) {
    throw new BillingError("ACCOUNT_NOT_FOUND", "账户不存在。", 404);
  }

  const fromMs = Math.max(0, Math.floor(args.fromMs));
  const toMs = Math.max(fromMs, Math.floor(args.toMs));
  const modelLimit = Math.max(1, Math.min(50, Math.floor(args.modelLimit || 20)));

  const summaryRow = db
    .query(
      `SELECT
         COUNT(*) AS requests,
         COALESCE(SUM(prompt_tokens), 0) AS promptTokens,
         COALESCE(SUM(completion_tokens), 0) AS completionTokens,
         COALESCE(SUM(total_tokens), 0) AS totalTokens,
         COALESCE(SUM(cost_cents), 0) AS costCents,
         COALESCE(SUM(charged_cents), 0) AS chargedCents
       FROM usage_records
       WHERE account_id = ? AND created_at >= ? AND created_at <= ?`
    )
    .get(args.accountId, fromMs, toMs) as
    | {
        requests: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costCents: number;
        chargedCents: number;
      }
    | null;

  const byModelRows = db
    .query(
      `SELECT
         model_alias AS modelAlias,
         resolved_model AS resolvedModel,
         COUNT(*) AS requests,
         COALESCE(SUM(prompt_tokens), 0) AS promptTokens,
         COALESCE(SUM(completion_tokens), 0) AS completionTokens,
         COALESCE(SUM(total_tokens), 0) AS totalTokens,
         COALESCE(SUM(cost_cents), 0) AS costCents,
         COALESCE(SUM(charged_cents), 0) AS chargedCents
       FROM usage_records
       WHERE account_id = ? AND created_at >= ? AND created_at <= ?
       GROUP BY model_alias, resolved_model
       ORDER BY chargedCents DESC, requests DESC
       LIMIT ?`
    )
    .all(args.accountId, fromMs, toMs, modelLimit) as Array<{
    modelAlias: string;
    resolvedModel: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costCents: number;
    chargedCents: number;
  }>;

  return {
    requests: Number(summaryRow?.requests || 0),
    promptTokens: Number(summaryRow?.promptTokens || 0),
    completionTokens: Number(summaryRow?.completionTokens || 0),
    totalTokens: Number(summaryRow?.totalTokens || 0),
    costCents: Number(summaryRow?.costCents || 0),
    chargedCents: Number(summaryRow?.chargedCents || 0),
    currency: account.currency,
    byModel: byModelRows.map((row) => ({
      modelAlias: row.modelAlias,
      resolvedModel: row.resolvedModel,
      requests: Number(row.requests || 0),
      promptTokens: Number(row.promptTokens || 0),
      completionTokens: Number(row.completionTokens || 0),
      totalTokens: Number(row.totalTokens || 0),
      costCents: Number(row.costCents || 0),
      chargedCents: Number(row.chargedCents || 0),
    })),
  };
}

function addMonths(baseAtMs: number, months: number): number {
  const d = new Date(baseAtMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function nowMs(): number {
  return Date.now();
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function maskToken(token: string): string {
  if (token.length <= 8) {
    return `${token.slice(0, 2)}***${token.slice(-2)}`;
  }
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
}
