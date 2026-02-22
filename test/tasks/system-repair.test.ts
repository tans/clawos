import { describe, expect, it } from "bun:test";
import { buildWslRepairSteps } from "../../src/tasks/system";

describe("wsl repair steps", () => {
  it("builds combined pnpm/nrm repair step", () => {
    const steps = buildWslRepairSteps(["pnpm", "nrm"]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.name).toBe("修复 pnpm / nrm");
  });

  it("builds git + pnpm/nrm + openclaw in stable order", () => {
    const steps = buildWslRepairSteps(["openclaw", "git", "nrm", "pnpm"]);
    expect(steps.map((item) => item.name)).toEqual([
      "修复 git",
      "修复 pnpm / nrm",
      "修复 openclaw",
    ]);
  });

  it("ignores unknown commands", () => {
    const steps = buildWslRepairSteps(["foo", "bar"]);
    expect(steps).toHaveLength(0);
  });
});
