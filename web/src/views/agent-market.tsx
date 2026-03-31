/** @jsxImportSource hono/jsx */

import { getEnv } from "../lib/env";
import { renderMarketingShell } from "./marketing-shell";

export function renderAgentMarketPage(): string {
  const { agentMarketPortalUrl } = getEnv();

  return renderMarketingShell({
    title: "Agent 协作",
    description: "面向企业的 Agent 协作市场介绍与合作沟通入口。",
    currentPath: "/agent-market",
    children: (
      <div class="marketing-hero market-page">
        <section class="marketing-section marketing-section-hero market-section">
          <div class="marketing-section-inner market-hero-grid">
            <div class="market-hero-copy">
              <p class="marketing-kicker">Agent 协作市场</p>
              <h1 class="marketing-h1">让企业任务更适合由 Agent 协作完成</h1>
              <p class="marketing-lead">
                先了解市场协作方式，再进入市场门户查看需求方向、参与角色与合作入口。
              </p>
              <div class="marketing-hero-actions">
                {agentMarketPortalUrl ? (
                  <a class="marketing-primary-button" href={agentMarketPortalUrl}>
                    进入市场门户
                  </a>
                ) : null}
                <a class="marketing-secondary-button" href="/contact">
                  预约合作沟通
                </a>
              </div>
            </div>
            <aside class="market-hero-panel">
              <p class="market-hero-panel-title">协作机制摘要</p>
              <ul class="market-hero-signal-list">
                <li class="market-hero-signal">
                  <span class="market-hero-signal-label">结构化需求</span>
                  <span class="market-hero-signal-text">在提交前先明确范围与交付边界。</span>
                </li>
                <li class="market-hero-signal">
                  <span class="market-hero-signal-label">能力匹配</span>
                  <span class="market-hero-signal-text">通过标准化信息减少沟通噪音。</span>
                </li>
                <li class="market-hero-signal">
                  <span class="market-hero-signal-label">交付复用</span>
                  <span class="market-hero-signal-text">让结果沉淀为可持续的协作资产。</span>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <h2 class="marketing-h2">不是增加一个工具，而是建立更清晰的交付方式</h2>
            <p>
              Agent 协作市场不是一个简单的功能入口，而是围绕需求拆解、能力匹配与交付保障形成的
              业务机制，帮助企业把任务交付从个人经验转为可复制流程。
            </p>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <h2 class="marketing-h2">优先面向这些可被标准化的任务</h2>
            <p>
              适合被规范、可持续复用的任务会被优先纳入协作范围，例如固定模板的内容生产、系统化
              的运营支持、可复用的业务分析与自动化执行等。
            </p>
            <ul class="market-task-grid">
              <li>固定模板的内容生产</li>
              <li>系统化的运营支持</li>
              <li>可复用的业务分析与自动化执行</li>
            </ul>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <h2 class="marketing-h2">让企业需求与交付能力更高效地匹配</h2>
            <p>
              在协作机制下，任务需求会提前被结构化表达，交付能力也有明确标注与验证，从而减少
              信息误差与沟通成本。
            </p>
            <div class="market-flow-panel">
              <ol class="market-flow-steps">
                <li>需求拆解与标准化描述</li>
                <li>匹配具备交付能力的参与方</li>
                <li>交付过程可追踪、可复盘</li>
              </ol>
            </div>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner market-section-narrow">
            <h2 class="marketing-h2">从需求到交付，尽量减少不必要的试错</h2>
            <p>
              我们关注的是可预测的交付流程，避免在正式合作中反复试错，用更明确的范围与反馈机制
              保障交付质量。
            </p>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <h2 class="marketing-h2">适合三类参与方提前进入</h2>
            <p>
              企业需求方可以提前进入建立交付预期，具备交付能力的服务方可以展示成熟方案，
              以及像虾壳主机这样的协作伙伴可以提供落地支持。
            </p>
            <ul class="market-participant-grid">
              <li>企业需求方：明确范围与交付预期</li>
              <li>服务方：展示成熟的交付方案</li>
              <li>协作伙伴：提供落地支持与资源</li>
            </ul>
          </div>
        </section>

        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <h2 class="marketing-h2">为什么现在开始建立这类协作关系</h2>
            <p>
              企业对 Agent 的需求正在加速，提前建立协作机制，可以让交付关系更稳定，
              也有助于形成可持续的能力网络。
            </p>
          </div>
        </section>

        <section class="marketing-section market-section market-final-cta">
          <div class="marketing-section-inner market-final-cta-inner">
            <h2 class="marketing-h2">如果你希望参与这类任务协作，可以先和我们沟通</h2>
            <p>
              我们会基于任务类型与交付能力进行评估，确定是否适合进入协作体系，
              并提供清晰的合作路径与后续安排。
            </p>
            <div class="marketing-hero-actions">
              <a class="marketing-secondary-button" href="/contact">预约合作沟通</a>
            </div>
          </div>
        </section>
      </div>
    ),
  });
}
