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

const productRouteItems = [
  {
    title: "Hardware",
    subtitle: "本地优先部署",
    description: "适合需要内网运行、设备可控和稳定执行环境的团队。",
    href: "/contact",
    cta: "申请硬件部署评估",
  },
  {
    title: "Enterprise",
    subtitle: "组织级治理与协作",
    description: "适合多角色协作、权限治理和长期运营要求明确的企业。",
    href: "/contact",
    cta: "查看企业落地路径",
  },
  {
    title: "Agent 众包市场",
    subtitle: "任务撮合与交付",
    description: "发布任务、匹配服务方、按里程碑验收，提升任务交付效率。",
    href: "/market",
    cta: "进入任务市场",
  },
  {
    title: "商城",
    subtitle: "硬件与模板即买即用",
    description: "集中购买硬件、模板和服务包，缩短从选型到上线的周期。",
    href: "/shop",
    cta: "进入产品商城",
  },
] as const;

function buildFaqItems(brandName: string) {
  return [
    {
      question: `${brandName} 是聊天机器人平台吗？`,
      answer: `不是。${brandName} 面向企业执行场景，核心不是对话入口，而是部署、接入、治理与持续运行。`,
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
}

export function HomeHero({ brandName }: { brandName: string }) {
  return (
    <section class="marketing-section py-16 sm:py-24 md:py-32 relative overflow-hidden">
      {/* 背景渐变 */}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 -z-10"></div>
      {/* 装饰元素 */}
      <div class="absolute top-10 right-10 w-40 h-40 sm:w-64 sm:h-64 bg-blue-100 rounded-full opacity-30 blur-3xl animate-pulse-slow"></div>
      <div class="absolute bottom-10 left-10 w-56 h-56 sm:w-80 sm:h-80 bg-indigo-100 rounded-full opacity-20 blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      
      <div class="marketing-section-inner relative z-10">
        <div class="grid gap-12 md:gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)] lg:gap-24">
          <div class="max-w-4xl space-y-6 sm:space-y-8 animate-slide-up">
            <p class="marketing-kicker text-primary-600">Enterprise AI Deployment</p>
            <h1 class="marketing-h1 max-w-5xl text-secondary-900 leading-tight text-3xl sm:text-4xl md:text-5xl">
              企业级 AI 智能体 操作系统
            </h1>
            <p class="marketing-lead max-w-3xl text-base leading-7 sm:leading-8 text-secondary-600 sm:text-lg">
              {brandName} 面向真实业务流程，帮助企业完成 AI 能力的部署、接入、治理与长期运行。虾壳主机提供预装
              OpenClaw 的交付形态，缩短上线准备周期。
            </p>
            <div class="marketing-cta-row flex flex-wrap gap-3 sm:gap-4">
              <a class="marketing-primary-button bg-primary-600 hover:bg-primary-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-1 w-full sm:w-auto" href="/contact">
                申请部署评估
              </a>
              <a class="marketing-secondary-button border border-primary-200 text-primary-700 hover:bg-primary-50 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-medium transition-all duration-300 w-full sm:w-auto" href="/#architecture">
                了解部署方式
              </a>
            </div>
          </div>

          <aside class="lg:pl-10 lg:pt-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div class="relative w-full max-w-md h-80 sm:h-96 bg-white rounded-[2rem] shadow-soft border border-gray-100 overflow-hidden">
              <div id="carousel" class="flex transition-transform duration-500 ease-in-out h-full">
                {/* 交付形态卡片 */}
                <div class="w-full flex-shrink-0 flex flex-col p-6">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">交付形态</p>
                  <h3 class="mt-2 text-xl font-semibold text-secondary-900">{`${brandName} + 虾壳主机`}</h3>
                  <div class="mt-4 flex-grow flex items-center justify-center">
                    <img src="/public/delivery-ui.webp" alt="交付形态" class="max-h-52 sm:max-h-64 rounded-2xl object-contain" />
                  </div>
                </div>
                {/* 部署方式卡片 */}
                <div class="w-full flex-shrink-0 flex flex-col p-6">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">部署方式</p>
                  <h3 class="mt-2 text-xl font-semibold text-secondary-900">本地优先、企业内网、混合环境</h3>
                  <div class="mt-4 flex-grow flex items-center justify-center">
                    <img src="/public/deployment-ui.webp" alt="部署方式" class="max-h-52 sm:max-h-64 rounded-2xl object-contain" />
                  </div>
                </div>
                {/* 适用团队卡片 */}
                <div class="w-full flex-shrink-0 flex flex-col p-6">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">适用团队</p>
                  <h3 class="mt-2 text-xl font-semibold text-secondary-900">运营、制造、交付、内部支持</h3>
                  <div class="mt-4 flex-grow flex items-center justify-center">
                    <img src="/public/team-ui.webp" alt="适用团队" class="max-h-52 sm:max-h-64 rounded-2xl object-contain" />
                  </div>
                </div>
              </div>
              {/* 轮播指示器 */}
              <div class="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
                <button class="w-2 h-2 rounded-full bg-primary-600 carousel-indicator" data-index="0"></button>
                <button class="w-2 h-2 rounded-full bg-gray-300 carousel-indicator" data-index="1"></button>
                <button class="w-2 h-2 rounded-full bg-gray-300 carousel-indicator" data-index="2"></button>
              </div>
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
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Why This Layer</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            企业部署 AI 真正难的不是模型！而是部署与治理
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            模型可以替换 入口可以增加 但真正决定能否上线和长期运行的 是部署边界 系统接入 权限治理和持续维护能力!
          </p>
        </div>

        <div class="mt-16 grid gap-10 md:grid-cols-3">
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">不是聊天入口</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              传统AI模型只能你问我答，如今ClawOS系统已经进入业务流程并承担执行任务。
            </p>
          </article>
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">不是模型堆叠</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              企业应该更关心部署方式、接入路径和运行边界，而不是短时间内叠加多少能力名词。
            </p>
          </article>
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">不是一次性演示</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              从第一天开始就要考虑上线准备、持续治理和长期维护，这才是企业系统的尺度。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

export function ArchitectureSection({ brandName }: { brandName: string }) {
  return (
    <section id="architecture" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <div class="max-w-2xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <p class="marketing-kicker text-primary-600">Deployment Model</p>
            <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
              {`${brandName} 与虾壳主机的交付方式`}
            </h2>
            <p class="text-base leading-8 text-secondary-600">
              {brandName} 提供企业 AI 执行系统的核心能力，虾壳主机作为预装 OpenClaw 的交付形态，帮助团队更快进入部署准备、系统接入和长期运行阶段。
            </p>
          </div>

          <div class="space-y-8">
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">01</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">{brandName}</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
                负责任务执行、角色协作、系统接入和长期运行的核心系统层。
              </p>
            </article>
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">02</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">Skill 接入</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
                将业务动作、内部流程和执行能力组织成可复用的系统能力，而不是散落的工具集合。
              </p>
            </article>
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">03</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">虾壳主机</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
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
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Core Capability</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            核心能力
          </h2>
          <p class="text-base leading-8 text-secondary-600">聚焦企业团队真正会关心的三类能力。</p>
        </div>

        <div class="mt-14 grid gap-12 md:grid-cols-3">
          {capabilityItems.map((item, index) => (
            <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <h3 class="text-xl font-semibold text-secondary-900">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">{item.description}</p>
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
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Use Cases</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            适用场景
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            适合那些已经明确知道 AI 需要进入哪个业务流程、但仍在评估如何部署和管理的团队。
          </p>
        </div>

        <div class="mt-16 grid gap-12 md:grid-cols-3">
          {scenarioItems.map((item, index) => (
            <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <h3 class="text-xl font-semibold text-secondary-900">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">{item.description}</p>
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
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Governance</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            部署前需要先确认的治理要点
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            企业系统不是先上再说。部署前先把运行边界、接入方式和治理要求确认清楚，后续上线才不会反复返工。
          </p>
        </div>

        <div class="mt-16 grid gap-12 md:grid-cols-3">
          {governanceItems.map((item, index) => (
            <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <h3 class="text-xl font-semibold text-secondary-900">{item.title}</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ brandName }: { brandName: string }) {
  const faqItems = buildFaqItems(brandName);
  return (
    <section class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Questions</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            常见问题
          </h2>
        </div>

        <div class="mt-14 space-y-6">
          {faqItems.map((item, index) => (
            <details class="border-t border-gray-100 pt-5 animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <summary class="cursor-pointer text-base font-semibold text-secondary-900 hover:text-primary-700 transition-colors duration-300">{item.question}</summary>
              <p class="mt-3 max-w-4xl text-sm leading-8 text-secondary-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HardwareSection() {
  return (
    <section class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="max-w-3xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Route First</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            先做产品分流，再做深度阅读
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            首页先回答“我该去哪里”，再进入具体页面看方案细节。下面四个入口对应不同的采购与落地路径。
          </p>
        </div>

        <div class="mt-14 grid gap-6 md:grid-cols-2">
          {productRouteItems.map((item, index) => (
            <article class="rounded-2xl border border-gray-100 bg-white p-6 shadow-soft sm:p-7 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${0.2 + index * 0.1}s` }}>
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary-600">{item.subtitle}</p>
              <h3 class="mt-3 text-2xl font-semibold text-secondary-900">{item.title}</h3>
              <p class="mt-4 text-sm leading-8 text-secondary-600">{item.description}</p>
              <div class="mt-6">
                <a class="inline-block border border-primary-200 text-primary-700 hover:bg-primary-50 px-6 py-3 rounded-lg font-medium transition-all duration-300" href={item.href}>
                  {item.cta}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PocPathSection() {
  return (
    <section class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="grid gap-10 lg:grid-cols-2">
          <article class="rounded-3xl border border-gray-100 bg-white p-8 shadow-soft sm:p-10 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <p class="marketing-kicker text-primary-600">Marketplace Highlight</p>
            <h3 class="text-2xl font-semibold text-secondary-900">Agent 众包市场</h3>
            <p class="mt-4 text-sm leading-8 text-secondary-600">
              支持企业发布任务、服务方接单、里程碑验收与交付评价。把“临时需求”沉淀为“可复用任务模板”。
            </p>
            <ul class="mt-6 list-disc space-y-2 pl-5 text-sm text-secondary-600">
              <li>任务模板：客服自动化、线索触达、内容生产、数据分析</li>
              <li>角色机制：需求方、服务方、审核协同</li>
              <li>交付方式：里程碑拆分 + 结果验收</li>
            </ul>
            <div class="mt-7">
              <a
                class="focus-outline-button px-6 py-3"
                href="/market"
              >
                发布任务或成为服务方
              </a>
            </div>
          </article>

          <article class="rounded-3xl border border-gray-100 bg-white p-8 shadow-soft sm:p-10 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <p class="marketing-kicker text-primary-600">Store Highlight</p>
            <h3 class="text-2xl font-semibold text-secondary-900">商城</h3>
            <p class="mt-4 text-sm leading-8 text-secondary-600">
              集中提供硬件、Agent 模板与服务包，帮助团队按预算快速完成选型与采购。
            </p>
            <ul class="mt-6 list-disc space-y-2 pl-5 text-sm text-secondary-600">
              <li>硬件套餐：按规模选择算力与交付配置</li>
              <li>数字商品：模板、行业包、工作流资产</li>
              <li>服务商品：部署实施、代运营与专家支持</li>
            </ul>
            <div class="mt-7">
              <a
                class="focus-outline-button px-6 py-3"
                href="/shop"
              >
                查看商城方案
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function OemSection() {
  return (
    <section id="oem" class="marketing-section py-24 sm:py-28">
      <div class="marketing-section-inner">
        <div class="rounded-3xl border border-gray-100 bg-white p-8 shadow-soft sm:p-10 transition-all duration-300 hover:shadow-medium animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div class="max-w-3xl space-y-4">
            <p class="marketing-kicker text-primary-600">OEM Program</p>
            <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
              OEM 白牌能力开放中
            </h2>
            <p class="text-base leading-8 text-secondary-600">
              支持品牌方以 OEM 方式快速进入交付：品牌替换、主机白牌采购、自有商城与众包市场能力将逐步开放。
            </p>
          </div>
          <div class="mt-8">
            <a
              class="focus-outline-button px-8 py-4"
              href="/oem"
            >
              查看 OEM 方案
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section class="marketing-section py-24 sm:py-32 relative overflow-hidden">
      {/* 背景渐变 */}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 -z-10"></div>
      
      <div class="marketing-section-inner border-t border-gray-100 pt-12 sm:pt-16 relative z-10">
        <div class="max-w-4xl space-y-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p class="marketing-kicker text-primary-600">Next Step</p>
          <h2 class="marketing-section-title text-3xl font-bold tracking-tight text-secondary-900 sm:text-4xl">
            从部署评估开始，先确认系统边界、上线方式与业务切入点
          </h2>
          <p class="max-w-3xl text-base leading-8 text-secondary-600">
            适合已经明确要把 AI 引入业务流程、但还需要确认部署方式、接入范围和交付安排的团队。
          </p>
          <div class="marketing-cta-row flex flex-wrap gap-4">
            <a class="focus-outline-button px-8 py-4" href="/contact">申请部署评估</a>
            <a class="focus-outline-button px-8 py-4" href="/downloads">下载试用</a>
          </div>
        </div>
      </div>
    </section>
  );
}
