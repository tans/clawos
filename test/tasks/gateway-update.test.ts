import { describe, expect, it } from "bun:test";
import { OPENCLAW_SOURCE_DIR, buildOpenclawSourceUpdateSteps } from "../../src/tasks/gateway";

describe("openclaw source update steps", () => {
  it("follows the required 8-step source update flow", () => {
    const steps = buildOpenclawSourceUpdateSteps();

    expect(steps).toHaveLength(8);
    expect(steps.map((item) => item.command)).toEqual([
      `cd ${OPENCLAW_SOURCE_DIR}`,
      `cd ${OPENCLAW_SOURCE_DIR} && git pull --no-rebase -X theirs --no-edit`,
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

  it("uses non-rebase git pull and short-circuits when source is unchanged", () => {
    const steps = buildOpenclawSourceUpdateSteps();
    const gitPullStep = steps[1];

    expect(gitPullStep?.script).toContain("git pull --no-rebase -X theirs --no-edit");
    expect(gitPullStep?.script).toContain('before_commit="$(git rev-parse HEAD)"');
    expect(gitPullStep?.script).toContain('after_commit="$(git rev-parse HEAD)"');
    expect(gitPullStep?.script).toContain("__CLAWOS_TASK_EARLY_SUCCESS__");
  });
});
