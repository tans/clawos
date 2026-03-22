export type ConsoleUser = {
  id: number;
  mobile: string;
  walletAddress: string;
};

export type HostRow = {
  hostId: string;
  name: string;
  agentToken: string;
  controllerAddress: string;
  status: string;
  platform: string | null;
  wslDistro: string | null;
  clawosVersion: string | null;
  wslReady: number;
  gatewayReady: number;
  lastSeenMs: number | null;
  createdAt: number;
  updatedAt: number;
};

export type HostCommandRow = {
  id: string;
  kind: string;
  payload: string;
  status: string;
  dedupeKey: string | null;
  expiresAt: number | null;
  result: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PendingCommandRow = {
  id: string;
  kind: string;
  payload: string;
  createdAt: number;
};

export type ConsoleCredentialRow = {
  id: number;
  mobile: string;
  passwordHash: string;
  walletAddress: string;
};

export type CompanyRow = {
  id: string;
  ownerUserId: number;
  name: string;
  slug: string;
  mode: string;
  createdAt: number;
  updatedAt: number;
};

export type AuditLogRow = {
  id: number;
  actor: string;
  action: string;
  deviceId: string | null;
  controllerAddress: string | null;
  detail: string | null;
  createdAt: number;
};

export type AgentEventRow = {
  id: string;
  hostId: string;
  eventType: string;
  severity: "info" | "warning" | "error";
  title: string | null;
  payload: string | null;
  createdAt: number;
};

export type HostInsightRow = {
  hostId: string;
  hostName: string;
  status: string;
  lastSeenMs: number | null;
  totalEvents: number;
  warningEvents: number;
  errorEvents: number;
  lastEventAt: number | null;
};

export type AppVariables = {
  consoleUser: ConsoleUser;
};

export type AppEnv = {
  Variables: AppVariables;
};
