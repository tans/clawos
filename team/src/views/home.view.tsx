/** @jsxImportSource hono/jsx */
import { renderPageShell } from "./layout.view";

export function renderHomePage(): string {
  return renderPageShell(
    <section class="hero bg-base-100 rounded-box shadow-xl border border-base-300">
      <div class="hero-content py-14">
        <div class="max-w-3xl">
          <div class="badge badge-primary badge-lg mb-4">openclaw aka 龙虾</div>
          <h1 class="text-4xl font-bold leading-tight">ClawOS Team · 在线 openclaw 集群管理平台</h1>
          <p class="py-4 text-base-content/80">以 Team 为核心租户模型，Client 自动接入 Team Gateway，统一管理所有设备动作。</p>
          <p class="text-base-content/80">支持批量下发命令、配置读写、重启网关、追踪执行结果与审计记录。</p>
          <p class="mt-4 font-semibold text-lg">让你的龙虾健康成长</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <a class="btn btn-primary" href="/console/login">
              进入控制台
            </a>
            <a class="btn btn-outline" href="/console/register">
              注册账号
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
