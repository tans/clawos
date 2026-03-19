import type { ConsoleUser, HostCommandRow, HostRow } from "../types";
import { escapeHtmlContent, renderPageShell } from "./layout.view";

const HOST_OFFLINE_THRESHOLD_MS = 30 * 1000;

type RegisterPayload = {
  mobile?: string;
  walletAddress?: string;
};

function formatDateTime(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function displayHostStatus(status: string, lastSeenMs: number | null): "online" | "degraded" | "offline" {
  if (!lastSeenMs || Date.now() - lastSeenMs > HOST_OFFLINE_THRESHOLD_MS) return "offline";
  return status === "degraded" ? "degraded" : "online";
}

function statusBadge(state: "online" | "degraded" | "offline"): string {
  if (state === "online") return `<span class="badge badge-success">online</span>`;
  if (state === "degraded") return `<span class="badge badge-warning">degraded</span>`;
  return `<span class="badge">offline</span>`;
}

export function renderConsoleMessagePage(user: ConsoleUser, message: string): string {
  return renderPageShell(
    `<div class="card bg-base-100 border border-base-300 shadow-sm"><div class="card-body"><p>${escapeHtmlContent(message)}</p><p><a class="link link-primary" href="/console">返回列表</a></p></div></div>`,
    user
  );
}

export function renderLoginPage(error = "", mobile = ""): string {
  const errorHtml = error
    ? `<div class="alert alert-error mb-3"><span>${escapeHtmlContent(error)}</span></div>`
    : "";
  return renderPageShell(`<div class="card bg-base-100 border border-base-300 shadow-xl max-w-md mx-auto mt-10">
      <div class="card-body">
        <h1 class="card-title text-2xl">云端控制台登录</h1>
        <p class="text-base-content/70">使用手机号和密码登录。</p>
        ${errorHtml}
        <form method="post" action="/console/login">
          <label class="form-control w-full">
            <div class="label"><span class="label-text">手机号</span></div>
            <input class="input input-bordered w-full" name="mobile" value="${escapeHtmlContent(mobile)}" placeholder="例如 +8613812345678" />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label"><span class="label-text">密码</span></div>
            <input class="input input-bordered w-full" type="password" name="password" placeholder="请输入密码" />
          </label>
          <button class="btn btn-primary w-full mt-4" type="submit">登录</button>
        </form>
        <p class="text-sm text-base-content/70 mt-2">没有账号？<a class="link link-primary" href="/console/register">去注册</a></p>
      </div>
    </div>`);
}

export function renderRegisterPage(error = "", payload?: RegisterPayload): string {
  const errorHtml = error
    ? `<div class="alert alert-error mb-3"><span>${escapeHtmlContent(error)}</span></div>`
    : "";

  return renderPageShell(`<div class="card bg-base-100 border border-base-300 shadow-xl max-w-lg mx-auto mt-10">
      <div class="card-body">
        <h1 class="card-title text-2xl">注册控制台账号</h1>
        <p class="text-base-content/70">注册后使用手机号 + 密码登录，钱包地址用于匹配你能控制的主机。</p>
        ${errorHtml}
        <form method="post" action="/console/register">
          <label class="form-control w-full">
            <div class="label"><span class="label-text">手机号</span></div>
            <input class="input input-bordered w-full" name="mobile" value="${escapeHtmlContent(payload?.mobile || "")}" />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label"><span class="label-text">钱包地址（控制人地址）</span></div>
            <input class="input input-bordered w-full" name="walletAddress" value="${escapeHtmlContent(payload?.walletAddress || "")}" placeholder="0x..." />
          </label>
          <label class="form-control w-full mt-2"><div class="label"><span class="label-text">密码</span></div><input class="input input-bordered w-full" type="password" name="password" placeholder="至少 8 位" /></label>
          <label class="form-control w-full mt-2"><div class="label"><span class="label-text">确认密码</span></div><input class="input input-bordered w-full" type="password" name="confirmPassword" placeholder="再次输入密码" /></label>
          <button class="btn btn-primary w-full mt-4" type="submit">注册</button>
        </form>
        <p class="text-sm text-base-content/70 mt-2"><a class="link link-primary" href="/console/login">返回登录</a></p>
      </div>
    </div>`);
}

export function renderHostListPage(user: ConsoleUser, message: string, hosts: HostRow[]): string {
  const notice = message ? `<div class="alert alert-success mb-3"><span>${escapeHtmlContent(message)}</span></div>` : "";

  const bodyRows = hosts
    .map((host) => {
      const state = displayHostStatus(host.status, host.lastSeenMs);
      return `<tr>
        <td><a class="link link-primary" href="/console/hosts/${encodeURIComponent(host.hostId)}">${escapeHtmlContent(host.name)}</a><div class="text-xs opacity-70 font-mono">${escapeHtmlContent(host.hostId)}</div></td>
        <td>${statusBadge(state)}</td>
        <td>${escapeHtmlContent(host.clawosVersion || "-")}</td>
        <td>${host.wslReady ? "是" : "否"}</td>
        <td>${host.gatewayReady ? "是" : "否"}</td>
        <td>${escapeHtmlContent(formatDateTime(host.lastSeenMs))}</td>
      </tr>`;
    })
    .join("");

  const table = hosts.length
    ? `<div class="overflow-x-auto"><table class="table table-zebra"><thead><tr><th>主机</th><th>状态</th><th>版本</th><th>WSL</th><th>Gateway</th><th>最后心跳</th></tr></thead><tbody>${bodyRows}</tbody></table></div>`
    : `<p class="text-base-content/70">当前没有可控制主机。请在设备端将 <span class="font-mono">controllerAddress</span> 设置为你的钱包地址：${escapeHtmlContent(user.walletAddress)}</p>`;

  return renderPageShell(
    `<div class="card bg-base-100 border border-base-300 shadow-sm"><div class="card-body"><h1 class="card-title">主机列表</h1><p class="text-base-content/70">只展示 controllerAddress 与你账号钱包地址一致的主机。</p>${notice}${table}</div></div>`,
    user
  );
}

export function renderHostDetailPage(user: ConsoleUser, host: HostRow, message: string, commands: HostCommandRow[]): string {
  const state = displayHostStatus(host.status, host.lastSeenMs);
  const notice = message ? `<div class="alert alert-success mb-3"><span>${escapeHtmlContent(message)}</span></div>` : "";

  const logs = commands.length
    ? commands
        .map((row) => {
          const payload = row.payload ? escapeHtmlContent(row.payload) : "{}";
          const result = row.result ? escapeHtmlContent(row.result) : "-";
          return `<tr>
            <td class="font-mono text-xs">${escapeHtmlContent(row.id)}</td>
            <td class="font-mono text-xs">${escapeHtmlContent(row.kind)}</td>
            <td>${escapeHtmlContent(row.status)}</td>
            <td><pre class="whitespace-pre-wrap break-all text-xs">${payload}</pre></td>
            <td><pre class="whitespace-pre-wrap break-all text-xs">${result}</pre></td>
            <td>${escapeHtmlContent(formatDateTime(row.createdAt))}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="text-base-content/60">暂无任务</td></tr>`;

  return renderPageShell(
    `<p class="mb-3"><a class="link link-primary" href="/console">返回主机列表</a></p>
    <div class="card bg-base-100 border border-base-300 shadow-sm mb-4"><div class="card-body">
      <h1 class="card-title">${escapeHtmlContent(host.name)}</h1>
      <p class="font-mono text-sm">hostId: ${escapeHtmlContent(host.hostId)}</p>
      <p>状态：${statusBadge(state)}，最后心跳：${escapeHtmlContent(formatDateTime(host.lastSeenMs))}</p>
      <p>版本：${escapeHtmlContent(host.clawosVersion || "-")}，WSL：${host.wslReady ? "就绪" : "未就绪"}，Gateway：${host.gatewayReady ? "就绪" : "未就绪"}</p>
      ${notice}
    </div></div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <article class="card bg-base-100 border border-base-300 shadow-sm"><div class="card-body">
        <h2 class="card-title text-lg">WSL 命令执行</h2>
        <form method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/wsl-exec">
          <label class="form-control w-full"><div class="label"><span class="label-text">工作目录</span></div><input class="input input-bordered w-full" name="cwd" value="/data/openclaw" /></label>
          <label class="form-control w-full mt-2"><div class="label"><span class="label-text">命令</span></div><textarea class="textarea textarea-bordered w-full" name="command" placeholder="例如 pnpm run build"></textarea></label>
          <button class="btn btn-primary mt-3" type="submit">下发 wsl.exec</button>
        </form>
      </div></article>

      <article class="card bg-base-100 border border-base-300 shadow-sm"><div class="card-body">
        <h2 class="card-title text-lg">ClawOS 控制</h2>
        <form method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/gateway-status">
          <button class="btn btn-outline w-full" type="submit">查询 Gateway 状态</button>
        </form>
        <form class="mt-2" method="post" action="/console/hosts/${encodeURIComponent(host.hostId)}/tasks/gateway-restart">
          <button class="btn btn-warning w-full" type="submit">重启 Gateway</button>
        </form>
      </div></article>
    </div>

    <div class="card bg-base-100 border border-base-300 shadow-sm"><div class="card-body">
      <h2 class="card-title text-lg">最近任务</h2>
      <div class="overflow-x-auto"><table class="table table-zebra"><thead><tr><th>ID</th><th>类型</th><th>状态</th><th>参数</th><th>结果</th><th>时间</th></tr></thead><tbody>${logs}</tbody></table></div>
    </div></div>`,
    user
  );
}
