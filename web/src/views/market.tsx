/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

const demandFilters = ["销售", "客服", "运营", "知识库", "私有部署"] as const;
const sectionIds = {
  tasks: "tasks",
  roles: "roles",
  proof: "proof",
  rules: "rules",
} as const;
const topAnchors = [
  { label: "热门需求", href: `#${sectionIds.tasks}` },
  { label: "角色入口", href: `#${sectionIds.roles}` },
  { label: "交付能力", href: `#${sectionIds.proof}` },
  { label: "流程与规则", href: `#${sectionIds.rules}` },
] as const;
const marketStats = [
  { label: "活跃需求方向", value: "24" },
  { label: "标准化任务类型", value: "11" },
  { label: "本周新增需求", value: "08" },
] as const;

const featuredTasks = [
  {
    title: "销售知识库搭建与问答助手",
    scenario: "销售支持",
    scope: "知识接入 + Agent 编排",
    mode: "按阶段协作",
    phase: "需求评估中",
    period: "2-3 周",
  },
  {
    title: "客服 SOP 分流与质检工作流",
    scenario: "客户服务",
    scope: "流程自动化",
    mode: "持续协作",
    phase: "供给匹配中",
    period: "3-4 周",
  },
  {
    title: "虾壳主机私有部署支持",
    scenario: "部署上线",
    scope: "OpenClaw 预装交付",
    mode: "联合交付",
    phase: "准备启动",
    period: "1-2 周",
  },
] as const;
const roleEntries = [
  {
    title: "企业方",
    description: "提交业务需求，判断哪些任务适合进入可持续协作。",
    actionLabel: "提交企业需求",
    actionHref: "#enterprise-entry",
  },
  {
    title: "服务方",
    description: "展示交付能力、标准化经验与持续服务方式。",
    actionLabel: "申请成为服务方",
    actionHref: "#provider-entry",
  },
  {
    title: "生态伙伴",
    description: "参与部署、实施、硬件与联合交付支持。",
    actionLabel: "申请生态合作",
    actionHref: "#partner-entry",
  },
] as const;
const capabilityCards = [
  { title: "工作流设计与 Agent 编排", description: "把复杂业务动作拆成可协作的执行链路。" },
  { title: "企业知识结构化", description: "把知识库、SOP 与问答能力组织成可维护资产。" },
  { title: "私有部署与运行支持", description: "结合 OpenClaw 与虾壳主机形成更稳定的本地优先交付。" },
] as const;
const caseCards = [
  { title: "销售知识库升级", scenario: "销售支持", outcome: "常见问答整理时间缩短，交付材料复用率提升。" },
  { title: "客服流程自动化", scenario: "客户服务", outcome: "重复分流动作下降，人工介入点更清晰。" },
  { title: "内部运营内容流水线", scenario: "运营执行", outcome: "固定模板任务进入持续协作方式。" },
] as const;
const flowSteps = ["识别任务方向并明确范围", "结构化需求与交付边界", "匹配执行能力与协作方式", "进入交付、验收与复盘"] as const;
const rulePoints = ["结构化范围", "可验证交付", "可复用结果", "合作边界清晰"] as const;

export function renderMarketPage(): string {
  return renderMarketingShell({
    title: "任务市场",
    description: "面向企业需求与交付能力匹配的 Agent 任务市场。",
    currentPath: "/market",
    children: (
      <div class="marketing-hero market-page">
        <section class="marketing-section market-section">
          <div class="marketing-section-inner">
            <div class="marketing-cta-row">
              {topAnchors.map((item) => (
                <a class="marketing-secondary-button" href={item.href}>{item.label}</a>
              ))}
            </div>
          </div>
        </section>
        <section class="marketing-section market-section">
          <div class="marketing-section-inner space-y-6">
            <p class="marketing-kicker">Agent 协作市场</p>
            <h1 class="marketing-h1">把企业需求转成可协作、可交付、可复用的 Agent 任务</h1>
            <p class="marketing-lead">优先匹配可标准化、可追踪的任务，帮助企业和服务方建立长期协作。</p>
            <div class="marketing-cta-row">
              <a class="marketing-primary-button" href={roleEntries[0].actionHref}>{roleEntries[0].actionLabel}</a>
              <a class="marketing-secondary-button" href={roleEntries[1].actionHref}>{roleEntries[1].actionLabel}</a>
            </div>
            <div class="marketing-cta-row">
              {marketStats.map((item) => (
                <div class="marketing-card p-4 min-w-36">
                  <p class="text-3xl font-semibold text-[color:var(--ink-strong)]">{item.value}</p>
                  <p class="text-sm text-[color:var(--ink-soft)]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section class="marketing-section market-section" id="tasks">
          <div class="marketing-section-inner space-y-6">
            <h2 class="marketing-h2">热门需求方向</h2>
            <div class="flex flex-wrap gap-2">
              {demandFilters.map((filter) => (
                <span class="marketing-secondary-button">{filter}</span>
              ))}
            </div>
            <ul class="market-task-grid">
              {featuredTasks.map((task) => (
                <li>
                  <strong>{task.title}</strong>
                  <div>{task.scenario} · {task.scope}</div>
                  <div>{task.mode} · {task.phase} · {task.period}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section class="marketing-section market-section" id={sectionIds.roles}>
          <div class="marketing-section-inner space-y-6">
            <h2 class="marketing-h2">角色入口</h2>
            <ul class="market-participant-grid list-none p-0">
              {roleEntries.map((role, index) => (
                <li id={index === 0 ? "enterprise-entry" : index === 1 ? "provider-entry" : "partner-entry"} class="marketing-card p-5">
                  <h3 class="text-lg font-semibold text-[color:var(--ink-strong)]">{role.title}</h3>
                  <p>{role.description}</p>
                  <a class="marketing-secondary-button mt-3 inline-flex" href={role.actionHref}>{role.actionLabel}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section class="marketing-section market-section" id={sectionIds.proof}>
          <div class="marketing-section-inner space-y-6">
            <h2 class="marketing-h2">交付能力</h2>
            <ul class="market-participant-grid list-none p-0">
              {capabilityCards.map((card) => (
                <li class="marketing-card p-5">
                  <h3 class="text-lg font-semibold text-[color:var(--ink-strong)]">{card.title}</h3>
                  <p>{card.description}</p>
                </li>
              ))}
            </ul>
            <ul class="market-participant-grid list-none p-0">
              {caseCards.map((card) => (
                <li class="marketing-card p-5">
                  <p class="marketing-kicker">{card.scenario}</p>
                  <h3 class="text-lg font-semibold text-[color:var(--ink-strong)]">{card.title}</h3>
                  <p>{card.outcome}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section class="marketing-section market-section" id={sectionIds.rules}>
          <div class="marketing-section-inner space-y-6">
            <h2 class="marketing-h2">流程与规则</h2>
            <div class="market-flow-panel">
              <ol class="market-flow-steps">
                {flowSteps.map((step) => <li>{step}</li>)}
              </ol>
            </div>
            <ul class="market-participant-grid">
              {rulePoints.map((rule) => <li>{rule}</li>)}
            </ul>
            <div class="marketing-cta-row">
              {roleEntries.map((role) => (
                <a class="marketing-primary-button" href={role.actionHref}>{role.actionLabel}</a>
              ))}
            </div>
          </div>
        </section>
      </div>
    ),
  });
}
