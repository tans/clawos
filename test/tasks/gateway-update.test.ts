import { describe, expect, it } from "bun:test";
import { OPENCLAW_SOURCE_DIR, buildOpenclawSourceUpdateSteps } from "../../src/tasks/gateway";

describe("openclaw source update steps", () => {
  it("follows the required 7-step source update flow", () => {
    const steps = buildOpenclawSourceUpdateSteps();

    expect(steps).toHaveLength(7);
    expect(steps.map((item) => item.command)).toEqual([
      `cd ${OPENCLAW_SOURCE_DIR}`,
      `cd ${OPENCLAW_SOURCE_DIR} && git pull -X theirs`,
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
});
