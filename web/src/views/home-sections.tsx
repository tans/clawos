/** @jsxImportSource hono/jsx */

const capabilityItems = [
  {
    title: "部署边界",
    description: "明确系统运行位置、访问方式和组织边界，避免从一开始就失控。",
  },
  {
    title: "执行编排",
    description: "围绕岗位、角色和任务链路组织 AI 执行能力，而不是停留在单点工具。",
  },
  {
    title: "治理机制",
    description: "覆盖权限、审计、数据边界和运行监控，适合长期运行与逐步扩展。",
  },
] as const;

const scenarioItems = [
  {
    title: "销售与客户运营",
    description: "把线索跟进、客户复盘和信息整理纳入持续运行的执行链路，减少人为断点。",
  },
  {
    title: "制造与交付协同",
    description: "围绕询价、BOM、交付追踪等流程组织多角色协作，提升交付确定性。",
  },
  {
    title: "内部支持与知识执行",
    description: "让知识库、制度和内部流程进入权限边界内的执行系统，而不是停留在搜索入口。",
  },
] as const;

const governanceItems = [
  {
    title: "本地优先部署",
    description: "适合对数据边界、访问路径和组织内网有明确要求的团队。",
  },
  {
    title: "权限与审计",
    description: "围绕角色权限、操作留痕和审计追踪建立基础治理能力。",
  },
  {
    title: "上线准备",
    description: "在部署前确认系统接入、运行监控和后续维护方式，减少上线后的返工。",
  },
] as const;

const faqItems = [
  {
    question: "ClawOS 是聊天机器人平台吗？",
    answer: "不是。ClawOS 面向企业执行场景，核心不是对话入口，而是部署、接入、治理与持续运行。",
  },
  {
    question: "必须上云才能使用吗？",
    answer: "不需要。支持本地优先和混合部署，适合对数据驻留和网络边界有要求的团队。",
  },
  {
    question: "部署评估一般会确认什么？",
    answer: "通常会先确认业务切入点、系统边界、部署方式和上线准备条件，再决定实施顺序。",
  },
] as const;

export function HomeHero() {
  return (
    <section class="marketing-section py-24 sm:py-32">
      <div class="marketing-section-inner">
        <div class="grid gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)] lg:gap-24">
          <div class="max-w-4xl space-y-8">
            <p class="marketing-kicker">Enterprise AI Deployment</p>
            <h1 class="marketing-h1 max-w-5xl">让企业部署可管理、可持续运行的 AI 执行系统</h1>
            <p class="marketing-lead max-w-3xl text-base leading-8 text-[color:var(--ink-soft)] sm:text-lg">
              ClawOS 面向真实业务流程，帮助企业完成 AI 能力的部署、接入、治理与长期运行。虾壳主机提供预装
              OpenClaw 的交付形态，缩短上线准备周期。
            </p>
            <div class="marketing-cta-row flex flex-wrap gap-3">
              <a class="marketing-primary-button" href="/contact">申请部署评估</a>
              <a class="marketing-secondary-button" href="/#architecture">了解部署方式</a>
            </div>
          </div>

          <aside class="space-y-7 text-sm text-[color:var(--ink-soft)] lg:pl-10 lg:pt-2">
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-strong)]">交付形态</p>
              <p>ClawOS + 虾壳主机</p>
            </div>
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-strong)]">部署方式</p>
              <p>本地优先、企业内网、混合环境</p>
            </div>
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-strong)]">适用团队</p>
              <p>运营、制造、交付、内部支持</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function CoreValueSection() {
  return (
    <section class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Why This Layer</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            企业部署 AI，真正难的不是模型，而是部署与治理
          </h2>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">
            模型可以替换，入口可以增加，但真正决定能否上线和长期运行的，是部署边界、系统接入、权限治理和持续维护能力。
          </p>
        </div>

        <div class="mt-16 grid gap-10 md:grid-cols-3">
          <article>
            <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">不是聊天入口</h3>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              重点不是模型数量，而是系统如何进入业务流程并承担执行任务。
            </p>
          </article>
          <article>
            <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">不是模型堆叠</h3>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              企业更关心部署方式、接入路径和运行边界，而不是短时间内叠加多少能力名词。
            </p>
          </article>
          <article>
            <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">不是一次性演示</h3>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              从第一天开始就要考虑上线准备、持续治理和长期维护，这才是企业系统的尺度。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <section id="architecture" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div class="max-w-2xl space-y-4">
            <p class="marketing-kicker">Deployment Model</p>
            <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
              ClawOS 与虾壳主机的交付方式
            </h2>
            <p class="text-base leading-8 text-[color:var(--ink-soft)]">
              ClawOS 提供企业 AI 执行系统的核心能力，虾壳主机作为预装 OpenClaw 的交付形态，帮助团队更快进入部署准备、系统接入和长期运行阶段。
            </p>
          </div>

          <div class="space-y-8">
            <article class="border-t border-[color:var(--line-soft)] pt-6">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-accent-strong)]">01</p>
              <h3 class="mt-2 text-xl font-semibold text-[color:var(--ink-strong)]">ClawOS</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
                负责任务执行、角色协作、系统接入和长期运行的核心系统层。
              </p>
            </article>
            <article class="border-t border-[color:var(--line-soft)] pt-6">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-accent-strong)]">02</p>
              <h3 class="mt-2 text-xl font-semibold text-[color:var(--ink-strong)]">Skill 接入</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
                将业务动作、内部流程和执行能力组织成可复用的系统能力，而不是散落的工具集合。
              </p>
            </article>
            <article class="border-t border-[color:var(--line-soft)] pt-6">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-accent-strong)]">03</p>
              <h3 class="mt-2 text-xl font-semibold text-[color:var(--ink-strong)]">虾壳主机</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
                预装 OpenClaw 的本地优先交付形态，适合需要更快上线、更清晰边界和更稳定运行环境的团队。
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CapabilityMatrixSection() {
  return (
    <section id="capabilities" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Core Capability</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            核心能力
          </h2>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">聚焦企业团队真正会关心的三类能力。</p>
        </div>

        <div class="mt-14 grid gap-12 md:grid-cols-3">
          {capabilityItems.map((item) => (
            <article>
              <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScenarioSection() {
  return (
    <section id="solutions" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Use Cases</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            适用场景
          </h2>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">
            适合那些已经明确知道 AI 需要进入哪个业务流程、但仍在评估如何部署和管理的团队。
          </p>
        </div>

        <div class="mt-16 grid gap-12 md:grid-cols-3">
          {scenarioItems.map((item) => (
            <article>
              <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GovernanceSection() {
  return (
    <section id="governance" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Governance</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            部署前需要先确认的治理要点
          </h2>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">
            企业系统不是先上再说。部署前先把运行边界、接入方式和治理要求确认清楚，后续上线才不会反复返工。
          </p>
        </div>

        <div class="mt-16 grid gap-12 md:grid-cols-3">
          {governanceItems.map((item) => (
            <article>
              <h3 class="text-xl font-semibold text-[color:var(--ink-strong)]">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4">
          <p class="marketing-kicker">Questions</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            常见问题
          </h2>
        </div>

        <div class="mt-14 space-y-6">
          {faqItems.map((item) => (
            <details class="border-t border-[color:var(--line-soft)] pt-5">
              <summary class="cursor-pointer text-base font-semibold text-[color:var(--ink-strong)]">{item.question}</summary>
              <p class="mt-3 max-w-4xl text-sm leading-8 text-[color:var(--ink-soft)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HardwareSection() {
  return null;
}

export function PocPathSection() {
  return null;
}

export function FinalCtaSection() {
  return (
    <section class="marketing-section py-24 sm:py-32">
      <div class="marketing-section-inner border-t border-[color:var(--line-soft)] pt-12 sm:pt-16">
        <div class="max-w-4xl space-y-6">
          <p class="marketing-kicker">Next Step</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-[color:var(--ink-strong)] sm:text-4xl">
            从部署评估开始，先确认系统边界、上线方式与业务切入点
          </h2>
          <p class="max-w-3xl text-base leading-8 text-[color:var(--ink-soft)]">
            适合已经明确要把 AI 引入业务流程、但还需要确认部署方式、接入范围和交付安排的团队。
          </p>
          <div class="marketing-cta-row flex flex-wrap gap-3">
            <a class="marketing-primary-button" href="/contact">申请部署评估</a>
            <a class="marketing-secondary-button" href="/downloads">下载试用</a>
          </div>
        </div>
      </div>
    </section>
  );
}
