import { describe, expect, it } from "bun:test";
import type { AppEnv } from "../src/lib/env";
import { validateStartupEnv } from "../src/lib/env";

describe("validateStartupEnv", () => {
  it("warns when UPLOAD_TOKEN is missing", () => {
    const env: AppEnv = {
      port: 26222,
      uploadToken: null,
      maxInstallerSizeBytes: 1,
      maxConfigSizeBytes: 1,
      storageDir: "/tmp/clawos-web",
    };

    const checks = validateStartupEnv(env);
    expect(checks.some((item) => item.level === "warn")).toBeTrue();
    expect(
      checks.some((item) => item.message.includes("UPLOAD_TOKEN")),
    ).toBeTrue();
  });
});
