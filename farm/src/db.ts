import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "farm.db");
export const DB_PATH = process.env.FARM_DB_PATH?.trim() || DEFAULT_DB_PATH;

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
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
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

CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_handshake_expiry ON handshake_challenges(expires_at, used);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_console_sessions_expiry ON console_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_hosts_controller ON hosts(controller_address, updated_at);
`);

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
