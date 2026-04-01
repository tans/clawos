/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

export function renderAgentMarketPage(): string {
  return renderMarketingShell({
    title: "Agent 协作",
    description: "面向企业的 Agent 协作市场导流页。",
    currentPath: "/agent-market",
    children: (
      <div class="marketing-hero market-page">
        <section class="marketing-section market-section">
          <div class="marketing-section-inner market-section-narrow space-y-6">
            <p class="marketing-kicker">Agent 协作市场</p>
            <h1 class="marketing-h1">任务市场已并入主站</h1>
            <p class="marketing-lead">现在可直接在主站访问任务大厅，不再依赖独立 agent-market 子项目。</p>
            <div class="marketing-hero-actions">
              <a class="marketing-primary-button" href="/market">进入任务市场</a>
              <a class="marketing-secondary-button" href="/contact">预约合作沟通</a>
            </div>
          </div>
        </section>
      </div>
    ),
  });
}
