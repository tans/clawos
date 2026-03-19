import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAgentController } from "./controllers/agent.controller";
import { createAuditController } from "./controllers/audit.controller";
import { createConsoleController } from "./controllers/console.controller";
import type { AppEnv } from "./types";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", cors());

  app.route("/", createConsoleController());
  app.route("/", createAgentController());
  app.route("/", createAuditController());

  return app;
}
