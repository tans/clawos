import { Hono } from "hono";
import { listAuditLogs } from "../models/company.model";
import type { AppEnv } from "../types";
import { parseLimit } from "../utils/validators";
import { safeJsonParse } from "../utils/request";

export function createAuditController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.get("/api/audit", (c) => {
    const limit = parseLimit(c.req.query("limit"), 50);
    const logs = listAuditLogs(limit);

    return c.json({
      ok: true,
      logs: logs.map((item) => ({
        ...item,
        detail: safeJsonParse<unknown | null>(item.detail, null),
      })),
    });
  });

  return controller;
}
