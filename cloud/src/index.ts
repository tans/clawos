import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { auditLog, db, DB_PATH, newId, nowMs } from "./db";

type ConsoleUser = {
  id: number;
  mobile: string;
  walletAddress: string;
};

type HostRow = {
  hostId: string;
  name: string;
  agentToken: string;
  controllerAddress: string;
  status: string;
  platform: string | null;
  wslDistro: string | null;
  clawosVersion: string | null;
  wslReady: number;
  gatewayReady: number;
  lastSeenMs: number | null;
  createdAt: number;
  updatedAt: number;
};

type AppVariables = {
  consoleUser: ConsoleUser;
};

const PORT = Number(process.env.PORT || 8787);
const CONSOLE_SESSION_COOKIE = "clawos_console_session";
const CONSOLE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOST_OFFLINE_THRESHOLD_MS = 30 * 1000;

const app = new Hono<{ Variables: AppVariables }>();
app.use("*", cors());

function jsonError(c: Context, status: number, code: string, message: string, hint?: string) {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        hint: hint || null,
      },
    },
    status as 400
  );
}

async function readJsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = (await c.req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readFormText(data: Record<string, string | File | (string | File)[]>, key: string): string {
  const raw = data[key];
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0].trim();
  }
  return "";
}

function normalizeMobile(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^\+?[0-9]{6,20}$/.test(value)) {
    return null;
  }
  return value;
}

function normalizeWalletAddress(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

function normalizeHostId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!/^[a-zA-Z0-9_.:-]{2,128}$/.test(value)) {
    return null;
  }
  return value;
}

function normalizeHostName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value || value.length > 64) {
    return null;
  }
  return value;
}

function parseLimit(raw: string | undefined, fallback = 20): number {
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return Math.min(100, Math.floor(n));
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) {
    return "-";
  }
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function displayHostStatus(status: string, lastSeenMs: number | null): "online" | "degraded" | "offline" {
  if (!lastSeenMs || nowMs() - lastSeenMs > HOST_OFFLINE_THRESHOLD_MS) {
    return "offline";
  }
  return status === "degraded" ? "degraded" : "online";
}

function clearExpiredRows(): void {
  const now = nowMs();
  db.prepare("DELETE FROM console_sessions WHERE expires_at < ?").run(now);
}

function newToken(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function pageShell(title: string, body: string, user?: ConsoleUser): string {
  const nav = user
    ? `<div class="topbar"><span>账号：${escapeHtml(user.mobile)}（钱包：${escapeHtml(user.walletAddress)}）</span><a href="/console/logout">退出</a></div>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", "PingFang SC", sans-serif; color: #1f2937; background: radial-gradient(circle at top right, #f7efe1, #e9f4ff 50%, #f3f7ff); }
    main { max-width: 1080px; margin: 18px auto 40px; padding: 0 14px; }
    .topbar { display: flex; justify-content: space-between; align-items: center; background: #ffffffd9; border: 1px solid #d6d8de; border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; }
    .topbar a { color: #0f766e; text-decoration: none; font-weight: 600; }
    .card { background: #ffffffdf; border: 1px solid #d6d8de; border-radius: 14px; padding: 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
    .title { margin: 0 0 8px; font-size: 22px; }
    .muted { color: #4b5563; }
    .error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 10px; border-radius: 10px; margin-bottom: 12px; }
    .ok { background: #ecfeff; color: #155e75; border: 1px solid #a5f3fc; padding: 10px; border-radius: 10px; margin-bottom: 12px; }
    label { display: block; margin: 10px 0 6px; font-size: 13px; color: #374151; }
    input, textarea { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; padding: 10px; font-size: 14px; background: #fff; }
    textarea { min-height: 90px; resize: vertical; }
    button { margin-top: 10px; border: 0; background: #0f766e; color: white; border-radius: 10px; padding: 10px 14px; cursor: pointer; font-weight: 600; }
    button:hover { background: #115e59; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px 6px; font-size: 13px; vertical-align: top; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pill { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
    .st-online { background: #dcfce7; color: #166534; }
    .st-degraded { background: #fef9c3; color: #854d0e; }
    .st-offline { background: #f3f4f6; color: #4b5563; }
    a { color: #0f766e; }
    pre { margin: 0; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <main>
    ${nav}
    ${body}
  </main>
</body>
</html>`;
}

function renderLoginPage(error = "", mobile = ""): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : "";
  return pageShell(
    "ClawOS Cloud 登录",
    `<section class="card" style="max-width:480px;margin:40px auto;">
      <h1 class="title">云端控制台登录</h1>
      <p class="muted">使用手机号和密码登录。</p>
      ${errorHtml}
      <form method="post" action="/console/login">
        <label>手机号</label>
        <input name="mobile" value="${escapeHtml(mobile)}" placeholder="例如 +8613812345678" />
        <label>密码</label>
        <input type="password" name="password" placeholder="请输入密码" />
        <button type="submit">登录</button>
      </form>
      <p class="muted" style="margin-top:10px;">没有账号？<a href="/console/register">去注册</a></p>
    </section>`
  );
}

function renderRegisterPage(error = "", payload?: { mobile?: string; walletAddress?: string }): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : "";
  return pageShell(
    "ClawOS Cloud 注册",
    `<section class="card" style="max-width:520px;margin:40px auto;">
      <h1 class="title">注册控制台账号</h1>
      <p class="muted">注册后使用手机号 + 密码登录，钱包地址用于匹配你能控制的主机。</p>
      ${errorHtml}
      <form method="post" action="/console/register">
        <label>手机号</label>
        <input name="mobile" value="${escapeHtml(payload?.mobile || "")}" />
        <label>钱包地址（控制人地址）</label>
        <input name="walletAddress" value="${escapeHtml(payload?.walletAddress || "")}" placeholder="0x..." />
        <label>密码</label>
        <input type="password" name="password" placeholder="至少 8 位" />
        <label>确认密码</label>
        <input type="password" name="confirmPassword" placeholder="再次输入密码" />
        <button type="submit">注册</button>
      </form>
      <p class="muted" style="margin-top:10px;"><a href="/console/login">返回登录</a></p>
    </section>`
  );
}

function loadHost(hostId: string): HostRow | null {
  return db
    .query(
      `SELECT
         host_id AS hostId,
         name,
         agent_token AS agentToken,
         controller_address AS controllerAddress,
         status,
         platform,
         wsl_distro AS wslDistro,
         clawos_version AS clawosVersion,
         wsl_ready AS wslReady,
         gateway_ready AS gatewayReady,
         last_seen_ms AS lastSeenMs,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM hosts WHERE host_id = ?`
    )
    .get(hostId) as HostRow | null;
}

function ensureHostOwned(hostId: string, walletAddress: string): HostRow | null {
  const host = loadHost(hostId);
  if (!host) {
    return null;
  }
  if (host.controllerAddress !== walletAddress) {
    return null;
  }
  return host;
}

function createCommand(hostId: string, kind: string, payload: Record<string, unknown>): string {
  const commandId = newId("cmd");
  const now = nowMs();
  db.prepare(
    `INSERT INTO commands (id, device_id, kind, payload, status, result, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)`
  ).run(commandId, hostId, kind, JSON.stringify(payload), now, now);
  return commandId;
}

async function readConsoleUserByCookie(c: Context): Promise<ConsoleUser | null> {
  clearExpiredRows();
  const token = getCookie(c, CONSOLE_SESSION_COOKIE) || "";
  if (!token) {
    return null;
  }

  const row = db
    .query(
      `SELECT
         u.id AS id,
         u.mobile AS mobile,
         u.wallet_address AS walletAddress
       FROM console_sessions s
       JOIN console_users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, nowMs()) as ConsoleUser | null;

  return row;
}

function setConsoleSession(c: Context, userId: number): void {
  const token = newToken("web");
  const now = nowMs();
  const expiresAt = now + CONSOLE_SESSION_TTL_MS;
  db.prepare(`INSERT INTO console_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run(token, userId, expiresAt, now);

  setCookie(c, CONSOLE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(CONSOLE_SESSION_TTL_MS / 1000),
  });
}

function clearConsoleSession(c: Context): void {
  const token = getCookie(c, CONSOLE_SESSION_COOKIE) || "";
  if (token) {
    db.prepare("DELETE FROM console_sessions WHERE token = ?").run(token);
  }
  deleteCookie(c, CONSOLE_SESSION_COOKIE, { path: "/" });
}

function readBearerToken(c: Context): string {
  const auth = c.req.header("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return "";
  }
  return auth.slice("Bearer ".length).trim();
}

function renderHostListPage(user: ConsoleUser, message: string): string {
  const rows = db
    .query(
      `SELECT
         host_id AS hostId,
         name,
         agent_token AS agentToken,
         controller_address AS controllerAddress,
         status,
         platform,
         wsl_distro AS wslDistro,
         clawos_version AS clawosVersion,
         wsl_ready AS wslReady,
         gateway_ready AS gatewayReady,
         last_seen_ms AS lastSeenMs,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM hosts
       WHERE controller_address = ?
       ORDER BY updated_at DESC`
    )
    .all(user.walletAddress) as HostRow[];

  const notice = message ? `<div class="ok">${escapeHtml(message)}</div>` : "";
  const bodyRows = rows
    .map((host) => {
      const state = displayHostStatus(host.status, host.lastSeenMs);
      const badgeClass = state === "online" ? "st-online" : state === "degraded" ? "st-degraded" : "st-offline";
      return `<tr>
        <td><a href="/console/hosts/${encodeURIComponent(host.hostId)}">${escapeHtml(host.name)}</a><div class="mono muted">${escapeHtml(host.hostId)}</div></td>
        <td><span class="pill ${badgeClass}">${state}</span></td>
        <td>${escapeHtml(host.clawosVersion || "-")}</td>
        <td>${host.wslReady ? "是" : "否"}</td>
        <td>${host.gatewayReady ? "是" : "否"}</td>
        <td>${escapeHtml(formatDateTime(host.lastSeenMs))}</td>
      </tr>`;
    })
    .join("");

  const table = rows.length
    ? `<table>
      <thead><tr><th>主机</th><th>状态</th><th>版本</th><th>WSL</th><th>Gateway</th><th>最后心跳</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`
    : `<p class="muted">当前没有可控制主机。请在设备端将 <span class="mono">controllerAddress</span> 设置为你的钱包地址：${escapeHtml(user.walletAddress)}</p>`;

  return pageShell(
    "主机列表",
    `<section class="card">
      <h1 class="title">主机列表</h1>
      <p class="muted">只展示 controllerAddress 与你账号钱包地址一致的主机。</p>
      ${notice}
      ${table}
    </section>`,
    user
  );
}

function renderHostDetailPage(user: ConsoleUser, host: HostRow, message: string): string {
  const rows = db
    .query(
      `SELECT id, kind, payload, status, result, created_at AS createdAt, updated_at AS updatedAt
       FROM commands
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT 40`
    )
    .all(host.hostId) as Array<{
    id: string;
    kind: string;
    payload: string;
    status: string;
    result: string | null;
    createdAt: number;
    updatedAt: number;
  }>;

  const state = displayHostStatus(host.status, host.lastSeenMs);
  const badgeClass = state === "online" ? "st-online" : state === "degraded" ? "st-degraded" : "st-offline";
  const notice = message ? `<div class="ok">${escapeHtml(message)}</div>` : "";

  const logs = rows.length
    ? rows
        .map((row) => {
          const payload = row.payload ? escapeHtml(row.payload) : "{}";
          const result = row.result ? escapeHtml(row.result) : "-";
          return `<tr>
            <td class="mono">${escapeHtml(row.id)}</td>
            <td class="mono">${escapeHtml(row.kind)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td><pre>${payload}</pre></td>
            <td><pre>${result}</pre></td>
            <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="muted">暂无任务</td></tr>`;

  return pageShell(
    `${host.name} - 控制台`,
    `<p><a href="/console">返回主机列表</a></p>
    <section class="card" style="margin-bottom:12px;">
      <h1 class="title">${escapeHtml(host.name)}</h1>
      <p class="muted mono">hostId: ${escapeHtml(host.hostId)}</p>
      <p>状态：<span class="pill ${badgeClass}">${state}</span>，最后心跳：${escapeHtml(formatDateTime(host.lastSeenMs))}</p>
      <p>版本：${escapeHtml(host.clawosVersion || "-")}，WSL：${host.wslReady ? "就绪" : "未就绪"}，Gateway：${host.gatewayReady ? "就绪" : "未就绪"}</p>
      ${notice}
    </section>

    <section class="grid" style="margin-bottom:12px;">
      <article class="card">
        <h2 style="margin-top:0;">WSL 命令执行</h2>
        <form method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/wsl-exec">
          <label>工作目录</label>
          <input name="cwd" value="/data/openclaw" />
          <label>命令</label>
          <textarea name="command" placeholder="例如 pnpm run build"></textarea>
          <button type="submit">下发 wsl.exec</button>
        </form>
      </article>

      <article class="card">
        <h2 style="margin-top:0;">ClawOS 控制</h2>
        <form method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/gateway-status">
          <button type="submit">查询 Gateway 状态</button>
        </form>
        <form method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/gateway-restart">
          <button type="submit">重启 Gateway</button>
        </form>
      </article>
    </section>

    <section class="card">
      <h2 style="margin-top:0;">最近任务</h2>
      <table>
        <thead><tr><th>ID</th><th>类型</th><th>状态</th><th>参数</th><th>结果</th><th>时间</th></tr></thead>
        <tbody>${logs}</tbody>
      </table>
    </section>`,
    user
  );
}

async function requireConsoleAuth(c: Context, next: () => Promise<void>) {
  const user = await readConsoleUserByCookie(c);
  if (!user) {
    return c.redirect("/console/login");
  }
  c.set("consoleUser", user);
  await next();
}

app.get("/", async (c) => {
  const user = await readConsoleUserByCookie(c);
  return c.redirect(user ? "/console" : "/console/login");
});

app.get("/health", (c) => {
  clearExpiredRows();
  return c.json({ ok: true, service: "clawos-cloud", dbPath: DB_PATH, ts: new Date().toISOString() });
});

app.get("/console/login", async (c) => {
  const user = await readConsoleUserByCookie(c);
  if (user) {
    return c.redirect("/console");
  }
  return c.html(renderLoginPage());
});

app.post("/console/login", async (c) => {
  const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
  const mobile = normalizeMobile(readFormText(body, "mobile"));
  const password = readFormText(body, "password");

  if (!mobile || !password) {
    return c.html(renderLoginPage("手机号和密码不能为空。", readFormText(body, "mobile")), 400);
  }

  const user = db
    .query(
      `SELECT id, mobile, password_hash AS passwordHash, wallet_address AS walletAddress
       FROM console_users
       WHERE mobile = ?`
    )
    .get(mobile) as { id: number; mobile: string; passwordHash: string; walletAddress: string } | null;

  if (!user) {
    return c.html(renderLoginPage("账号不存在。", mobile), 400);
  }

  const ok = await Bun.password.verify(password, user.passwordHash);
  if (!ok) {
    return c.html(renderLoginPage("密码错误。", mobile), 400);
  }

  setConsoleSession(c, user.id);
  auditLog({ actor: `console:${mobile}`, action: "console_login", controllerAddress: user.walletAddress });
  return c.redirect("/console");
});

app.get("/console/register", (c) => c.html(renderRegisterPage()));

app.post("/console/register", async (c) => {
  const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
  const mobileRaw = readFormText(body, "mobile");
  const walletRaw = readFormText(body, "walletAddress");
  const password = readFormText(body, "password");
  const confirmPassword = readFormText(body, "confirmPassword");

  const mobile = normalizeMobile(mobileRaw);
  const walletAddress = normalizeWalletAddress(walletRaw);

  if (!mobile) {
    return c.html(renderRegisterPage("手机号格式不合法。", { mobile: mobileRaw, walletAddress: walletRaw }), 400);
  }
  if (!walletAddress) {
    return c.html(renderRegisterPage("钱包地址格式不合法。", { mobile, walletAddress: walletRaw }), 400);
  }
  if (password.length < 8) {
    return c.html(renderRegisterPage("密码至少 8 位。", { mobile, walletAddress }), 400);
  }
  if (password !== confirmPassword) {
    return c.html(renderRegisterPage("两次密码不一致。", { mobile, walletAddress }), 400);
  }

  const exists = db
    .query("SELECT id FROM console_users WHERE mobile = ? OR wallet_address = ?")
    .get(mobile, walletAddress) as { id: number } | null;
  if (exists) {
    return c.html(renderRegisterPage("手机号或钱包地址已被注册。", { mobile, walletAddress }), 409);
  }

  const passwordHash = await Bun.password.hash(password);
  db.prepare(
    `INSERT INTO console_users (mobile, password_hash, wallet_address, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(mobile, passwordHash, walletAddress, nowMs());

  auditLog({ actor: `console:${mobile}`, action: "console_register", controllerAddress: walletAddress });
  return c.redirect("/console/login");
});

app.use("/console", requireConsoleAuth);
app.use("/console/*", requireConsoleAuth);

app.get("/console", (c) => {
  const user = c.get("consoleUser");
  const message = c.req.query("msg") || "";
  return c.html(renderHostListPage(user, message));
});

app.get("/console/logout", (c) => {
  clearConsoleSession(c);
  return c.redirect("/console/login");
});

app.get("/console/hosts/:hostId", (c) => {
  const user = c.get("consoleUser");
  const hostId = normalizeHostId(c.req.param("hostId"));
  if (!hostId) {
    return c.html(pageShell("主机不存在", `<section class="card"><p>主机 ID 不合法。</p></section>`, user), 400);
  }

  const host = ensureHostOwned(hostId, user.walletAddress);
  if (!host) {
    return c.html(pageShell("主机不存在", `<section class="card"><p>未找到该主机，或你无权访问。</p><p><a href="/console">返回列表</a></p></section>`, user), 404);
  }

  const message = c.req.query("msg") || "";
  return c.html(renderHostDetailPage(user, host, message));
});

app.post("/console/hosts/:hostId/tasks/wsl-exec", async (c) => {
  const user = c.get("consoleUser");
  const hostId = normalizeHostId(c.req.param("hostId"));
  if (!hostId) {
    return c.redirect("/console?msg=主机ID不合法");
  }

  const host = ensureHostOwned(hostId, user.walletAddress);
  if (!host) {
    return c.redirect("/console?msg=你无权操作该主机");
  }

  const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
  const command = readFormText(body, "command");
  const cwd = readFormText(body, "cwd") || "/data/openclaw";
  if (!command) {
    return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=命令不能为空`);
  }

  const commandId = createCommand(hostId, "wsl.exec", {
    cwd,
    command,
    timeoutMs: 10 * 60 * 1000,
  });

  auditLog({
    actor: `console:${user.mobile}`,
    action: "dispatch_wsl_exec",
    deviceId: hostId,
    controllerAddress: user.walletAddress,
    detail: { commandId, command, cwd },
  });

  return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发任务 ${encodeURIComponent(commandId)}`);
});

app.post("/console/hosts/:hostId/tasks/gateway-status", (c) => {
  const user = c.get("consoleUser");
  const hostId = normalizeHostId(c.req.param("hostId"));
  if (!hostId) {
    return c.redirect("/console?msg=主机ID不合法");
  }

  const host = ensureHostOwned(hostId, user.walletAddress);
  if (!host) {
    return c.redirect("/console?msg=你无权操作该主机");
  }

  const commandId = createCommand(hostId, "clawos.gateway.status", {});
  auditLog({
    actor: `console:${user.mobile}`,
    action: "dispatch_gateway_status",
    deviceId: hostId,
    controllerAddress: user.walletAddress,
    detail: { commandId },
  });

  return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发任务 ${encodeURIComponent(commandId)}`);
});

app.post("/console/hosts/:hostId/tasks/gateway-restart", (c) => {
  const user = c.get("consoleUser");
  const hostId = normalizeHostId(c.req.param("hostId"));
  if (!hostId) {
    return c.redirect("/console?msg=主机ID不合法");
  }

  const host = ensureHostOwned(hostId, user.walletAddress);
  if (!host) {
    return c.redirect("/console?msg=你无权操作该主机");
  }

  const commandId = createCommand(hostId, "clawos.gateway.action", {
    action: "restart",
  });
  auditLog({
    actor: `console:${user.mobile}`,
    action: "dispatch_gateway_restart",
    deviceId: hostId,
    controllerAddress: user.walletAddress,
    detail: { commandId },
  });

  return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发任务 ${encodeURIComponent(commandId)}`);
});

app.post("/api/agent/hello", async (c) => {
  const body = await readJsonBody(c);
  if (!body) {
    return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", "请检查 Content-Type。");
  }

  const hostId = normalizeHostId(body.hostId);
  const name = normalizeHostName(body.name);
  const controllerAddress = normalizeWalletAddress(body.controllerAddress);
  const providedToken = typeof body.agentToken === "string" ? body.agentToken.trim() : "";

  if (!hostId || !name || !controllerAddress) {
    return jsonError(c, 400, "INVALID_PARAMS", "hostId/name/controllerAddress 不合法。", "请检查上报字段。");
  }

  const platform = typeof body.platform === "string" ? body.platform.trim().slice(0, 32) : null;
  const wslDistro = typeof body.wslDistro === "string" ? body.wslDistro.trim().slice(0, 64) : null;
  const clawosVersion = typeof body.clawosVersion === "string" ? body.clawosVersion.trim().slice(0, 64) : null;

  const exists = loadHost(hostId);
  let agentToken = "";
  const now = nowMs();

  if (!exists) {
    agentToken = providedToken || newToken("agt");
    db.prepare(
      `INSERT INTO hosts
       (host_id, name, agent_token, controller_address, status, platform, wsl_distro, clawos_version, wsl_ready, gateway_ready, last_seen_ms, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'online', ?, ?, ?, 0, 0, ?, ?, ?)`
    ).run(hostId, name, agentToken, controllerAddress, platform, wslDistro, clawosVersion, now, now, now);

    auditLog({
      actor: `agent:${hostId}`,
      action: "agent_hello_new",
      deviceId: hostId,
      controllerAddress,
      detail: { name },
    });
  } else {
    if (!providedToken || providedToken !== exists.agentToken) {
      return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 无效。", "首次连接获取 token 后请持久化并在后续连接携带。");
    }

    agentToken = exists.agentToken;
    db.prepare(
      `UPDATE hosts
       SET name = ?, controller_address = ?, status = 'online', platform = ?, wsl_distro = ?, clawos_version = ?, last_seen_ms = ?, updated_at = ?
       WHERE host_id = ?`
    ).run(name, controllerAddress, platform, wslDistro, clawosVersion, now, now, hostId);

    auditLog({
      actor: `agent:${hostId}`,
      action: "agent_hello_resume",
      deviceId: hostId,
      controllerAddress,
      detail: { name },
    });
  }

  const pendingCommands = db
    .query(
      `SELECT id, kind, payload, created_at AS createdAt
       FROM commands
       WHERE device_id = ? AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 20`
    )
    .all(hostId) as Array<{ id: string; kind: string; payload: string; createdAt: number }>;

  return c.json({
    ok: true,
    serverTimeMs: now,
    host: {
      hostId,
      name,
      controllerAddress,
      agentToken,
    },
    pendingCommands: pendingCommands.map((item) => ({
      id: item.id,
      kind: item.kind,
      payload: JSON.parse(item.payload || "{}"),
      createdAt: item.createdAt,
    })),
  });
});

app.post("/api/agent/heartbeat", async (c) => {
  const body = await readJsonBody(c);
  if (!body) {
    return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", undefined);
  }

  const hostId = normalizeHostId(body.hostId);
  if (!hostId) {
    return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
  }

  const token = readBearerToken(c);
  const host = loadHost(hostId);
  if (!host || !token || token !== host.agentToken) {
    return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
  }

  const wslReady = body.wslReady === true;
  const gatewayReady = body.gatewayReady === true;
  const clawosVersion = typeof body.clawosVersion === "string" ? body.clawosVersion.trim().slice(0, 64) : host.clawosVersion;
  const status = wslReady && gatewayReady ? "online" : "degraded";
  const now = nowMs();

  db.prepare(
    `UPDATE hosts
     SET wsl_ready = ?, gateway_ready = ?, clawos_version = ?, status = ?, last_seen_ms = ?, updated_at = ?
     WHERE host_id = ?`
  ).run(wslReady ? 1 : 0, gatewayReady ? 1 : 0, clawosVersion, status, now, now, hostId);

  return c.json({ ok: true, serverTimeMs: now, status });
});

app.get("/api/agent/commands", (c) => {
  const hostId = normalizeHostId(c.req.query("hostId"));
  if (!hostId) {
    return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
  }

  const token = readBearerToken(c);
  const host = loadHost(hostId);
  if (!host || !token || token !== host.agentToken) {
    return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
  }

  const limit = parseLimit(c.req.query("limit"), 20);
  const commands = db
    .query(
      `SELECT id, kind, payload, created_at AS createdAt
       FROM commands
       WHERE device_id = ? AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(hostId, limit) as Array<{ id: string; kind: string; payload: string; createdAt: number }>;

  return c.json({
    ok: true,
    hostId,
    commands: commands.map((item) => ({
      id: item.id,
      kind: item.kind,
      payload: JSON.parse(item.payload || "{}"),
      createdAt: item.createdAt,
    })),
  });
});

app.post("/api/agent/commands/:id/result", async (c) => {
  const commandId = c.req.param("id").trim();
  if (!commandId) {
    return jsonError(c, 400, "INVALID_COMMAND_ID", "命令 ID 不能为空。", undefined);
  }

  const body = await readJsonBody(c);
  if (!body) {
    return jsonError(c, 400, "INVALID_REQUEST", "请求体必须是 JSON。", undefined);
  }

  const hostId = normalizeHostId(body.hostId);
  if (!hostId) {
    return jsonError(c, 400, "INVALID_HOST_ID", "hostId 不合法。", undefined);
  }

  const token = readBearerToken(c);
  const host = loadHost(hostId);
  if (!host || !token || token !== host.agentToken) {
    return jsonError(c, 401, "AGENT_AUTH_FAILED", "agentToken 校验失败。", undefined);
  }

  const ok = body.ok === true || body.status === "success";
  const status = ok ? "success" : "failed";
  const result = body.result ?? null;
  const now = nowMs();

  const updated = db
    .prepare(
      `UPDATE commands
       SET status = ?, result = ?, updated_at = ?
       WHERE id = ? AND device_id = ? AND status = 'pending'`
    )
    .run(status, result === null ? null : JSON.stringify(result), now, commandId, hostId);

  if (updated.changes === 0) {
    return jsonError(c, 404, "COMMAND_NOT_FOUND", "命令不存在或已处理。", undefined);
  }

  auditLog({
    actor: `agent:${hostId}`,
    action: "command_result",
    deviceId: hostId,
    controllerAddress: host.controllerAddress,
    detail: { commandId, status },
  });

  return c.json({ ok: true, command: { id: commandId, status, updatedAt: now } });
});

app.get("/api/audit", (c) => {
  const limit = parseLimit(c.req.query("limit"), 50);
  const logs = db
    .query(
      `SELECT id, actor, action, device_id AS deviceId, controller_address AS controllerAddress, detail, created_at AS createdAt
       FROM audit_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    actor: string;
    action: string;
    deviceId: string | null;
    controllerAddress: string | null;
    detail: string | null;
    createdAt: number;
  }>;

  return c.json({
    ok: true,
    logs: logs.map((item) => ({
      ...item,
      detail: item.detail ? JSON.parse(item.detail) : null,
    })),
  });
});

console.log(`[cloud] listening on http://127.0.0.1:${PORT}`);
console.log(`[cloud] sqlite: ${DB_PATH}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
