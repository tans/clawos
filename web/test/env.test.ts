import { afterEach, describe, expect, it } from "bun:test";
import type { AppEnv } from "../src/lib/env";
import {
  validateStartupEnv,
  getEnv,
  resetEnvCacheForTests,
} from "../src/lib/env";

const baseEnv: AppEnv = {
  port: 26222,
  uploadToken: "clawos",
  adminUsername: "admin",
  adminPassword: "123456",
  maxInstallerSizeBytes: 1,
  maxConfigSizeBytes: 1,
  maxMcpPackageSizeBytes: 1,
  storageDir: "/tmp/clawos-web",
  marketplaceEnabled: false,
};

describe("validateStartupEnv", () => {
  it("warns when UPLOAD_TOKEN is missing", () => {
    const env: AppEnv = {
      ...baseEnv,
      uploadToken: null,
      adminUsername: null,
      adminPassword: null,
    };

    const checks = validateStartupEnv(env);
    expect(checks.some((item) => item.level === "warn")).toBeTrue();
    expect(
      checks.some((item) => item.message.includes("UPLOAD_TOKEN")),
    ).toBeTrue();
  });

  it("warns when using default token", () => {
    const checks = validateStartupEnv(baseEnv);
    expect(
      checks.some((item) => item.message.includes("默认 UPLOAD_TOKEN=clawos")),
    ).toBeTrue();
  });
});

describe("getEnv marketplace flag", () => {
  const originalValue = process.env.MARKETPLACE_ENABLED;

  afterEach(() => {
    resetEnvCacheForTests();
    if (originalValue === undefined) {
      delete process.env.MARKETPLACE_ENABLED;
    } else {
      process.env.MARKETPLACE_ENABLED = originalValue;
    }
  });

  it("parses true values", () => {
    process.env.MARKETPLACE_ENABLED = "1";
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.marketplaceEnabled).toBeTrue();
  });

  it("parses false values", () => {
    process.env.MARKETPLACE_ENABLED = "false";
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.marketplaceEnabled).toBeFalse();
  });
});
