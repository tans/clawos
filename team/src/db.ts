import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "team.db");
const LEGACY_DB_PATH = path.join(process.cwd(), "data", "farm.db");

function resolveDbPath(): string {
  const envPath =
    process.env.TEAM_DB_PATH?.trim() || process.env.COMPANY_DB_PATH?.trim() || process.env.FARM_DB_PATH?.trim() || "";
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

export const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
mkdirSync(UPLOAD_ROOT, { recursive: true });

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

CREATE TABLE IF NOT EXISTS team_app_admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  legacy_console_user_id INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(legacy_console_user_id) REFERENCES console_users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS team_app_admin_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES team_app_admin_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_app_company_memberships (
  company_id TEXT NOT NULL,
  team_admin_user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(company_id, team_admin_user_id),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY(team_admin_user_id) REFERENCES team_app_admin_users(id) ON DELETE CASCADE
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
  started_at INTEGER,
  finished_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS token_usage_samples (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  tokens INTEGER,
  raw_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(host_id) REFERENCES hosts(host_id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS team_brand_profiles (
  company_id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  theme_color TEXT NOT NULL,
  welcome_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_gateway_agents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  external_agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(company_id, external_agent_id),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_gateway_configs (
  company_id TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  api_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_profiles (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  primary_agent_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(id, company_id),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY(company_id, primary_agent_id) REFERENCES team_gateway_agents(company_id, external_agent_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_invites (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  expires_at INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(id, company_id),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_member_sessions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(id, company_id),
  FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY(invite_id, company_id) REFERENCES team_invites(id, company_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_conversations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  last_message_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(id, company_id),
  FOREIGN KEY(member_id, company_id) REFERENCES team_member_sessions(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY(team_id, company_id) REFERENCES team_profiles(id, company_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  message_type TEXT NOT NULL,
  body TEXT NOT NULL,
  stream_status TEXT NOT NULL DEFAULT 'done',
  created_at INTEGER NOT NULL,
  FOREIGN KEY(conversation_id, company_id) REFERENCES team_conversations(id, company_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_attachments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(message_id),
  FOREIGN KEY(conversation_id, company_id) REFERENCES team_conversations(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY(member_id, company_id) REFERENCES team_member_sessions(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES team_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commands_device_status ON commands(device_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_commands_status_updated ON commands(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_handshake_expiry ON handshake_challenges(expires_at, used);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_console_sessions_expiry ON console_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_app_admin_sessions_expiry ON team_app_admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_app_company_memberships_user_role
  ON team_app_company_memberships(team_admin_user_id, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hosts_controller ON hosts(controller_address, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_host_created ON agent_events(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_severity_created ON agent_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_owner_updated ON companies(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_host_created ON token_usage_samples(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_conversations_company_member_updated
  ON team_conversations(company_id, member_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_conversation_company_created
  ON team_messages(conversation_id, company_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_team_attachments_conversation_company_created
  ON team_attachments(conversation_id, company_id, created_at ASC);
`);

type ForeignKeyRow = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
};

function hasCompositeForeignKey(
  table: string,
  refTable: string,
  fromColumns: string[],
  toColumns: string[]
): boolean {
  const rows = db.query(`PRAGMA foreign_key_list(${table})`).all() as ForeignKeyRow[];
  const grouped = new Map<number, ForeignKeyRow[]>();
  for (const row of rows) {
    if (row.table !== refTable) {
      continue;
    }
    const list = grouped.get(row.id) ?? [];
    list.push(row);
    grouped.set(row.id, list);
  }

  for (const group of grouped.values()) {
    const ordered = [...group].sort((a, b) => a.seq - b.seq);
    if (ordered.length !== fromColumns.length || ordered.length !== toColumns.length) {
      continue;
    }
    const matches = ordered.every(
      (row, index) => row.from === fromColumns[index] && row.to === toColumns[index]
    );
    if (matches) {
      return true;
    }
  }
  return false;
}

function hasUniqueIndex(table: string, columns: string[]): boolean {
  const indexes = db.query(`PRAGMA index_list(${table})`).all() as Array<{
    name: string;
    unique: number;
  }>;
  for (const index of indexes) {
    if (index.unique !== 1) {
      continue;
    }
    const cols = db.query(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>;
    if (cols.length !== columns.length) {
      continue;
    }
    const matches = cols.every((col, idx) => col.name === columns[idx]);
    if (matches) {
      return true;
    }
  }
  return false;
}

function hasTable(tableName: string): boolean {
  const row = db
    .query(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?`
    )
    .get(tableName) as { name: string } | null;
  return row !== null;
}

function hasColumn(table: string, column: string): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((entry) => entry.name === column);
}

function isColumnNotNull(table: string, column: string): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string; notnull: number }>;
  const entry = columns.find((current) => current.name === column);
  return entry?.notnull === 1;
}

function rebuildTeamV1Tables(): void {
  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");

  db.exec(`
    CREATE TABLE team_brand_profiles_new (
      company_id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      logo_url TEXT,
      theme_color TEXT NOT NULL,
      welcome_text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_brand_profiles_new
      (company_id, brand_name, logo_url, theme_color, welcome_text, created_at, updated_at)
    SELECT b.company_id, b.brand_name, b.logo_url, b.theme_color, b.welcome_text, b.created_at, b.updated_at
    FROM team_brand_profiles b
    JOIN companies c ON c.id = b.company_id;
  `);
  db.exec("DROP TABLE team_brand_profiles;");
  db.exec("ALTER TABLE team_brand_profiles_new RENAME TO team_brand_profiles;");

  db.exec(`
    CREATE TABLE team_gateway_agents_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      external_agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(company_id, external_agent_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_gateway_agents_new
      (id, company_id, external_agent_id, name, description, status, is_enabled, created_at, updated_at)
    SELECT a.id, a.company_id, a.external_agent_id, a.name, a.description, a.status, a.is_enabled, a.created_at, a.updated_at
    FROM team_gateway_agents a
    JOIN companies c ON c.id = a.company_id;
  `);
  db.exec("DROP TABLE team_gateway_agents;");
  db.exec("ALTER TABLE team_gateway_agents_new RENAME TO team_gateway_agents;");

  db.exec(`
    CREATE TABLE team_gateway_configs_new (
      company_id TEXT PRIMARY KEY,
      base_url TEXT NOT NULL,
      api_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_gateway_configs_new
      (company_id, base_url, api_key, created_at, updated_at)
    SELECT g.company_id, g.base_url, g.api_key, g.created_at, g.updated_at
    FROM team_gateway_configs g
    JOIN companies c ON c.id = g.company_id;
  `);
  db.exec("DROP TABLE team_gateway_configs;");
  db.exec("ALTER TABLE team_gateway_configs_new RENAME TO team_gateway_configs;");

  db.exec(`
    CREATE TABLE team_profiles_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      primary_agent_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(id, company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(company_id, primary_agent_id) REFERENCES team_gateway_agents(company_id, external_agent_id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_profiles_new
      (id, company_id, name, description, primary_agent_id, created_at, updated_at)
    SELECT t.id, t.company_id, t.name, t.description, t.primary_agent_id, t.created_at, t.updated_at
    FROM team_profiles t
    JOIN team_gateway_agents a
      ON a.company_id = t.company_id AND a.external_agent_id = t.primary_agent_id;
  `);
  db.exec("DROP TABLE team_profiles;");
  db.exec("ALTER TABLE team_profiles_new RENAME TO team_profiles;");

  db.exec(`
    CREATE TABLE team_invites_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      expires_at INTEGER,
      usage_limit INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(id, company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_invites_new
      (id, company_id, token, status, expires_at, usage_limit, usage_count, created_by, created_at, updated_at)
    SELECT i.id, i.company_id, i.token, i.status, i.expires_at, i.usage_limit, i.usage_count, i.created_by, i.created_at, i.updated_at
    FROM team_invites i
    JOIN companies c ON c.id = i.company_id;
  `);
  db.exec("DROP TABLE team_invites;");
  db.exec("ALTER TABLE team_invites_new RENAME TO team_invites;");

  db.exec(`
    CREATE TABLE team_member_sessions_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      invite_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      last_seen_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(id, company_id),
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY(invite_id, company_id) REFERENCES team_invites(id, company_id) ON DELETE CASCADE
    );
  `);
  const memberSessionsRevokedAtSelect = hasColumn("team_member_sessions", "revoked_at") ? "s.revoked_at" : "NULL";
  db.exec(`
    INSERT INTO team_member_sessions_new
      (id, company_id, invite_id, display_name, session_token, last_seen_at, revoked_at, created_at)
    SELECT s.id, s.company_id, s.invite_id, s.display_name, s.session_token, s.last_seen_at, ${memberSessionsRevokedAtSelect}, s.created_at
    FROM team_member_sessions s
    JOIN team_invites i ON i.id = s.invite_id AND i.company_id = s.company_id;
  `);
  db.exec("DROP TABLE team_member_sessions;");
  db.exec("ALTER TABLE team_member_sessions_new RENAME TO team_member_sessions;");

  db.exec(`
    CREATE TABLE team_conversations_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      last_message_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(id, company_id),
      FOREIGN KEY(member_id, company_id) REFERENCES team_member_sessions(id, company_id) ON DELETE CASCADE,
      FOREIGN KEY(team_id, company_id) REFERENCES team_profiles(id, company_id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_conversations_new
      (id, company_id, team_id, member_id, title, status, last_message_at, created_at, updated_at)
    SELECT c.id, c.company_id, c.team_id, c.member_id, c.title, c.status, c.last_message_at, c.created_at, c.updated_at
    FROM team_conversations c
    JOIN team_member_sessions s ON s.id = c.member_id AND s.company_id = c.company_id
    JOIN team_profiles t ON t.id = c.team_id AND t.company_id = c.company_id;
  `);
  db.exec("DROP TABLE team_conversations;");
  db.exec("ALTER TABLE team_conversations_new RENAME TO team_conversations;");

  db.exec(`
    CREATE TABLE team_messages_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      message_type TEXT NOT NULL,
      body TEXT NOT NULL,
      stream_status TEXT NOT NULL DEFAULT 'done',
      created_at INTEGER NOT NULL,
      FOREIGN KEY(conversation_id, company_id) REFERENCES team_conversations(id, company_id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    INSERT INTO team_messages_new
      (id, company_id, conversation_id, sender_type, sender_id, message_type, body, stream_status, created_at)
    SELECT m.id, m.company_id, m.conversation_id, m.sender_type, m.sender_id, m.message_type, m.body, m.stream_status, m.created_at
    FROM team_messages m
    JOIN team_conversations c ON c.id = m.conversation_id AND c.company_id = m.company_id;
  `);
  db.exec("DROP TABLE team_messages;");
  db.exec("ALTER TABLE team_messages_new RENAME TO team_messages;");

  db.exec(`
    CREATE TABLE team_attachments_new (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(message_id),
      FOREIGN KEY(conversation_id, company_id) REFERENCES team_conversations(id, company_id) ON DELETE CASCADE,
      FOREIGN KEY(member_id, company_id) REFERENCES team_member_sessions(id, company_id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES team_messages(id) ON DELETE CASCADE
    );
  `);
  if (hasTable("team_attachments")) {
    const attachmentHasMessageId = hasColumn("team_attachments", "message_id");
    const attachmentMessageIdSelect = attachmentHasMessageId
      ? `CASE
           WHEN tm.id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1
               FROM team_attachments dup
               WHERE dup.message_id = a.message_id
                 AND dup.id != a.id
             )
           THEN a.message_id
           ELSE 'tmsg_' || a.id
         END`
      : "'tmsg_' || a.id";
    const attachmentKindSelect = hasColumn("team_attachments", "kind")
      ? "COALESCE(a.kind, CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'file' END)"
      : "CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'file' END";
    db.exec(`
      INSERT INTO team_messages
        (id, company_id, conversation_id, sender_type, sender_id, message_type, body, stream_status, created_at)
      SELECT 'tmsg_' || a.id, a.company_id, a.conversation_id, 'member', a.member_id,
             CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'file' END,
             a.original_name, 'done', a.created_at
      FROM team_attachments a
      JOIN team_conversations c ON c.id = a.conversation_id AND c.company_id = a.company_id
      JOIN team_member_sessions s ON s.id = a.member_id AND s.company_id = a.company_id
      LEFT JOIN team_messages tm
        ON tm.id = a.message_id
       AND tm.company_id = a.company_id
       AND tm.conversation_id = a.conversation_id
       AND tm.message_type = CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'file' END
       AND tm.sender_type = 'member'
       AND tm.sender_id = a.member_id
       AND tm.body = a.original_name
      ${
        attachmentHasMessageId
          ? `WHERE tm.id IS NULL
             OR EXISTS (
               SELECT 1
               FROM team_attachments dup
               WHERE dup.message_id = a.message_id
                 AND dup.id != a.id
             )`
          : ""
      }
    `);
    db.exec(`
      INSERT INTO team_attachments_new
        (id, company_id, conversation_id, member_id, message_id, kind, original_name, stored_name, mime_type, size_bytes, storage_path, created_at)
      SELECT a.id, a.company_id, a.conversation_id, a.member_id, ${attachmentMessageIdSelect}, ${attachmentKindSelect}, a.original_name, a.stored_name, a.mime_type, a.size_bytes, a.storage_path, a.created_at
      FROM team_attachments a
      JOIN team_conversations c ON c.id = a.conversation_id AND c.company_id = a.company_id
      JOIN team_member_sessions s ON s.id = a.member_id AND s.company_id = a.company_id
      LEFT JOIN team_messages tm
        ON tm.id = a.message_id
       AND tm.company_id = a.company_id
       AND tm.conversation_id = a.conversation_id
       AND tm.message_type = CASE WHEN a.mime_type LIKE 'image/%' THEN 'image' ELSE 'file' END
       AND tm.sender_type = 'member'
       AND tm.sender_id = a.member_id
       AND tm.body = a.original_name;
    `);
    db.exec("DROP TABLE team_attachments;");
  }
  db.exec("ALTER TABLE team_attachments_new RENAME TO team_attachments;");

  db.exec("COMMIT;");
  db.exec("PRAGMA foreign_keys = ON;");
}

type ForeignKeyCheckRow = {
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
};

const TEAM_V1_TABLES = new Set([
  "team_brand_profiles",
  "team_gateway_agents",
  "team_gateway_configs",
  "team_profiles",
  "team_invites",
  "team_member_sessions",
  "team_conversations",
  "team_messages",
  "team_attachments",
]);

function getTeamV1ForeignKeyViolations(): ForeignKeyCheckRow[] {
  const rows = db.query("PRAGMA foreign_key_check").all() as ForeignKeyCheckRow[];
  return rows.filter((row) => TEAM_V1_TABLES.has(row.table));
}

function getInvalidTeamAttachmentLinks(): Array<{ id: string }> {
  if (
    !hasTable("team_attachments") ||
    !hasColumn("team_attachments", "message_id") ||
    !hasColumn("team_attachments", "kind") ||
    !hasColumn("team_attachments", "original_name") ||
    !hasColumn("team_attachments", "member_id")
  ) {
    return [];
  }
  return db
    .query(
      `SELECT a.id
       FROM team_attachments a
       LEFT JOIN team_messages m ON m.id = a.message_id
       WHERE m.id IS NULL
          OR m.company_id != a.company_id
          OR m.conversation_id != a.conversation_id
          OR m.message_type != a.kind
          OR m.sender_type != 'member'
          OR m.sender_id != a.member_id
          OR m.body != a.original_name`
    )
    .all() as Array<{ id: string }>;
}

function needsTeamV1Repair(): boolean {
  const needsGatewayAgentKey = !hasUniqueIndex("team_gateway_agents", ["company_id", "external_agent_id"]);
  const needsTeamProfileAgentFk = !hasCompositeForeignKey(
    "team_profiles",
    "team_gateway_agents",
    ["company_id", "primary_agent_id"],
    ["company_id", "external_agent_id"]
  );
  const needsTeamInvitesKey = !hasUniqueIndex("team_invites", ["id", "company_id"]);
  const needsInviteCompanyFk = !hasCompositeForeignKey(
    "team_member_sessions",
    "team_invites",
    ["invite_id", "company_id"],
    ["id", "company_id"]
  );
  const needsMemberCompanyFk = !hasCompositeForeignKey(
    "team_conversations",
    "team_member_sessions",
    ["member_id", "company_id"],
    ["id", "company_id"]
  );
  const needsTeamCompanyFk = !hasCompositeForeignKey(
    "team_conversations",
    "team_profiles",
    ["team_id", "company_id"],
    ["id", "company_id"]
  );
  const needsConversationCompanyFk = !hasCompositeForeignKey(
    "team_messages",
    "team_conversations",
    ["conversation_id", "company_id"],
    ["id", "company_id"]
  );
  const needsAttachmentMessageFk =
    hasTable("team_attachments") &&
    !hasCompositeForeignKey("team_attachments", "team_messages", ["message_id"], ["id"]);
  const needsAttachmentMessageRequired =
    hasTable("team_attachments") && !isColumnNotNull("team_attachments", "message_id");
  const needsAttachmentKindRequired =
    hasTable("team_attachments") && !isColumnNotNull("team_attachments", "kind");
  const needsAttachmentMessageUnique =
    hasTable("team_attachments") && !hasUniqueIndex("team_attachments", ["message_id"]);
  const needsAttachmentLinkRepair = getInvalidTeamAttachmentLinks().length > 0;
  return (
    needsGatewayAgentKey ||
    needsTeamProfileAgentFk ||
    needsTeamInvitesKey ||
    needsInviteCompanyFk ||
    needsMemberCompanyFk ||
    needsTeamCompanyFk ||
    needsConversationCompanyFk ||
    needsAttachmentMessageFk ||
    needsAttachmentMessageRequired ||
    needsAttachmentKindRequired ||
    needsAttachmentMessageUnique ||
    needsAttachmentLinkRepair
  );
}

function ensureTeamV1ReadIndexes(): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_team_conversations_company_member_updated
      ON team_conversations(company_id, member_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_team_messages_conversation_company_created
      ON team_messages(conversation_id, company_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_team_attachments_conversation_company_created
      ON team_attachments(conversation_id, company_id, created_at ASC);
  `);
}

function ensureTeamV1SessionRevocationColumn(): void {
  if (!hasColumn("team_member_sessions", "revoked_at")) {
    db.exec(`ALTER TABLE team_member_sessions ADD COLUMN revoked_at INTEGER;`);
  }
}

function ensureTeamV1AttachmentMessageColumns(): void {
  if (!hasTable("team_attachments")) {
    return;
  }
  if (!hasColumn("team_attachments", "message_id")) {
    db.exec(`ALTER TABLE team_attachments ADD COLUMN message_id TEXT;`);
  }
  if (!hasColumn("team_attachments", "kind")) {
    db.exec(`ALTER TABLE team_attachments ADD COLUMN kind TEXT;`);
  }
  db.exec(`
    UPDATE team_attachments
    SET kind = CASE
      WHEN mime_type LIKE 'image/%' THEN 'image'
      ELSE 'file'
    END
    WHERE kind IS NULL OR TRIM(kind) = '';
  `);
}

export function ensureTeamV1Schema(): void {
  db.exec("PRAGMA foreign_keys = ON;");
  ensureTeamV1SessionRevocationColumn();
  ensureTeamV1AttachmentMessageColumns();
  const violations = getTeamV1ForeignKeyViolations();
  const needsRebuild = needsTeamV1Repair() || violations.length > 0;

  if (needsRebuild) {
    rebuildTeamV1Tables();
  }

  const postViolations = getTeamV1ForeignKeyViolations();
  if (postViolations.length) {
    const summary = postViolations
      .map((row) => `${row.table}:${row.rowid}->${row.parent}`)
      .join(", ");
    throw new Error(`Team V1 foreign key violations remain after repair: ${summary}`);
  }

  const invalidAttachmentLinks = getInvalidTeamAttachmentLinks();
  if (invalidAttachmentLinks.length) {
    const summary = invalidAttachmentLinks.map((row) => row.id).join(", ");
    throw new Error(`Team V1 attachment links remain invalid after repair: ${summary}`);
  }

  ensureTeamV1ReadIndexes();
}

if (needsTeamV1Repair()) {
  ensureTeamV1Schema();
}

ensureTeamV1Schema();

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
if (!hasColumn("commands", "started_at")) {
  db.exec("ALTER TABLE commands ADD COLUMN started_at INTEGER;");
}
if (!hasColumn("commands", "finished_at")) {
  db.exec("ALTER TABLE commands ADD COLUMN finished_at INTEGER;");
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
