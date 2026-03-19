import { db, newId, nowMs } from "../db";
import type {
  AgentEventRow,
  AuditLogRow,
  ConsoleCredentialRow,
  ConsoleUser,
  HostCommandRow,
  HostInsightRow,
  HostRow,
  PendingCommandRow,
} from "../types";

const HOST_SELECT = `
  SELECT
    host_id AS hostId,
    name,
    agent_token AS agentToken,
    controller_address AS controllerAddress,
    status,
    platform,
    wsl_distro AS wslDistro,
    clawos_version AS clawosVersion,
    wsl_ready AS wslReady,
    gateway_ready AS gatewayReady,
    last_seen_ms AS lastSeenMs,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM hosts
`;

export function clearExpiredConsoleSessions(): void {
  db.prepare("DELETE FROM console_sessions WHERE expires_at < ?").run(nowMs());
}

export function getConsoleUserBySessionToken(token: string): ConsoleUser | null {
  return db
    .query(
      `SELECT
         u.id AS id,
         u.mobile AS mobile,
         u.wallet_address AS walletAddress
       FROM console_sessions s
       JOIN console_users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, nowMs()) as ConsoleUser | null;
}

export function createConsoleSession(userId: number, expiresAt: number): string {
  const token = newId("web");
  db.prepare(`INSERT INTO console_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(
    token,
    userId,
    expiresAt,
    nowMs()
  );
  return token;
}

export function deleteConsoleSession(token: string): void {
  db.prepare("DELETE FROM console_sessions WHERE token = ?").run(token);
}

export function getConsoleCredentialByMobile(mobile: string): ConsoleCredentialRow | null {
  return db
    .query(
      `SELECT id, mobile, password_hash AS passwordHash, wallet_address AS walletAddress
       FROM console_users
       WHERE mobile = ?`
    )
    .get(mobile) as ConsoleCredentialRow | null;
}

export function existsConsoleUserByMobile(mobile: string): boolean {
  const row = db.query("SELECT id FROM console_users WHERE mobile = ?").get(mobile) as { id: number } | null;
  return Boolean(row);
}

export function createConsoleUser(mobile: string, passwordHash: string, walletAddress: string): void {
  db.prepare(
    `INSERT INTO console_users (mobile, password_hash, wallet_address, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(mobile, passwordHash, walletAddress, nowMs());
}

export function getHostById(hostId: string): HostRow | null {
  return db.query(`${HOST_SELECT} WHERE host_id = ?`).get(hostId) as HostRow | null;
}

export function getHostOwnedBy(hostId: string, walletAddress: string): HostRow | null {
  const host = getHostById(hostId);
  if (!host || host.controllerAddress !== walletAddress) {
    return null;
  }
  return host;
}

export function listHostsByControllerAddress(walletAddress: string): HostRow[] {
  return db
    .query(
      `${HOST_SELECT}
       WHERE controller_address = ?
       ORDER BY updated_at DESC`
    )
    .all(walletAddress) as HostRow[];
}

export function createPendingCommand(hostId: string, kind: string, payload: Record<string, unknown>): string {
  const commandId = newId("cmd");
  const now = nowMs();
  db.prepare(
    `INSERT INTO commands (id, device_id, kind, payload, status, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)`
  ).run(commandId, hostId, kind, JSON.stringify(payload), now, now);
  return commandId;
}

export function listHostRecentCommands(hostId: string, limit = 40): HostCommandRow[] {
  return db
    .query(
      `SELECT id, kind, payload, status, result, created_at AS createdAt, updated_at AS updatedAt
       FROM commands
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(hostId, limit) as HostCommandRow[];
}

export function createHostFromHello(args: {
  hostId: string;
  name: string;
  agentToken: string;
  controllerAddress: string;
  platform: string | null;
  wslDistro: string | null;
  clawosVersion: string | null;
  now: number;
}): void {
  db.prepare(
    `INSERT INTO hosts
     (host_id, name, agent_token, controller_address, status, platform, wsl_distro, clawos_version, wsl_ready, gateway_ready, last_seen_ms, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'online', ?, ?, ?, 0, 0, ?, ?, ?)`
  ).run(
    args.hostId,
    args.name,
    args.agentToken,
    args.controllerAddress,
    args.platform,
    args.wslDistro,
    args.clawosVersion,
    args.now,
    args.now,
    args.now
  );
}

export function updateHostFromHello(args: {
  hostId: string;
  name: string;
  controllerAddress: string;
  platform: string | null;
  wslDistro: string | null;
  clawosVersion: string | null;
  now: number;
}): void {
  db.prepare(
    `UPDATE hosts
     SET name = ?, controller_address = ?, status = 'online', platform = ?, wsl_distro = ?, clawos_version = ?, last_seen_ms = ?, updated_at = ?
     WHERE host_id = ?`
  ).run(args.name, args.controllerAddress, args.platform, args.wslDistro, args.clawosVersion, args.now, args.now, args.hostId);
}

export function updateHostHeartbeat(args: {
  hostId: string;
  wslReady: boolean;
  gatewayReady: boolean;
  clawosVersion: string | null;
  status: string;
  now: number;
}): void {
  db.prepare(
    `UPDATE hosts
     SET wsl_ready = ?, gateway_ready = ?, clawos_version = ?, status = ?, last_seen_ms = ?, updated_at = ?
     WHERE host_id = ?`
  ).run(
    args.wslReady ? 1 : 0,
    args.gatewayReady ? 1 : 0,
    args.clawosVersion,
    args.status,
    args.now,
    args.now,
    args.hostId
  );
}

export function listPendingCommands(hostId: string, limit: number): PendingCommandRow[] {
  return db
    .query(
      `SELECT id, kind, payload, created_at AS createdAt
       FROM commands
       WHERE device_id = ? AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(hostId, limit) as PendingCommandRow[];
}

export function markPendingCommandResult(args: {
  commandId: string;
  hostId: string;
  status: "success" | "failed";
  result: unknown;
  now: number;
}): number {
  const updated = db
    .prepare(
      `UPDATE commands
       SET status = ?, result = ?, updated_at = ?
       WHERE id = ? AND device_id = ? AND status = 'pending'`
    )
    .run(
      args.status,
      args.result === null ? null : JSON.stringify(args.result),
      args.now,
      args.commandId,
      args.hostId
    );

  return updated.changes;
}

export function listAuditLogs(limit: number): AuditLogRow[] {
  return db
    .query(
      `SELECT id, actor, action, device_id AS deviceId, controller_address AS controllerAddress, detail, created_at AS createdAt
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as AuditLogRow[];
}

export function createAgentEvent(args: {
  hostId: string;
  eventType: string;
  severity: "info" | "warning" | "error";
  title?: string | null;
  payload?: unknown;
  now?: number;
}): string {
  const eventId = newId("evt");
  db.prepare(
    `INSERT INTO agent_events (id, host_id, event_type, severity, title, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    eventId,
    args.hostId,
    args.eventType.trim().slice(0, 64),
    args.severity,
    args.title?.trim().slice(0, 160) || null,
    args.payload === undefined ? null : JSON.stringify(args.payload),
    args.now ?? nowMs()
  );
  return eventId;
}

export function listHostRecentEvents(hostId: string, limit = 30): AgentEventRow[] {
  return db
    .query(
      `SELECT
         id,
         host_id AS hostId,
         event_type AS eventType,
         severity,
         title,
         payload,
         created_at AS createdAt
       FROM agent_events
       WHERE host_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(hostId, limit) as AgentEventRow[];
}

export function listHostInsightsByControllerAddress(
  walletAddress: string,
  fromMs: number,
  toMs: number,
): HostInsightRow[] {
  return db
    .query(
      `SELECT
         h.host_id AS hostId,
         h.name AS hostName,
         h.status AS status,
         h.last_seen_ms AS lastSeenMs,
         COALESCE(COUNT(e.id), 0) AS totalEvents,
         COALESCE(SUM(CASE WHEN e.severity = 'warning' THEN 1 ELSE 0 END), 0) AS warningEvents,
         COALESCE(SUM(CASE WHEN e.severity = 'error' THEN 1 ELSE 0 END), 0) AS errorEvents,
         MAX(e.created_at) AS lastEventAt
       FROM hosts h
       LEFT JOIN agent_events e
         ON e.host_id = h.host_id
        AND e.created_at >= ?
        AND e.created_at <= ?
       WHERE h.controller_address = ?
       GROUP BY h.host_id, h.name, h.status, h.last_seen_ms
       ORDER BY errorEvents DESC, warningEvents DESC, lastEventAt DESC, h.updated_at DESC`
    )
    .all(fromMs, toMs, walletAddress) as HostInsightRow[];
}
