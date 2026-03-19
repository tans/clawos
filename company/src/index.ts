import { createApp } from "./app";
import { DB_PATH } from "./db";

const PORT = Number(process.env.PORT || 8787);
const app = createApp();

console.log(`[company] listening on http://127.0.0.1:${PORT}`);
console.log(`[company] sqlite: ${DB_PATH}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
