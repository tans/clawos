/** @jsxImportSource hono/jsx */

const capabilityItems = [
  "Agent OS 调度与记忆",
  "多 Agent 协作编排",
  "Skill 生态与任务复用",
  "本地优先与混合部署",
  "可观测与成本治理",
  "权限、审计与数据控制",
] as const;

const scenarioItems = [
  {
    title: "销售与客户运营",
    description: "围绕线索、跟进与复盘形成持续在线的 AI 协作流程，减少人工断点。",
  },
  {
    title: "制造与交付协同",
    description: "让询价、BOM、交付追踪等流程由多角色 AI 共同推进，提升可交付确定性。",
  },
  {
    title: "内部支持与知识执行",
    description: "将企业知识与制度接入执行链路，让 AI 员工在权限边界内长期稳定运行。",
  },
] as const;

const pocPath = [
  "选择一个高频、可量化的业务场景",
  "映射角色、任务链路与系统接入边界",
  "完成本地优先部署与权限治理配置",
  "按周复盘效果并扩展到下一业务单元",
] as const;

const faqItems = [
  {
    question: "ClawOS 是聊天机器人平台吗？",
    answer: "不是。ClawOS 面向企业执行场景，核心是任务、记忆、协作与持续在线交付。",
  },
  {
    question: "必须上云才能使用吗？",
    answer: "不需要。支持本地优先和混合部署，可在企业边界内保持更高可控性。",
  },
  {
    question: "PoC 一般怎么开始？",
    answer: "建议先选一个明确场景，在 2-4 周内跑通可量化指标，再决定扩展节奏。",
  },
] as const;

export function HomeHero() {
  return (
    <section class="marketing-section py-12 sm:py-16">
      <div class="marketing-section-inner marketing-hero lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div class="space-y-6">
          <p class="marketing-kicker">Enterprise AI Operating System</p>
          <h1 class="marketing-h1">让 AI 员工进入真实业务流程</h1>
          <p class="marketing-lead max-w-3xl text-base leading-8 text-[color:var(--ink-soft)]">
            ClawOS 是企业智能员工操作系统。通过技能生态与虾壳主机，把 AI 从对话工具变成可交付、可持续在线、可本地优先运行的执行系统。
          </p>
          <div class="marketing-cta-row flex flex-wrap gap-3">
            <a class="marketing-primary-button" href="/contact">预约 PoC</a>
            <a class="marketing-secondary-button" href="/downloads">下载试用</a>
          </div>
        </div>
        <aside class="marketing-card marketing-proof-panel p-6 sm:p-8">
          <ul class="space-y-3 text-sm font-medium text-[color:var(--ink-normal)]">
            <li>本地优先</li>
            <li>预装交付</li>
            <li>持续在线</li>
            <li>多场景落地</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function CoreValueSection() {
  return (
    <section class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">
          不是再加一个 AI 工具，而是给企业配一套 AI 员工系统
        </h2>
        <div class="marketing-grid-4 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">从问答到执行</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">把 AI 从被动回答升级为可持续执行的业务系统。</p></article>
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">从单点助手到多角色协作</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">围绕任务拆解、记忆和协作链路组织多个 AI 角色。</p></article>
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">从 Demo 到长期在线</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">支持持续运行、交付落地和稳定迭代，而不是一次性演示。</p></article>
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">从云端依赖到本地优先可控</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">在企业边界内保持更高的部署确定性和数据控制力。</p></article>
        </div>
      </div>
    </section>
  );
}

export function CapabilityMatrixSection() {
  return (
    <section id="capabilities" class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">
          企业真正落地 AI 员工，需要的不只是模型
        </h2>
        <div class="marketing-grid-3 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilityItems.map((item) => <article class="marketing-card p-5"><h3 class="text-lg font-semibold">{item}</h3></article>)}
        </div>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <section id="architecture" class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">ClawOS 的三层交付结构</h2>
        <div class="marketing-grid-3 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">ClawOS</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">角色系统、任务系统、记忆与执行中枢。</p></article>
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">Skill Ecosystem</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">把业务能力沉淀为可复用的场景模块和任务能力。</p></article>
          <article class="marketing-card p-5"><h3 class="text-lg font-semibold">虾壳主机</h3><p class="mt-2 text-sm text-[color:var(--ink-soft)]">预装 OpenClaw 的本地优先执行节点，适合长期在线交付。</p></article>
        </div>
      </div>
    </section>
  );
}

export function ScenarioSection() {
  return (
    <section id="solutions" class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">从业务场景出发设计 AI 员工</h2>
        <div class="mt-6 grid gap-4 md:grid-cols-3">
          {scenarioItems.map((item) => (
            <article class="marketing-card p-5">
              <h3 class="text-lg font-semibold">{item.title}</h3>
              <p class="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HardwareSection() {
  return (
    <section class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <article class="marketing-card p-6 sm:p-8">
          <p class="marketing-kicker">虾壳主机</p>
          <h2 class="marketing-section-title mt-2 text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">预装交付，让 AI 员工长期在线</h2>
          <p class="mt-3 max-w-4xl text-sm leading-8 text-[color:var(--ink-soft)]">
            虾壳主机提供开箱可用的本地优先执行环境，帮助企业更快完成部署、权限接入与运行监控，降低从 PoC 到规模化落地的环境不确定性。
          </p>
        </article>
      </div>
    </section>
  );
}

export function GovernanceSection() {
  return (
    <section id="governance" class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">企业部署 AI，首先要可控</h2>
        <div class="marketing-badge-row mt-6 flex flex-wrap gap-3 text-sm text-[color:var(--ink-normal)]">
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">本地优先</span>
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">传输与存储加密</span>
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">权限隔离</span>
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">审计追踪</span>
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">数据驻留策略</span>
          <span class="rounded-full border border-[color:var(--line-soft)] bg-white px-4 py-2">内部系统接入可控</span>
        </div>
      </div>
    </section>
  );
}

export function PocPathSection() {
  return (
    <section class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">PoC 推进路径</h2>
        <ol class="mt-6 grid gap-4 md:grid-cols-2">
          {pocPath.map((step, index) => (
            <li class="marketing-card p-5">
              <p class="text-xs font-semibold tracking-wide text-[color:var(--brand-accent-strong)]">{`STEP ${index + 1}`}</p>
              <p class="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section class="marketing-section py-8 sm:py-12">
      <div class="marketing-section-inner">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">常见问题</h2>
        <div class="mt-6 space-y-3">
          {faqItems.map((item) => (
            <details class="marketing-card p-5">
              <summary class="cursor-pointer text-sm font-semibold text-[color:var(--ink-strong)]">{item.question}</summary>
              <p class="mt-2 text-sm leading-7 text-[color:var(--ink-soft)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section class="marketing-section py-12 sm:py-16">
      <div class="marketing-section-inner marketing-card marketing-final-cta p-6 sm:p-8">
        <h2 class="marketing-section-title text-2xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-3xl">先把一个场景跑通，再决定怎么扩展</h2>
        <div class="marketing-cta-row mt-5 flex flex-wrap gap-3">
          <a class="marketing-primary-button" href="/contact">预约 PoC</a>
          <a class="marketing-secondary-button" href="/contact">联系方案专家</a>
        </div>
      </div>
    </section>
  );
}
