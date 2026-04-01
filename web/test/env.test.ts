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

  const truthyValues = ["1", "true", "yes", "on"];
  for (const value of truthyValues) {
    it(`parses ${value} as true`, () => {
      process.env.MARKETPLACE_ENABLED = value;
      resetEnvCacheForTests();
      const env = getEnv();
      expect(env.marketplaceEnabled).toBeTrue();
    });
  }

  const falsyValues = ["0", "false", "no", "off"];
  for (const value of falsyValues) {
    it(`parses ${value} as false`, () => {
      process.env.MARKETPLACE_ENABLED = value;
      resetEnvCacheForTests();
      const env = getEnv();
      expect(env.marketplaceEnabled).toBeFalse();
    });
  }

  it("defaults to false when unset", () => {
    delete process.env.MARKETPLACE_ENABLED;
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.marketplaceEnabled).toBeFalse();
  });

  it("falls back to false for invalid values", () => {
    process.env.MARKETPLACE_ENABLED = "maybe";
    resetEnvCacheForTests();
    const env = getEnv();
    expect(env.marketplaceEnabled).toBeFalse();
  });
});
