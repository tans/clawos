import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { auditLog, DB_PATH } from "../db";
import {
  clearExpiredConsoleSessions,
  createCompanyForOwner,
  createConsoleSession,
  createConsoleUser,
  createPendingCommand,
  deleteConsoleSession,
  existsCompanySlug,
  existsConsoleUserByMobile,
  getConsoleCredentialByMobile,
  getConsoleUserBySessionToken,
  getHostOwnedBy,
  listCompaniesByOwnerUserId,
  listCommandStatusSummaryByControllerAddress,
  listHostInsightsByControllerAddress,
  listHostRecentCommands,
  listHostRecentEvents,
  listHostsByControllerAddress,
  listTokenUsageSamples,
} from "../models/company.model";
import type { AppEnv, ConsoleUser } from "../types";
import { readFormText } from "../utils/request";
import { normalizeCompanyName, normalizeCompanySlug, normalizeHostId, normalizeMobile } from "../utils/validators";
import {
  renderCreateCompanyPage,
  renderConsoleMessagePage,
  renderCompaniesPage,
  renderHostDetailPage,
  renderInsightsPage,
  renderHostListPage,
  renderLoginPage,
  renderRegisterPage,
} from "../views/console.view";
import { renderHomePage } from "../views/home.view";

const CONSOLE_SESSION_COOKIE = "clawos_console_session";
const CONSOLE_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function readConsoleUserByCookie(c: Context<AppEnv>): Promise<ConsoleUser | null> {
  clearExpiredConsoleSessions();
  const token = getCookie(c, CONSOLE_SESSION_COOKIE) || "";
  if (!token) {
    return null;
  }
  return getConsoleUserBySessionToken(token);
}

function setConsoleSession(c: Context<AppEnv>, userId: number): void {
  const expiresAt = Date.now() + CONSOLE_SESSION_TTL_MS;
  const token = createConsoleSession(userId, expiresAt);

  setCookie(c, CONSOLE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(CONSOLE_SESSION_TTL_MS / 1000),
  });
}

function clearConsoleSession(c: Context<AppEnv>): void {
  const token = getCookie(c, CONSOLE_SESSION_COOKIE) || "";
  if (token) {
    deleteConsoleSession(token);
  }
  deleteCookie(c, CONSOLE_SESSION_COOKIE, { path: "/" });
}

async function requireConsoleAuth(c: Context<AppEnv>, next: Next) {
  const user = await readConsoleUserByCookie(c);
  if (!user) {
    return c.redirect("/console/login");
  }
  c.set("consoleUser", user);
  await next();
}

export function createConsoleController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.get("/", (c) => c.html(renderHomePage()));

  controller.get("/health", (c) => {
    clearExpiredConsoleSessions();
    return c.json({ ok: true, service: "clawos-team", dbPath: DB_PATH, ts: new Date().toISOString() });
  });

  controller.get("/console/login", async (c) => {
    const user = await readConsoleUserByCookie(c);
    if (user) {
      return c.redirect("/app");
    }
    return c.redirect("/app/login");
  });

  controller.post("/console/login", async (c) => {
    const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    const mobile = normalizeMobile(readFormText(body, "mobile"));
    const password = readFormText(body, "password");

    if (!mobile || !password) {
      return c.html(renderLoginPage("手机号和密码不能为空。", readFormText(body, "mobile")), 400);
    }

    const user = getConsoleCredentialByMobile(mobile);
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

  controller.get("/console/register", (c) => c.redirect("/app/register"));

  controller.post("/console/register", async (c) => {
    const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    const mobileRaw = readFormText(body, "mobile");
    const password = readFormText(body, "password");
    const confirmPassword = readFormText(body, "confirmPassword");

    const mobile = normalizeMobile(mobileRaw);

    if (!mobile) {
      return c.html(renderRegisterPage("手机号格式不合法。", { mobile: mobileRaw }), 400);
    }
    if (password.length < 8) {
      return c.html(renderRegisterPage("密码至少 8 位。", { mobile }), 400);
    }
    if (password !== confirmPassword) {
      return c.html(renderRegisterPage("两次密码不一致。", { mobile }), 400);
    }

    if (existsConsoleUserByMobile(mobile)) {
      return c.html(renderRegisterPage("手机号已被注册。", { mobile }), 409);
    }

    const passwordHash = await Bun.password.hash(password);
    const systemWallet = `mobile:${mobile}`;
    createConsoleUser(mobile, passwordHash, systemWallet);

    auditLog({ actor: `console:${mobile}`, action: "console_register", controllerAddress: systemWallet });
    return c.redirect("/console/login");
  });

  controller.get("/console/companies/new", (c) => {
    return c.redirect("/app/company/new");
  });

  controller.use("/console", requireConsoleAuth);
  controller.use("/console/*", requireConsoleAuth);

  controller.get("/console", (c) => {
    const user = c.get("consoleUser");
    const message = c.req.query("msg") || "";
    const companies = listCompaniesByOwnerUserId(user.id);
    return c.html(renderHostListPage(user, message, listHostsByControllerAddress(user.walletAddress), companies));
  });

  controller.get("/console/companies", (c) => {
    const user = c.get("consoleUser");
    const message = c.req.query("msg") || "";
    return c.html(renderCompaniesPage(user, listCompaniesByOwnerUserId(user.id), message));
  });

  controller.post("/console/companies/new", async (c) => {
    const user = c.get("consoleUser");
    const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    const name = normalizeCompanyName(readFormText(body, "name"));
    const slug = normalizeCompanySlug(readFormText(body, "slug"));
    const mode = readFormText(body, "mode") === "standard" ? "standard" : "unmanned";
    if (!name || !slug) {
      return c.html(renderCreateCompanyPage(user, "公司名称或标识不合法。", { name: readFormText(body, "name"), slug: readFormText(body, "slug"), mode }), 400);
    }
    if (existsCompanySlug(slug)) {
      return c.html(renderCreateCompanyPage(user, "公司标识已存在，请更换。", { name, slug, mode }), 409);
    }

    const companyId = createCompanyForOwner({ ownerUserId: user.id, name, slug, mode });
    auditLog({
      actor: `console:${user.mobile}`,
      action: "company_created",
      controllerAddress: user.walletAddress,
      detail: { companyId, slug, mode },
    });

    return c.redirect("/console/companies?msg=公司创建成功");
  });

  controller.get("/console/insights", (c) => {
    const user = c.get("consoleUser");
    const hours = Math.max(1, Math.min(24 * 14, Number(c.req.query("hours") || 24)));
    const now = Date.now();
    const rows = listHostInsightsByControllerAddress(user.walletAddress, now - hours * 60 * 60 * 1000, now);
    return c.html(renderInsightsPage(user, rows, hours));
  });

  controller.get("/console/kpi", (c) => {
    const user = c.get("consoleUser");
    const hosts = listHostsByControllerAddress(user.walletAddress);
    const summary = listCommandStatusSummaryByControllerAddress(user.walletAddress);
    const online = hosts.filter((h) => h.status === "online").length;
    return c.json({
      ok: true,
      hosts: { total: hosts.length, online, degraded: hosts.filter((h) => h.status === "degraded").length },
      commands: summary,
    });
  });

  controller.get("/console/logout", (c) => {
    clearConsoleSession(c);
    return c.redirect("/console/login");
  });

  controller.get("/console/hosts/:hostId", (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) {
      return c.html(renderConsoleMessagePage(user, "主机 ID 不合法。"), 400);
    }

    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) {
      return c.html(renderConsoleMessagePage(user, "未找到该主机，或你无权访问。"), 404);
    }

    const message = c.req.query("msg") || "";
    const commands = listHostRecentCommands(hostId, 40);
    const events = listHostRecentEvents(hostId, 20);
    return c.html(renderHostDetailPage(user, host, message, commands, events));
  });

  controller.get("/console/hosts/:hostId/token-usage", (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) {
      return c.json({ ok: false, error: "INVALID_HOST_ID" }, 400);
    }
    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) {
      return c.json({ ok: false, error: "FORBIDDEN" }, 403);
    }
    return c.json({ ok: true, hostId, samples: listTokenUsageSamples(hostId, 200) });
  });

  controller.post("/console/hosts/:hostId/tasks/wsl-exec", async (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) {
      return c.redirect("/console?msg=主机ID不合法");
    }

    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) {
      return c.redirect("/console?msg=你无权操作该主机");
    }

    const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    const command = readFormText(body, "command");
    const cwd = readFormText(body, "cwd") || "/data/openclaw";
    if (!command) {
      return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=命令不能为空`);
    }

    const commandId = createPendingCommand(hostId, "wsl.exec", {
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

  controller.post("/console/hosts/:hostId/tasks/gateway-status", (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) {
      return c.redirect("/console?msg=主机ID不合法");
    }

    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) {
      return c.redirect("/console?msg=你无权操作该主机");
    }

    const commandId = createPendingCommand(hostId, "clawos.gateway.status", {});
    auditLog({
      actor: `console:${user.mobile}`,
      action: "dispatch_gateway_status",
      deviceId: hostId,
      controllerAddress: user.walletAddress,
      detail: { commandId },
    });

    return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发任务 ${encodeURIComponent(commandId)}`);
  });

  controller.post("/console/hosts/:hostId/tasks/gateway-restart", (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) {
      return c.redirect("/console?msg=主机ID不合法");
    }

    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) {
      return c.redirect("/console?msg=你无权操作该主机");
    }

    const commandId = createPendingCommand(hostId, "clawos.gateway.action", { action: "restart" });
    auditLog({
      actor: `console:${user.mobile}`,
      action: "dispatch_gateway_restart",
      deviceId: hostId,
      controllerAddress: user.walletAddress,
      detail: { commandId },
    });

    return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发任务 ${encodeURIComponent(commandId)}`);
  });

  controller.post("/console/hosts/:hostId/tasks/config-get", (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) return c.redirect("/console?msg=主机ID不合法");
    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) return c.redirect("/console?msg=你无权操作该主机");
    const commandId = createPendingCommand(hostId, "clawos.gateway.config.get", {});
    auditLog({
      actor: `console:${user.mobile}`,
      action: "dispatch_gateway_config_get",
      deviceId: hostId,
      controllerAddress: user.walletAddress,
      detail: { commandId },
    });
    return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发配置读取任务 ${encodeURIComponent(commandId)}`);
  });

  controller.post("/console/hosts/:hostId/tasks/config-set", async (c) => {
    const user = c.get("consoleUser");
    const hostId = normalizeHostId(c.req.param("hostId"));
    if (!hostId) return c.redirect("/console?msg=主机ID不合法");
    const host = getHostOwnedBy(hostId, user.walletAddress);
    if (!host) return c.redirect("/console?msg=你无权操作该主机");
    const body = (await c.req.parseBody()) as Record<string, string | File | (string | File)[]>;
    const path = readFormText(body, "path") || "gateway";
    const patch = readFormText(body, "patch");
    if (!patch) return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=配置内容不能为空`);
    const commandId = createPendingCommand(hostId, "clawos.gateway.config.set", { path, patch });
    auditLog({
      actor: `console:${user.mobile}`,
      action: "dispatch_gateway_config_set",
      deviceId: hostId,
      controllerAddress: user.walletAddress,
      detail: { commandId, path, patchLength: patch.length },
    });
    return c.redirect(`/console/hosts/${encodeURIComponent(hostId)}?msg=已下发配置变更任务 ${encodeURIComponent(commandId)}`);
  });

  return controller;
}
