export const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
export const PROTOCOL_VERSION = 3;

export type GatewayErrorShape = {
  code?: string;
  message?: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayErrorShape;
};

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: unknown;
};

export type GatewayHelloPayload = {
  type: "hello-ok";
  protocol: number;
  server?: {
    version?: string;
    commit?: string;
    host?: string;
    connId?: string;
  };
  features?: {
    methods?: string[];
    events?: string[];
  };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    maxPayload?: number;
    maxBufferedBytes?: number;
    tickIntervalMs?: number;
  };
};

export type GatewayCallResult<T> = {
  payload: T;
  hello: GatewayHelloPayload;
  events: GatewayEventFrame[];
  url: string;
};

export type GatewayConnectionSettings = {
  url: string;
  token?: string;
  password?: string;
  deviceToken?: string;
  origin?: string;
  resolvedFrom: string[];
};

export type GatewayConfigSnapshot = {
  path?: string;
  exists?: boolean;
  raw?: string | null;
  parsed?: unknown;
  valid?: boolean;
  config?: Record<string, unknown>;
  hash?: string;
  issues?: Array<{ path?: string; message?: string }>;
  warnings?: Array<{ path?: string; message?: string }>;
};
