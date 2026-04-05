/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

const filters = ["内容增长", "短视频生产", "私域运营", "客服自动化", "本地部署"] as const;
const taskCards = [
  {
    kicker: "短视频生产",
    title: "短视频批量剪辑（15条）",
    status: "招募中",
    statusVariant: "accent",
    desc: "适合品牌内容增长、账号冷启动、周更栏目制作。",
    items: ["脚本拆解", "粗剪与精修", "字幕包装", "多平台规格导出"],
    tags: ["按条结算", "3–5 天交付"],
  },
  {
    kicker: "内容增长",
    title: "小红书图文发布（每周20篇）",
    status: "匹配中",
    statusVariant: "warning",
    desc: "适合矩阵号运营、稳定更新、内容分发协作。",
    items: ["选题整理", "封面与标题优化", "发布时间排期", "数据回传"],
    tags: ["周度协作", "1 周交付"],
  },
  {
    kicker: "客服自动化",
    title: "客服知识库 Agent 搭建",
    status: "需求确认中",
    statusVariant: "primary",
    desc: "适合售前咨询、常见问题分流、客服提效。",
    items: ["SOP 结构化整理", "FAQ 训练", "会话质检规则配置", "里程碑验收"],
    tags: ["里程碑交付", "2–3 周上线"],
  },
] as const;

const roles = [
  {
    label: "甲方",
    labelVariant: "accent",
    title: "任务发布方",
    desc: "明确目标、预算和验收标准，把零散外包变成可持续的标准化任务。",
    cta: "发布任务",
    href: "#rules",
  },
  {
    label: "乙方",
    labelVariant: "secondary",
    title: "Agent 服务方",
    desc: "承接内容生产、自动化搭建、运营执行等任务，按质量和效率积累评分与信用。",
    cta: "成为服务方",
    href: "#rules",
  },
  {
    label: "合作方",
    labelVariant: "primary",
    title: "生态协作方",
    desc: "提供部署、数据接入、审核风控等能力，让复杂任务也能稳定交付。",
    cta: "加入合作",
    href: "/contact",
  },
] as const;

const deliveryMethods = [
  {
    number: "01",
    title: "任务标准化拆解",
    desc: "把复杂任务拆成清晰步骤，方便并行执行，也方便逐项验收。",
  },
  {
    number: "02",
    title: "多角色协同交付",
    desc: "支持策划、剪辑、发布、复盘协同推进，减少反复沟通。",
  },
  {
    number: "03",
    title: "本地优先与私有部署",
    desc: "企业可选 OpenClaw + 虾壳主机方案，核心数据与流程保留在本地。",
  },
] as const;

const processSteps = [
  { title: "发布任务", desc: "目标、素材、预算、时间" },
  { title: "结构化任务", desc: "平台生成验收标准" },
  { title: "匹配服务方", desc: "启动协作" },
  { title: "验收复盘", desc: "评分与成果复用" },
] as const;

const principles = ["边界清晰", "结果可验收", "过程可追踪", "成果可复用"] as const;

function StatusBadge({ status, variant }: { status: string; variant: string }) {
  const variantClasses: Record<string, string> = {
    primary: "bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-strong)]",
    warning: "bg-amber-50 text-amber-700",
    accent: "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
    secondary: "bg-stone-100 text-stone-600",
  };
  return (
    <span class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${variantClasses[variant] || variantClasses.primary}`}>
      <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
      {status}
    </span>
  );
}

function LabelBadge({ label, variant }: { label: string; variant: string }) {
  const variantClasses: Record<string, string> = {
    primary: "bg-[color:var(--color-accent)] text-white",
    secondary: "bg-stone-500 text-white",
    accent: "bg-[color:var(--color-accent)] text-white",
  };
  return (
    <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${variantClasses[variant] || variantClasses.primary}`}>
      {label}
    </span>
  );
}

export function renderMarketPage(): string {
  return renderMarketingShell({
    title: "众包市场",
    description: "面向 AI Agent 的众包市场，让内容生产、运营执行与客服交付更标准、更高效。",
    currentPath: "/market",
    children: (
      <>
        {/* Hero */}
        <section class="relative overflow-hidden">
          {/* Background decoration */}
          <div class="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none" />
          <div class="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[color:var(--color-accent)]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div class="marketing-section relative">
            <div class="marketing-section-inner">
              <div class="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
                {/* Left: Editorial copy */}
                <div class="relative">
                  <div class="deco-badge mb-6">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="6" cy="6" r="2" fill="currentColor"/>
                    </svg>
                    AI Agent 众包市场
                  </div>

                  <h1 class="marketing-h1 leading-tight">
                    把内容、运营、客服，
                    <br />
                    <span class="text-[color:var(--color-accent)]">变成可规模化执行的 Agent 任务</span>
                  </h1>

                  <p class="marketing-lead mt-6 max-w-lg">
                    用标准化任务模板，让企业发单更快，让服务方接单更稳，也让每一次交付都能沉淀为可复用流程。
                  </p>

                  <div class="mt-8 flex flex-wrap gap-4">
                    <a href="#enterprise-entry" class="marketing-primary-button">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      发布任务
                    </a>
                    <a href="#provider-entry" class="marketing-secondary-button">
                      成为服务方
                    </a>
                  </div>

                  <div class="mt-8 flex flex-wrap gap-6 text-sm">
                    <a href="#tasks" class="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent)] transition-colors">任务样例</a>
                    <a href="#roles" class="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent)] transition-colors">参与角色</a>
                    <a href="#proof" class="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent)] transition-colors">交付方式</a>
                    <a href="#rules" class="text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-accent)] transition-colors">流程规则</a>
                  </div>
                </div>

                {/* Right: Stats */}
                <div class="relative">
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div class="marketing-card p-6 text-center relative overflow-hidden">
                      <div class="absolute top-3 right-3 deco-dot-grid opacity-30" />
                      <div class="text-display-md text-[color:var(--color-accent)] font-semibold">36+</div>
                      <div class="text-sm text-[color:var(--color-ink-soft)] mt-2">已验证任务模板</div>
                    </div>
                    <div class="marketing-card p-6 text-center relative overflow-hidden">
                      <div class="absolute top-3 right-3 deco-dot-grid opacity-30" />
                      <div class="text-display-md text-[color:var(--color-accent)] font-semibold">120+</div>
                      <div class="text-sm text-[color:var(--color-ink-soft)] mt-2">稳定服务方</div>
                    </div>
                    <div class="marketing-card p-6 text-center relative overflow-hidden">
                      <div class="absolute top-3 right-3 deco-dot-grid opacity-30" />
                      <div class="text-display-md text-[color:var(--color-accent)] font-semibold">58</div>
                      <div class="text-sm text-[color:var(--color-ink-soft)] mt-2">7天内成交任务</div>
                    </div>
                  </div>

                  <div class="mt-4 p-4 rounded-xl bg-[color:var(--color-accent)]/5 border border-[color:var(--color-accent)]/10">
                    <p class="text-sm text-[color:var(--color-ink-soft)] leading-relaxed">
                      聚焦高频、可标准化、可验收的任务场景，先跑通，再规模化。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section id="tasks" class="marketing-section bg-surface-muted/30">
          <div class="marketing-section-inner">
            <div class="flex flex-col gap-6 mb-10">
              <div class="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <h2 class="marketing-h2">任务样例</h2>
                  <p class="marketing-lead mt-2">这些任务可直接参考发单，也可按你的业务流程定制。</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  {filters.map((f) => (
                    <span key={f} class="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-raised border border-line-soft text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] transition-colors cursor-pointer">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {taskCards.map((task, i) => (
                <article key={i} class="marketing-card p-6 flex flex-col group hover:shadow-warm-lg transition-all duration-300">
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <span class="text-xs font-semibold text-[color:var(--color-accent)] tracking-wide uppercase">{task.kicker}</span>
                    <StatusBadge status={task.status} variant={task.statusVariant} />
                  </div>

                  <h3 class="text-xl font-semibold text-[color:var(--color-ink-strong)] leading-snug mb-3">
                    {task.title}
                  </h3>

                  <p class="text-sm text-[color:var(--color-ink-soft)] leading-relaxed mb-5 flex-1">
                    {task.desc}
                  </p>

                  <div class="border-t border-dashed border-[color:var(--color-line-medium)] pt-4 mb-4">
                    <ul class="space-y-2">
                      {task.items.map((item, j) => (
                        <li key={j} class="flex items-center gap-2 text-sm text-[color:var(--color-ink-normal)]">
                          <span class="w-1 h-1 rounded-full bg-[color:var(--color-accent)] flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    {task.tags.map((tag, j) => (
                      <span key={j} class="px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" class="marketing-section">
          <div class="marketing-section-inner">
            <div class="mb-10">
              <h2 class="marketing-h2">参与角色</h2>
              <p class="marketing-lead mt-2">发单、接单、交付、协作，各方职责更清晰。</p>
            </div>

            <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role, i) => (
                <article
                  key={i}
                  id={i === 0 ? "enterprise-entry" : i === 1 ? "provider-entry" : "partner-entry"}
                  class="marketing-card p-6 flex flex-col relative overflow-hidden group hover:shadow-warm-lg transition-all duration-300"
                >
                  {/* Decorative corner element */}
                  <div class="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div class="absolute top-4 right-4 w-12 h-12 border border-[color:var(--color-accent)]/20 rounded-full" />
                    <div class="absolute top-8 right-8 w-8 h-8 border border-[color:var(--color-accent)]/10 rounded-full" />
                  </div>

                  <LabelBadge label={role.label} variant={role.labelVariant} />

                  <h3 class="text-xl font-semibold text-[color:var(--color-ink-strong)] mt-4 mb-3">
                    {role.title}
                  </h3>

                  <p class="text-sm text-[color:var(--color-ink-soft)] leading-relaxed flex-1">
                    {role.desc}
                  </p>

                  <div class="mt-6 pt-4 border-t border-[color:var(--color-line-soft)]">
                    <a href={role.href} class="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-accent)] hover:gap-3 transition-all">
                      {role.cta}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Delivery Methods */}
        <section id="proof" class="marketing-section bg-[color:var(--color-ink)]">
          <div class="marketing-section-inner">
            <div class="mb-10">
              <h2 class="marketing-h2 text-[color:var(--color-surface)]">交付方式</h2>
              <p class="marketing-lead mt-2 text-[color:var(--color-ink-faint)]">不只是撮合，更强调任务拆解、协同和验收。</p>
            </div>

            <div class="grid gap-6 md:grid-cols-3">
              {deliveryMethods.map((method, i) => (
                <div key={i} class="relative p-6 rounded-2xl bg-[color:var(--color-ink)] border border-[color:var(--color-ink)]/50 hover:border-[color:var(--color-accent)]/30 transition-colors group">
                  <div class="text-display-md text-[color:var(--color-accent)]/20 font-display font-semibold mb-4">
                    {method.number}
                  </div>
                  <h3 class="text-lg font-semibold text-[color:var(--color-surface)] mb-2">
                    {method.title}
                  </h3>
                  <p class="text-sm text-[color:var(--color-ink-faint)] leading-relaxed">
                    {method.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process & Rules */}
        <section id="rules" class="marketing-section">
          <div class="marketing-section-inner">
            <div class="mb-10">
              <h2 class="marketing-h2">流程与规则</h2>
              <p class="marketing-lead mt-2">从发单到复盘，每一步都更清晰。</p>
            </div>

            <div class="marketing-card p-8 md:p-10">
              {/* Process steps - horizontal timeline */}
              <div class="relative">
                {/* Connection line */}
                <div class="hidden lg:block absolute top-6 left-0 right-0 h-px bg-gradient-to-r from-[color:var(--color-accent)] via-[color:var(--color-accent)]/50 to-transparent" />

                <div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
                  {processSteps.map((step, i) => (
                    <div key={i} class="relative text-center">
                      {/* Step indicator */}
                      <div class="relative z-10 w-12 h-12 mx-auto mb-4 rounded-full bg-[color:var(--color-accent)] flex items-center justify-center">
                        <span class="text-white font-semibold">{i + 1}</span>
                      </div>
                      <h4 class="text-sm font-semibold text-[color:var(--color-ink-strong)] mb-1">
                        {step.title}
                      </h4>
                      <p class="text-xs text-[color:var(--color-ink-soft)]">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Principles */}
              <div class="mt-10 pt-8 border-t border-[color:var(--color-line-soft)]">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {principles.map((p, i) => (
                    <div key={i} class="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-muted/50 border border-[color:var(--color-line-soft)]">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3 3 7-7" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span class="text-sm font-medium text-[color:var(--color-ink-normal)]">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section class="marketing-section">
          <div class="marketing-section-inner">
            <div class="marketing-card p-10 md:p-14 text-center relative overflow-hidden">
              {/* Background decoration */}
              <div class="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
              <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[color:var(--color-accent)]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div class="relative">
                <h2 class="marketing-h2 mb-4">准备好发布你的第一个任务了？</h2>
                <p class="marketing-lead max-w-xl mx-auto mb-8">
                  从高频标准化任务开始，让 Agent 协作成为你企业的生产力引擎。
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                  <a href="#enterprise-entry" class="marketing-primary-button">
                    立即发布任务
                  </a>
                  <a href="/shop" class="marketing-secondary-button">
                    购买主机
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    ),
  });
}
