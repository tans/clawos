import { Database } from "bun:sqlite";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { BomRuntimeEnv, resolveRuntimeEnv } from "../runtime-env";

export interface DoctorResult {
  ok: boolean;
  runtime: BomRuntimeEnv;
  checks: DoctorCheck[];
  warnings: string[];
}

interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function ensureWritableDir(dir: string, name: string, checks: DoctorCheck[]): Promise<void> {
  try {
    const dirStat = await stat(dir);
    if (!dirStat.isDirectory()) {
      checks.push({ name, ok: false, detail: `${dir} 不是目录` });
      return;
    }
    await access(dir, constants.W_OK);
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, detail: formatError(error) });
  }
}

async function probeSqlite(dbPath: string): Promise<DoctorCheck> {
  try {
    const dbStat = await stat(dbPath);
    if (!dbStat.isFile()) {
      return { name: "sqliteWritable", ok: false, detail: `${dbPath} 不是数据库文件` };
    }

    await access(dbPath, constants.R_OK | constants.W_OK);
    await access(dirname(dbPath), constants.W_OK);

    const db = new Database(dbPath, { create: false, readonly: true });
    db.exec("PRAGMA schema_version;");
    db.close();
    return { name: "sqliteWritable", ok: true };
  } catch (error) {
    return { name: "sqliteWritable", ok: false, detail: formatError(error) };
  }
}

export async function doctorTool(): Promise<DoctorResult> {
  const runtime = resolveRuntimeEnv();
  const checks: DoctorCheck[] = [];

  await ensureWritableDir(runtime.stateDir, "stateDirWritable", checks);
  await ensureWritableDir(runtime.exportDir, "exportDirWritable", checks);
  await ensureWritableDir(runtime.cacheDir, "cacheDirWritable", checks);

  checks.push(await probeSqlite(runtime.dbPath));

  const bunVersionDetail = typeof Bun === "object" && typeof Bun.version === "string" ? Bun.version : "unknown";
  checks.push({ name: "bunVersion", ok: true, detail: bunVersionDetail });

  const ok = checks.every((check) => check.ok);
  const warnings = runtime.publicBaseUrl
    ? []
    : ["publicBaseUrl 未设置，downloadUrl 将不会返回。"];

  return {
    ok,
    runtime,
    checks,
    warnings,
  };
}
