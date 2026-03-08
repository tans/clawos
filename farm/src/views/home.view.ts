import { renderPageShell } from "./layout.view";

export function renderHomePage(): string {
  return renderPageShell(`<section class="hero bg-base-100 rounded-box shadow-xl border border-base-300">
      <div class="hero-content py-14">
        <div class="max-w-3xl">
          <div class="badge badge-primary badge-lg mb-4">openclaw aka 龙虾</div>
          <h1 class="text-4xl font-bold leading-tight">养虾场 · 在线 openclaw 集群管理平台</h1>
          <p class="py-4 text-base-content/80">每个人和每个企业都可以建立自己的养虾场。</p>
          <p class="text-base-content/80">方便批量管理集群，编排任务，更新和修复 openclaw，查看 token 使用量。</p>
          <p class="mt-4 font-semibold text-lg">让你的龙虾健康成长</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <a class="btn btn-primary" href="/console/login">进入控制台</a>
            <a class="btn btn-outline" href="/console/register">注册账号</a>
          </div>
        </div>
      </div>
    </section>`);
}
