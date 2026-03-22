import { asObject, readNonEmptyString, toFiniteNumber } from "../lib/value";
import { callGatewayMethodViaCli } from "../openclaw/gateway-cli";

export type GatewaySessionListItem = {
  key: string;
  title: string;
  updatedAtMs?: number;
  active: boolean;
  lastMessage?: string;
};

export type GatewaySessionHistoryItem = {
  id: string;
  role: string;
  text: string;
  ts?: number;
};

function toTimestamp(value: unknown): number | undefined {
  const numeric = toFiniteNumber(value);
  if (typeof numeric === "number" && numeric > 0) {
    return Math.floor(numeric);
  }

  if (typeof value === "string") {
    const ts = Date.parse(value);
    if (Number.isFinite(ts) && ts > 0) {
      return ts;
    }
  }

  return undefined;
}

function pickFirstString(values: unknown[]): string | undefined {
  for (const value of values) {
    const str = readNonEmptyString(value);
    if (str) {
      return str;
    }
  }
  return undefined;
}

function textFromUnknown(value: unknown, depth = 0): string | undefined {
  if (depth > 3) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => textFromUnknown(item, depth + 1))
      .filter((item): item is string => Boolean(item));
    if (parts.length > 0) {
      return parts.join(" ");
    }
    return undefined;
  }

  const obj = asObject(value);
  if (!obj) {
    return undefined;
  }

  const candidate = pickFirstString([
    obj.text,
    obj.message,
    obj.content,
    obj.preview,
    obj.summary,
    obj.value,
    obj.delta,
  ]);

  if (candidate) {
    return candidate;
  }

  const nested = [
    textFromUnknown(obj.content, depth + 1),
    textFromUnknown(obj.message, depth + 1),
    textFromUnknown(obj.preview, depth + 1),
    textFromUnknown(obj.summary, depth + 1),
    textFromUnknown(obj.parts, depth + 1),
    textFromUnknown(obj.data, depth + 1),
  ].find(Boolean);

  if (nested) {
    return nested;
  }

  try {
    const raw = JSON.stringify(obj);
    if (!raw || raw === "{}") {
      return undefined;
    }
    return raw.length > 800 ? `${raw.slice(0, 800)}...` : raw;
  } catch {
    return undefined;
  }
}

function arrayFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const payloadObj = asObject(payload);
  if (!payloadObj) {
    return [];
  }

  const candidates = [
    payloadObj.sessions,
    payloadObj.items,
    payloadObj.list,
    payloadObj.results,
    payloadObj.data,
    payloadObj.history,
    payloadObj.messages,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function normalizeSessionListItem(item: unknown): GatewaySessionListItem | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const key = pickFirstString([obj.sessionKey, obj.key, obj.sessionId, obj.id]);
  if (!key) {
    return null;
  }

  const title =
    pickFirstString([obj.title, obj.derivedTitle, obj.label, obj.name, obj.sessionTitle]) || key;

  const lastMessage = textFromUnknown(obj.lastMessage) || textFromUnknown(obj.preview);
  const updatedAtMs =
    toTimestamp(obj.updatedAtMs) ||
    toTimestamp(obj.lastMessageAtMs) ||
    toTimestamp(obj.lastAtMs) ||
    toTimestamp(obj.updatedAt) ||
    toTimestamp(obj.lastMessageAt) ||
    toTimestamp(obj.ts);

  const status = readNonEmptyString(obj.status)?.toLowerCase();
  const active = obj.active === true || status === "active";

  return {
    key,
    title,
    updatedAtMs,
    active,
    lastMessage: lastMessage || undefined,
  };
}

function normalizeSessionHistoryItem(item: unknown, index: number): GatewaySessionHistoryItem | null {
  const obj = asObject(item);
  if (!obj) {
    const text = textFromUnknown(item);
    if (!text) {
      return null;
    }
    return {
      id: `line-${index + 1}`,
      role: "unknown",
      text,
    };
  }

  const role =
    pickFirstString([obj.role, obj.authorRole, obj.senderRole, obj.sender, obj.type]) || "unknown";
  const text =
    textFromUnknown(obj.message) ||
    textFromUnknown(obj.content) ||
    textFromUnknown(obj.text) ||
    textFromUnknown(obj.data) ||
    textFromUnknown(obj.delta);

  if (!text) {
    return null;
  }

  const ts =
    toTimestamp(obj.ts) ||
    toTimestamp(obj.createdAtMs) ||
    toTimestamp(obj.updatedAtMs) ||
    toTimestamp(obj.createdAt) ||
    toTimestamp(obj.updatedAt);

  const id = pickFirstString([obj.id, obj.messageId, obj.runId]) || `line-${index + 1}`;

  return {
    id,
    role,
    text,
    ts,
  };
}

export async function listGatewaySessions(limit = 200): Promise<GatewaySessionListItem[]> {
  const safeLimit = Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.floor(limit))) : 200;
  const result = await callGatewayMethodViaCli("sessions.list", {
    limit: safeLimit,
    includeDerivedTitles: true,
    includeLastMessage: true,
    includeGlobal: true,
    includeUnknown: true,
  });

  const sessions = arrayFromPayload(result.payload)
    .map((item) => normalizeSessionListItem(item))
    .filter((item): item is GatewaySessionListItem => Boolean(item))
    .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));

  return sessions;
}

export async function listGatewaySessionHistory(
  sessionKey: string,
  limit = 200
): Promise<GatewaySessionHistoryItem[]> {
  const safeLimit = Number.isFinite(limit) ? Math.min(1000, Math.max(1, Math.floor(limit))) : 200;
  const result = await callGatewayMethodViaCli("chat.history", {
    sessionKey,
    limit: safeLimit,
  });

  return arrayFromPayload(result.payload)
    .map((item, index) => normalizeSessionHistoryItem(item, index))
    .filter((item): item is GatewaySessionHistoryItem => Boolean(item));
}
