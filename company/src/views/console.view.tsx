/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx";
import type { AgentEventRow, CompanyRow, ConsoleUser, HostCommandRow, HostInsightRow, HostRow } from "../types";
import { renderPageShell } from "./layout.view";

const HOST_OFFLINE_THRESHOLD_MS = 30 * 1000;

type RegisterPayload = {
  mobile?: string;
};

type CompanyFormPayload = {
  name?: string;
  slug?: string;
  mode?: string;
};

function formatDateTime(ms: number | null): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

function displayHostStatus(status: string, lastSeenMs: number | null): "online" | "degraded" | "offline" {
  if (!lastSeenMs || Date.now() - lastSeenMs > HOST_OFFLINE_THRESHOLD_MS) return "offline";
  return status === "degraded" ? "degraded" : "online";
}

function statusBadge(state: "online" | "degraded" | "offline"): JSX.Element {
  if (state === "online") return <span class="badge badge-success">online</span>;
  if (state === "degraded") return <span class="badge badge-warning">degraded</span>;
  return <span class="badge">offline</span>;
}

function eventSeverityBadge(severity: string): JSX.Element {
  if (severity === "error") return <span class="badge badge-error">error</span>;
  if (severity === "warning") return <span class="badge badge-warning">warning</span>;
  return <span class="badge badge-info">info</span>;
}

export function renderConsoleMessagePage(user: ConsoleUser, message: string): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <p>{message}</p>
        <p>
          <a class="link link-primary" href="/console">
            返回列表
          </a>
        </p>
      </div>
    </div>,
    user
  );
}

export function renderLoginPage(error = "", mobile = ""): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-xl max-w-md mx-auto mt-10">
      <div class="card-body">
        <h1 class="card-title text-2xl">云端控制台登录</h1>
        <p class="text-base-content/70">使用手机号和密码登录。</p>
        {error ? (
          <div class="alert alert-error mb-3">
            <span>{error}</span>
          </div>
        ) : null}
        <form method="post" action="/console/login">
          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">手机号</span>
            </div>
            <input class="input input-bordered w-full" name="mobile" value={mobile} placeholder="例如 +8613812345678" />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label">
              <span class="label-text">密码</span>
            </div>
            <input class="input input-bordered w-full" type="password" name="password" placeholder="请输入密码" />
          </label>
          <button class="btn btn-primary w-full mt-4" type="submit">
            登录
          </button>
        </form>
        <p class="text-sm text-base-content/70 mt-2">
          没有账号？
          <a class="link link-primary" href="/console/register">
            去注册
          </a>
        </p>
      </div>
    </div>
  );
}

export function renderRegisterPage(error = "", payload?: RegisterPayload): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-xl max-w-lg mx-auto mt-10">
      <div class="card-body">
        <h1 class="card-title text-2xl">注册控制台账号</h1>
        <p class="text-base-content/70">注册后使用手机号 + 密码登录。当前版本无需填写钱包地址。</p>
        {error ? (
          <div class="alert alert-error mb-3">
            <span>{error}</span>
          </div>
        ) : null}
        <form method="post" action="/console/register">
          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">手机号</span>
            </div>
            <input class="input input-bordered w-full" name="mobile" value={payload?.mobile || ""} />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label">
              <span class="label-text">密码</span>
            </div>
            <input class="input input-bordered w-full" type="password" name="password" placeholder="至少 8 位" />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label">
              <span class="label-text">确认密码</span>
            </div>
            <input class="input input-bordered w-full" type="password" name="confirmPassword" placeholder="再次输入密码" />
          </label>
          <button class="btn btn-primary w-full mt-4" type="submit">
            注册
          </button>
        </form>
        <p class="text-sm text-base-content/70 mt-2">
          <a class="link link-primary" href="/console/login">
            返回登录
          </a>
        </p>
      </div>
    </div>
  );
}

function modeBadge(mode: string): JSX.Element {
  return mode === "unmanned" ? <span class="badge badge-primary">无人公司</span> : <span class="badge">标准公司</span>;
}

export function renderHostListPage(user: ConsoleUser, message: string, hosts: HostRow[], companies: CompanyRow[]): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 class="card-title">主机列表</h1>
          <div class="flex flex-wrap gap-2">
            <a class="btn btn-sm btn-outline" href="/console/companies">
              公司空间
            </a>
            <a class="btn btn-sm btn-outline" href="/console/insights">
              Agent 洞察
            </a>
          </div>
        </div>
        <p class="text-base-content/70">只展示 controllerAddress 与你账号绑定标识一致的主机。</p>
        <div class="stats stats-vertical sm:stats-horizontal border border-base-300 bg-base-200/40">
          <div class="stat">
            <div class="stat-title">公司数</div>
            <div class="stat-value text-primary text-2xl">{companies.length}</div>
          </div>
          <div class="stat">
            <div class="stat-title">主机数</div>
            <div class="stat-value text-secondary text-2xl">{hosts.length}</div>
          </div>
          <div class="stat">
            <div class="stat-title">无人公司</div>
            <div class="stat-value text-accent text-2xl">{companies.filter((item) => item.mode === "unmanned").length}</div>
          </div>
        </div>
        {companies.length ? (
          <div class="mt-2 flex flex-wrap gap-2">
            {companies.slice(0, 4).map((company) => (
              <div class="badge badge-outline gap-2">
                {company.name}
                {modeBadge(company.mode)}
              </div>
            ))}
          </div>
        ) : (
          <div class="alert mt-2">
            <span>你还没有公司空间。建议先创建“无人公司”后再接入设备。</span>
            <a class="btn btn-xs btn-primary ml-auto" href="/console/companies/new">
              创建无人公司
            </a>
          </div>
        )}

        {message ? (
          <div class="alert alert-success mb-3">
            <span>{message}</span>
          </div>
        ) : null}

        {hosts.length ? (
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>主机</th>
                  <th>状态</th>
                  <th>版本</th>
                  <th>WSL</th>
                  <th>Gateway</th>
                  <th>最后心跳</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((host) => {
                  const state = displayHostStatus(host.status, host.lastSeenMs);
                  return (
                    <tr>
                      <td>
                        <a class="link link-primary" href={`/console/hosts/${encodeURIComponent(host.hostId)}`}>
                          {host.name}
                        </a>
                        <div class="text-xs opacity-70 font-mono">{host.hostId}</div>
                      </td>
                      <td>{statusBadge(state)}</td>
                      <td>{host.clawosVersion || "-"}</td>
                      <td>{host.wslReady ? "是" : "否"}</td>
                      <td>{host.gatewayReady ? "是" : "否"}</td>
                      <td>{formatDateTime(host.lastSeenMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="text-base-content/70">
            当前没有可控制主机。请在设备端将 <span class="font-mono">controllerAddress</span> 设置为你的绑定标识：
            {user.walletAddress}
          </p>
        )}
      </div>
    </div>,
    user
  );
}

export function renderCompaniesPage(user: ConsoleUser, companies: CompanyRow[], message = ""): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <div class="flex items-center justify-between gap-2">
          <h1 class="card-title">公司空间</h1>
          <div class="flex gap-2">
            <a class="btn btn-sm btn-outline" href="/console">
              返回控制台
            </a>
            <a class="btn btn-sm btn-primary" href="/console/companies/new">
              创建公司
            </a>
          </div>
        </div>
        {message ? (
          <div class="alert alert-success">
            <span>{message}</span>
          </div>
        ) : null}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {companies.length ? (
            companies.map((company) => (
              <article class="card bg-base-200 border border-base-300">
                <div class="card-body">
                  <div class="flex items-center justify-between">
                    <h2 class="card-title text-lg">{company.name}</h2>
                    {modeBadge(company.mode)}
                  </div>
                  <p class="text-sm opacity-70">slug: <span class="font-mono">{company.slug}</span></p>
                  <p class="text-sm opacity-70">创建时间：{formatDateTime(company.createdAt)}</p>
                </div>
              </article>
            ))
          ) : (
            <div class="alert">
              <span>暂无公司空间，请先创建一个无人公司。</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    user,
    "公司空间"
  );
}

export function renderCreateCompanyPage(user: ConsoleUser, error = "", payload?: CompanyFormPayload): string {
  const mode = payload?.mode === "standard" ? "standard" : "unmanned";
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm max-w-2xl">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h1 class="card-title">创建公司</h1>
          <a class="btn btn-sm btn-outline" href="/console/companies">
            返回公司空间
          </a>
        </div>
        <p class="text-base-content/70">推荐先创建“无人公司”：适用于纯自动化运行，动作由控制台统一审计。</p>
        {error ? (
          <div class="alert alert-error">
            <span>{error}</span>
          </div>
        ) : null}
        <form method="post" action="/console/companies/new">
          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">公司名称</span>
            </div>
            <input class="input input-bordered" name="name" value={payload?.name || ""} placeholder="例如：龙虾无人运营公司" />
          </label>
          <label class="form-control w-full mt-2">
            <div class="label">
              <span class="label-text">公司标识（slug）</span>
            </div>
            <input class="input input-bordered font-mono" name="slug" value={payload?.slug || ""} placeholder="lobster-autopilot" />
          </label>
          <div class="form-control mt-3">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" class="radio radio-primary" name="mode" value="unmanned" checked={mode === "unmanned"} />
              <span class="label-text">无人公司（推荐）</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" class="radio" name="mode" value="standard" checked={mode === "standard"} />
              <span class="label-text">标准公司</span>
            </label>
          </div>
          <button class="btn btn-primary mt-4" type="submit">
            创建公司
          </button>
        </form>
      </div>
    </div>,
    user,
    "创建公司"
  );
}

export function renderHostDetailPage(
  user: ConsoleUser,
  host: HostRow,
  message: string,
  commands: HostCommandRow[],
  events: AgentEventRow[]
): string {
  const state = displayHostStatus(host.status, host.lastSeenMs);
  const hostIdPath = encodeURIComponent(host.hostId);

  return renderPageShell(
    <>
      <div class="mb-3 flex items-center justify-between gap-2">
        <a class="link link-primary" href="/console">
          返回主机列表
        </a>
        <a class="btn btn-xs btn-outline" href="/console/insights">
          查看洞察
        </a>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-sm mb-4">
        <div class="card-body">
          <h1 class="card-title">{host.name}</h1>
          <p class="font-mono text-sm">hostId: {host.hostId}</p>
          <p>
            状态：{statusBadge(state)}，最后心跳：{formatDateTime(host.lastSeenMs)}
          </p>
          <p>
            版本：{host.clawosVersion || "-"}，WSL：{host.wslReady ? "就绪" : "未就绪"}，Gateway：
            {host.gatewayReady ? "就绪" : "未就绪"}
          </p>
          {message ? (
            <div class="alert alert-success mb-3">
              <span>{message}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <article class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-lg">WSL 命令执行</h2>
            <form method="post" action={`/console/hosts/${hostIdPath}/tasks/wsl-exec`}>
              <label class="form-control w-full">
                <div class="label">
                  <span class="label-text">工作目录</span>
                </div>
                <input class="input input-bordered w-full" name="cwd" value="/data/openclaw" />
              </label>
              <label class="form-control w-full mt-2">
                <div class="label">
                  <span class="label-text">命令</span>
                </div>
                <textarea class="textarea textarea-bordered w-full" name="command" placeholder="例如 pnpm run build"></textarea>
              </label>
              <button class="btn btn-primary mt-3" type="submit">
                下发 wsl.exec
              </button>
            </form>
          </div>
        </article>

        <article class="card bg-base-100 border border-base-300 shadow-sm">
          <div class="card-body">
            <h2 class="card-title text-lg">ClawOS 控制</h2>
            <form method="post" action={`/console/hosts/${hostIdPath}/tasks/gateway-status`}>
              <button class="btn btn-outline w-full" type="submit">
                查询 Gateway 状态
              </button>
            </form>
            <form class="mt-2" method="post" action={`/console/hosts/${hostIdPath}/tasks/gateway-restart`}>
              <button class="btn btn-warning w-full" type="submit">
                重启 Gateway
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-sm">
        <div class="card-body">
          <h2 class="card-title text-lg">最近任务</h2>
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>参数</th>
                  <th>去重键</th>
                  <th>过期时间</th>
                  <th>结果</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {commands.length ? (
                  commands.map((row) => (
                    <tr>
                      <td class="font-mono text-xs">{row.id}</td>
                      <td class="font-mono text-xs">{row.kind}</td>
                      <td>{row.status}</td>
                      <td>
                        <pre class="whitespace-pre-wrap break-all text-xs">{row.payload || "{}"}</pre>
                      </td>
                      <td class="font-mono text-[10px] max-w-xs break-all">{row.dedupeKey || "-"}</td>
                      <td>{formatDateTime(row.expiresAt)}</td>
                      <td>
                        <pre class="whitespace-pre-wrap break-all text-xs">{row.result || "-"}</pre>
                      </td>
                      <td>{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={8} class="text-base-content/60">
                      暂无任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 border border-base-300 shadow-sm mt-4">
        <div class="card-body">
          <h2 class="card-title text-lg">最近监听事件</h2>
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>级别</th>
                  <th>事件</th>
                  <th>摘要</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? (
                  events.map((event) => (
                    <tr>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>{eventSeverityBadge(event.severity)}</td>
                      <td class="font-mono text-xs">{event.eventType}</td>
                      <td>{event.title || "-"}</td>
                      <td>
                        <pre class="whitespace-pre-wrap break-all text-xs">{event.payload || "-"}</pre>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={5} class="text-base-content/60">
                      暂无监听事件
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>,
    user
  );
}

export function renderInsightsPage(user: ConsoleUser, rows: HostInsightRow[], hours: number): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 class="card-title">Agent 洞察</h1>
          <a class="btn btn-sm btn-outline" href="/console">
            返回主机列表
          </a>
        </div>
        <p class="text-base-content/70">统计窗口：最近 {hours} 小时。用于快速识别高风险主机与异常趋势。</p>
        <div class="overflow-x-auto mt-3">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>主机</th>
                <th>状态</th>
                <th>事件总数</th>
                <th>Warning</th>
                <th>Error</th>
                <th>最近事件</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => {
                  const state = displayHostStatus(row.status, row.lastSeenMs);
                  return (
                    <tr>
                      <td>
                        <a class="link link-primary" href={`/console/hosts/${encodeURIComponent(row.hostId)}`}>
                          {row.hostName}
                        </a>
                        <div class="font-mono text-xs opacity-70">{row.hostId}</div>
                      </td>
                      <td>{statusBadge(state)}</td>
                      <td>{row.totalEvents}</td>
                      <td>{row.warningEvents}</td>
                      <td>{row.errorEvents}</td>
                      <td>{formatDateTime(row.lastEventAt)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colspan={6} class="text-base-content/60">
                    暂无洞察数据，请等待 Agent 上报心跳或事件。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    user,
    "Agent 洞察"
  );
}
