import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const releaseWorkflowPath = ".github/workflows/release-build-publish.yml";
const canaryWorkflowPath = ".github/workflows/canary-on-merge.yml";
const packageJsonPath = "package.json";

function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function resolveDispatchVersion(baseVersion: string, releaseChannel: "beta" | "stable", runNumber: number): string {
  return `${baseVersion}-${releaseChannel}.${runNumber}`;
}

function resolveCanaryVersion(baseVersion: string, runNumber: number): string {
  return `${baseVersion}-canary.${runNumber}`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

describe("publish flows (action simulation)", () => {
  it("keeps package publish/release scripts wired to dedicated release tools", () => {
    const pkg = JSON.parse(readText(packageJsonPath)) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts || {};

    expect(scripts.publish).toBe("bun run scripts/publish-clawos.ts");
    expect(scripts["publish:all"]).toBe("bun run scripts/publish-clawos.ts");
    expect(scripts["publish:installer"]).toContain("scripts/publish-clawos.ts --skip-config");
    expect(scripts["publish:config"]).toContain("scripts/publish-clawos.ts --skip-installer");
    expect(scripts["publish:mcp"]).toBe("bun run scripts/publish-mcp.ts");
    expect(scripts["publish:mcp:all"]).toContain("scripts/publish-mcp.ts --all");
    expect(scripts.release).toContain("scripts/release-clawos.ts --env=stable");
    expect(scripts["release:beta"]).toContain("-- --release-channel=beta");
  });

  it("simulates workflow_dispatch version resolution for stable/beta channels", () => {
    const releaseWorkflow = readText(releaseWorkflowPath);

    expect(releaseWorkflow).toContain("if [[ \"${channel}\" == \"beta\" ]]; then");
    expect(releaseWorkflow).toContain('publish_version="${base_version}-beta.${GITHUB_RUN_NUMBER}"');
    expect(releaseWorkflow).toContain('publish_version="${base_version}-stable.${GITHUB_RUN_NUMBER}"');

    expect(resolveDispatchVersion("0.9.44", "beta", 103)).toBe("0.9.44-beta.103");
    expect(resolveDispatchVersion("0.9.44", "stable", 103)).toBe("0.9.44-stable.103");
  });

  it("simulates canary merge version resolution", () => {
    const canaryWorkflow = readText(canaryWorkflowPath);

    expect(canaryWorkflow).toContain('canary_version="${base_version}-canary.${GITHUB_RUN_NUMBER}"');
    expect(resolveCanaryVersion("0.9.44", 205)).toBe("0.9.44-canary.205");
  });

  it("ensures all action publish branches pass mandatory publish arguments", () => {
    const releaseWorkflow = normalizeWhitespace(readText(releaseWorkflowPath));
    const canaryWorkflow = normalizeWhitespace(readText(canaryWorkflowPath));

    const requiredArgs = [
      "--build-env \"${BUILD_ENV}\"",
      "--release-channel \"${RELEASE_CHANNEL}\"",
      "--version \"${CLAWOS_VERSION}\"",
      "--timeout-ms \"${UPLOAD_TIMEOUT_MS}\"",
      "--heartbeat-ms \"${UPLOAD_HEARTBEAT_MS}\"",
    ];

    for (const arg of requiredArgs) {
      expect(releaseWorkflow).toContain(arg);
      expect(canaryWorkflow).toContain(arg);
    }

    expect(releaseWorkflow).toContain('if [[ -n "${PUBLISH_BASE_URL:-}" ]]; then bun run publish -- --base-url "${PUBLISH_BASE_URL}"');
    expect(canaryWorkflow).toContain('if [[ -n "${PUBLISH_BASE_URL:-}" ]]; then bun run publish -- --base-url "${PUBLISH_BASE_URL}"');
    expect(releaseWorkflow).toContain("else bun run publish -- --build-env");
    expect(canaryWorkflow).toContain("else bun run publish -- --build-env");
  });
});
