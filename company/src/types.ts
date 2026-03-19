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

export type AuditLogRow = {
  id: number;
  actor: string;
  action: string;
  deviceId: string | null;
  controllerAddress: string | null;
  detail: string | null;
  createdAt: number;
};

export type AppVariables = {
  consoleUser: ConsoleUser;
};

export type AppEnv = {
  Variables: AppVariables;
};
