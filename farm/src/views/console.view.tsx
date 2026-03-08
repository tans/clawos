/** @jsxImportSource hono/jsx */
import type { JSX } from "hono/jsx";
import type { ConsoleUser, HostCommandRow, HostRow } from "../types";
import { renderPageShell } from "./layout.view";

const HOST_OFFLINE_THRESHOLD_MS = 30 * 1000;

type RegisterPayload = {
  mobile?: string;
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

export function renderHostListPage(user: ConsoleUser, message: string, hosts: HostRow[]): string {
  return renderPageShell(
    <div class="card bg-base-100 border border-base-300 shadow-sm">
      <div class="card-body">
        <h1 class="card-title">主机列表</h1>
        <p class="text-base-content/70">只展示 controllerAddress 与你账号绑定标识一致的主机。</p>

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

export function renderHostDetailPage(user: ConsoleUser, host: HostRow, message: string, commands: HostCommandRow[]): string {
  const state = displayHostStatus(host.status, host.lastSeenMs);
  const hostIdPath = encodeURIComponent(host.hostId);

  return renderPageShell(
    <>
      <p class="mb-3">
        <a class="link link-primary" href="/console">
          返回主机列表
        </a>
      </p>

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
                      <td>
                        <pre class="whitespace-pre-wrap break-all text-xs">{row.result || "-"}</pre>
                      </td>
                      <td>{formatDateTime(row.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={6} class="text-base-content/60">
                      暂无任务
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
