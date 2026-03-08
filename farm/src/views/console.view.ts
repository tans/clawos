import type { ConsoleUser, HostCommandRow, HostRow } from "../types";

const APP_TITLE = "龙虾养殖场";
const HOST_OFFLINE_THRESHOLD_MS = 30 * 1000;

type RegisterPayload = {
  mobile?: string;
  walletAddress?: string;
};

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
  if (!lastSeenMs || Date.now() - lastSeenMs > HOST_OFFLINE_THRESHOLD_MS) {
    return "offline";
  }
  return status === "degraded" ? "degraded" : "online";
}

function pageShell(body: string, user?: ConsoleUser): string {
  const nav = user
    ? `<div class="topbar"><span>账号：${escapeHtml(user.mobile)}（钱包：${escapeHtml(user.walletAddress)}）</span><a href="/console/logout">退出</a></div>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(APP_TITLE)}</title>
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

export function renderConsoleMessagePage(user: ConsoleUser, message: string): string {
  return pageShell(
    `<section class="card"><p>${escapeHtml(message)}</p><p><a href="/console">返回列表</a></p></section>`,
    user
  );
}

export function renderHomePage(): string {
  return pageShell(`<section class="card" style="max-width:880px;margin:40px auto;">
      <h1 class="title" style="font-size:34px;">openclaw aka 龙虾</h1>
      <h2 style="margin:0 0 14px; font-size:24px; color:#0f766e;">养虾场：在线 openclaw 集群管理平台</h2>
      <p class="muted" style="font-size:16px; line-height:1.8;">每个人和每个企业都可以建立自己的养虾场。</p>
      <p class="muted" style="font-size:16px; line-height:1.8;">方便批量管理集群，编排任务，更新和修复 openclaw，查看 token 使用量。</p>
      <p style="font-size:18px; font-weight:700; margin-top:20px;">让你的龙虾健康成长。</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <a href="/console/login" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">进入控制台</a>
        <a href="/console/register" style="display:inline-block;background:#ffffff;color:#0f766e;border:1px solid #99f6e4;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600;">注册账号</a>
      </div>
    </section>`);
}

export function renderLoginPage(error = "", mobile = ""): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : "";
  return pageShell(`<section class="card" style="max-width:480px;margin:40px auto;">
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
    </section>`);
}

export function renderRegisterPage(error = "", payload?: RegisterPayload): string {
  const errorHtml = error ? `<div class="error">${escapeHtml(error)}</div>` : "";
  return pageShell(`<section class="card" style="max-width:520px;margin:40px auto;">
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
    </section>`);
}

export function renderHostListPage(user: ConsoleUser, message: string, hosts: HostRow[]): string {
  const notice = message ? `<div class="ok">${escapeHtml(message)}</div>` : "";
  const bodyRows = hosts
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

  const table = hosts.length
    ? `<table>
      <thead><tr><th>主机</th><th>状态</th><th>版本</th><th>WSL</th><th>Gateway</th><th>最后心跳</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`
    : `<p class="muted">当前没有可控制主机。请在设备端将 <span class="mono">controllerAddress</span> 设置为你的钱包地址：${escapeHtml(user.walletAddress)}</p>`;

  return pageShell(
    `<section class="card">
      <h1 class="title">主机列表</h1>
      <p class="muted">只展示 controllerAddress 与你账号钱包地址一致的主机。</p>
      ${notice}
      ${table}
    </section>`,
    user
  );
}

export function renderHostDetailPage(user: ConsoleUser, host: HostRow, message: string, commands: HostCommandRow[]): string {
  const state = displayHostStatus(host.status, host.lastSeenMs);
  const badgeClass = state === "online" ? "st-online" : state === "degraded" ? "st-degraded" : "st-offline";
  const notice = message ? `<div class="ok">${escapeHtml(message)}</div>` : "";

  const logs = commands.length
    ? commands
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
