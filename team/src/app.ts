import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAgentController } from "./controllers/agent.controller";
import { createAuditController } from "./controllers/audit.controller";
import { createConsoleController } from "./controllers/console.controller";
import { createFrontendController } from "./controllers/frontend.controller";
import { createMissionApiController } from "./controllers/mission-api.controller";
import { createTeamApiController } from "./controllers/team-api.controller";
import type { AppEnv } from "./types";

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", cors());

  app.route("/", createFrontendController());
  app.route("/", createTeamApiController());
  app.route("/", createConsoleController());
  app.route("/", createAgentController());
  app.route("/", createAuditController());
  app.route("/", createMissionApiController());

  return app;
}
