import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "company.db");
const LEGACY_DB_PATH = path.join(process.cwd(), "data", "farm.db");

function resolveDbPath(): string {
  const envPath = process.env.COMPANY_DB_PATH?.trim() || process.env.FARM_DB_PATH?.trim() || "";
  if (envPath) {
    return envPath;
  }
  if (existsSync(DEFAULT_DB_PATH)) {
    return DEFAULT_DB_PATH;
  }
  if (existsSync(LEGACY_DB_PATH)) {
    return LEGACY_DB_PATH;
  }
  return DEFAULT_DB_PATH;
}

export const DB_PATH = resolveDbPath();

mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true, strict: true });

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS console_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  owner_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'unmanned',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(owner_user_id) REFERENCES console_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS console_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES console_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hosts (
  host_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_token TEXT NOT NULL UNIQUE,
  controller_address TEXT NOT NULL,
  status TEXT NOT NULL,
  platform TEXT,
  wsl_distro TEXT,
  clawos_version TEXT,
  wsl_ready INTEGER NOT NULL DEFAULT 0,
  gateway_ready INTEGER NOT NULL DEFAULT 0,
  last_seen_ms INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  controller_address TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handshake_challenges (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  controller_address TEXT NOT NULL,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  controller_address TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  dedupe_key TEXT,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  device_id TEXT,
  controller_address TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(host_id) REFERENCES hosts(host_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_handshake_expiry ON handshake_challenges(expires_at, used);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_console_sessions_expiry ON console_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_hosts_controller ON hosts(controller_address, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_host_created ON agent_events(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_severity_created ON agent_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_owner_updated ON companies(owner_user_id, updated_at DESC);
`);

function hasColumn(table: string, column: string): boolean {
  const rows = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

if (!hasColumn("commands", "dedupe_key")) {
  db.exec("ALTER TABLE commands ADD COLUMN dedupe_key TEXT;");
}
if (!hasColumn("commands", "expires_at")) {
  db.exec("ALTER TABLE commands ADD COLUMN expires_at INTEGER;");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_commands_dedupe_key ON commands(dedupe_key, created_at);");

export function nowMs(): number {
  return Date.now();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function auditLog(args: {
  actor: string;
  action: string;
  deviceId?: string | null;
  controllerAddress?: string | null;
  detail?: unknown;
}): void {
  const stmt = db.prepare(
    `INSERT INTO audit_logs (actor, action, device_id, controller_address, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    args.actor,
    args.action,
    args.deviceId || null,
    args.controllerAddress || null,
    args.detail === undefined ? null : JSON.stringify(args.detail),
    nowMs()
  );
}
