import { describe, expect, it } from "bun:test";
import { OPENCLAW_SOURCE_DIR, buildOpenclawSourceUpdateSteps } from "../../src/tasks/gateway";

describe("openclaw source update steps", () => {
  it("follows the required 8-step source update flow", () => {
    const steps = buildOpenclawSourceUpdateSteps();

    expect(steps).toHaveLength(8);
    expect(steps.map((item) => item.command)).toEqual([
      `cd ${OPENCLAW_SOURCE_DIR}`,
      `cd ${OPENCLAW_SOURCE_DIR} && git fetch origin main --prune && git reset --hard origin/main && git clean -fd`,
      `cd ${OPENCLAW_SOURCE_DIR} && npm i -g nrm`,
      `cd ${OPENCLAW_SOURCE_DIR} && nrm use tencent`,
      `cd ${OPENCLAW_SOURCE_DIR} && pnpm install`,
      `cd ${OPENCLAW_SOURCE_DIR} && pnpm run build`,
      `cd ${OPENCLAW_SOURCE_DIR} && pnpm run ui:build`,
      `cd ${OPENCLAW_SOURCE_DIR} && openclaw gateway restart`,
    ]);
  });

  it("pins every executable step to the source directory", () => {
    const steps = buildOpenclawSourceUpdateSteps();
    const executableScripts = steps.slice(1).map((item) => item.script);

    for (const script of executableScripts) {
      expect(script).toContain(`cd ${OPENCLAW_SOURCE_DIR}`);
    }
  });

  it("force syncs with remote and discards local changes", () => {
    const steps = buildOpenclawSourceUpdateSteps();
    const gitSyncStep = steps[1];

    expect(gitSyncStep?.script).toContain("git fetch origin main --prune");
    expect(gitSyncStep?.script).toContain("git reset --hard origin/main");
    expect(gitSyncStep?.script).toContain("git clean -fd");
  });

  it("short-circuits when source is unchanged", () => {
    const steps = buildOpenclawSourceUpdateSteps("abc123");
    const gitSyncStep = steps[1];

    expect(gitSyncStep?.script).toContain('before_commit="$(git rev-parse HEAD)"');
    expect(gitSyncStep?.script).toContain('saved_hash="abc123"');
    expect(gitSyncStep?.script).toContain('remote_commit="$(git rev-parse origin/main)"');
    expect(gitSyncStep?.script).toContain('echo "__CLAWOS_REMOTE_COMMIT__=$remote_commit"');
    expect(gitSyncStep?.script).toContain('if [ -n "$saved_hash" ] && [ "$saved_hash" = "$remote_commit" ]; then');
    expect(gitSyncStep?.script).toContain("__CLAWOS_TASK_EARLY_SUCCESS__");
  });
});
