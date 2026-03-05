import { describe, expect, it } from "bun:test";
import {
  buildOpenclawConfigBackupListScript,
  buildOpenclawConfigRollbackSteps,
} from "../../src/tasks/gateway";

describe("gateway backup scripts", () => {
  it("builds backup list script with mac and linux stat compatibility", () => {
    const script = buildOpenclawConfigBackupListScript("~/.openclaw/openclaw.json");
    expect(script).toContain('stat -c "%Y %s"');
    expect(script).toContain('stat -f "%m %z"');
    expect(script).toContain('config_path_raw="~/.openclaw/openclaw.json"');
    expect(script).toContain('config_path="$HOME/${config_path_raw#~/}"');
  });

  it("builds rollback script with home path expansion", () => {
    const [step] = buildOpenclawConfigRollbackSteps("/tmp/openclaw.json.20260305.bak");
    expect(step.script).toContain('target_path_raw="');
    expect(step.script).toContain('target_path="$HOME/${target_path_raw#~/}"');
    expect(step.script).toContain('cp "$backup_path" "$target_path"');
  });
});
