import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { asObject, readNonEmptyString } from "../lib/value";

type PersistedGatewayDeviceState = {
  version: 1;
  updatedAt: string;
  identity?: {
    deviceId: string;
    privateKeyPem: string;
    publicKeyRawBase64Url: string;
  };
  deviceToken?: string;
};

const DEFAULT_GATEWAY_STATE_PATH = path.join(os.homedir(), ".clawos", "gateway-device-state.json");

function resolveGatewayStatePath(): string {
  const fromEnv = process.env.CLAWOS_GATEWAY_STATE_PATH?.trim();
  return fromEnv || DEFAULT_GATEWAY_STATE_PATH;
}

function parseState(raw: string): PersistedGatewayDeviceState | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const obj = asObject(parsed);
    if (!obj) {
      return null;
    }

    const identityObj = asObject(obj.identity);
    const deviceId = readNonEmptyString(identityObj?.deviceId);
    const privateKeyPem = readNonEmptyString(identityObj?.privateKeyPem);
    const publicKeyRawBase64Url = readNonEmptyString(identityObj?.publicKeyRawBase64Url);
    const identity =
      deviceId && privateKeyPem && publicKeyRawBase64Url
        ? {
            deviceId,
            privateKeyPem,
            publicKeyRawBase64Url,
          }
        : undefined;

    const deviceToken = readNonEmptyString(obj.deviceToken);

    return {
      version: 1,
      updatedAt: readNonEmptyString(obj.updatedAt) || new Date().toISOString(),
      identity,
      deviceToken: deviceToken || undefined,
    };
  } catch {
    return null;
  }
}

function readState(): PersistedGatewayDeviceState | null {
  try {
    const filePath = resolveGatewayStatePath();
    const text = readFileSync(filePath, "utf-8");
    return parseState(text);
  } catch {
    return null;
  }
}

function writeState(next: PersistedGatewayDeviceState): void {
  const filePath = resolveGatewayStatePath();
  const dirPath = path.dirname(filePath);
  mkdirSync(dirPath, { recursive: true });

  const tmpPath = `${filePath}.tmp`;
  const content = `${JSON.stringify(next, null, 2)}\n`;
  writeFileSync(tmpPath, content, "utf-8");
  renameSync(tmpPath, filePath);
}

export function readPersistedGatewayDeviceIdentity():
  | {
      deviceId: string;
      privateKeyPem: string;
      publicKeyRawBase64Url: string;
    }
  | null {
  return readState()?.identity || null;
}

export function persistGatewayDeviceIdentity(identity: {
  deviceId: string;
  privateKeyPem: string;
  publicKeyRawBase64Url: string;
}): void {
  const current = readState();
  writeState({
    version: 1,
    updatedAt: new Date().toISOString(),
    identity,
    deviceToken: current?.deviceToken,
  });
}

export function readPersistedGatewayDeviceToken(): string | undefined {
  return readState()?.deviceToken;
}

export function persistGatewayDeviceToken(deviceToken: string): void {
  const normalized = deviceToken.trim();
  if (!normalized) {
    return;
  }
  const current = readState();
  writeState({
    version: 1,
    updatedAt: new Date().toISOString(),
    identity: current?.identity,
    deviceToken: normalized,
  });
}
