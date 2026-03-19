import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { registerApiRoutes } from "./controllers/api.controller";
import { registerWebRoutes } from "./controllers/web.controller";
import { initDb } from "./models/mission.model";

initDb();

const app = new Hono();

app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));

registerWebRoutes(app);
registerApiRoutes(app);

const port = Number(process.env.PORT ?? 9090);
console.log(`Agent Mission running at http://127.0.0.1:${port}`);

export default {
  port,
  fetch: app.fetch
};
