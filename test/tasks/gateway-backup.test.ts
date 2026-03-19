import { describe, expect, it } from "bun:test";
import {
  buildOpenclawConfigBackupListScript,
  buildOpenclawConfigRollbackSteps,
  parseOpenclawConfigBackupLine,
  resolveOpenclawBackupSearchConfigPaths,
} from "../../app/src/tasks/gateway";

describe("gateway backup scripts", () => {
  it("builds backup list script with find + sort output", () => {
    const script = buildOpenclawConfigBackupListScript("~/.openclaw/openclaw.json");
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("if [ ! -d ~/.openclaw ]");
    expect(script).toContain("find ~/.openclaw -maxdepth 1 -type f");
    expect(script).toContain("-name 'openclaw.json*.bak'");
    expect(script).toContain("-name 'openclaw.json*.backup'");
    expect(script).toContain("-name 'openclaw.json*.old'");
    expect(script).toContain("-printf '%T@\\t%s\\t%p\\n'");
    expect(script).toContain("sort -rn -k1,1");
  });

  it("parses decimal mtime from find output", () => {
    const parsed = parseOpenclawConfigBackupLine("1739000000.123456789\t2602\t/root/.openclaw/openclaw.json.bak");
    expect(parsed?.modifiedAtEpoch).toBe(1739000000);
    expect(parsed?.size).toBe(2602);
    expect(parsed?.fileName).toBe("openclaw.json.bak");
  });

  it("builds rollback script with home path expansion", () => {
    const [step] = buildOpenclawConfigRollbackSteps("/tmp/openclaw.json.20260305.bak");
    expect(step.script).toContain('target_path_raw="');
    expect(step.script).toContain('case "$target_path_raw" in');
    expect(step.script).toContain('"~/"*) target_path="$HOME/${target_path_raw:2}"');
    expect(step.script).toContain('cp "$backup_path" "$target_path"');
  });

  it("adds /root fallback candidates for windows backup lookup", () => {
    const paths = resolveOpenclawBackupSearchConfigPaths("~/.openclaw/openclaw.json", { isWindows: true });
    expect(paths).toEqual(["~/.openclaw/openclaw.json", "/root/.openclaw/openclaw.json"]);
  });

  it("always includes windows default backup path when custom config path is used", () => {
    const paths = resolveOpenclawBackupSearchConfigPaths("/custom/openclaw.json", { isWindows: true });
    expect(paths).toEqual(["/custom/openclaw.json", "/root/.openclaw/openclaw.json"]);
  });
});
