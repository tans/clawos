/** @jsxImportSource hono/jsx */

const capabilityItems = [
  {
    title: "私有部署",
    description: "数据留在本地，网络边界自己掌控，适合对数据安全有要求的团队。",
  },
  {
    title: "技能接入",
    description: "把内部流程、工具和数据接入 AI，让它能真正做事而不是聊天。",
  },
  {
    title: "权限与审计",
    description: "谁能用、做了什么，全部留记录，满足合规和内部审计需求。",
  },
] as const;

const scenarioItems = [
  {
    title: "销售与客户运营",
    description: "把跟进客户、整理信息等重复工作交给 AI，减少人为遗漏和等待。",
  },
  {
    title: "制造与交付协同",
    description: "让询价、交付追踪等流程自动流转，多方协同更顺畅。",
  },
  {
    title: "内部支持与知识库",
    description: "把制度、文档和流程固化到系统中，有问题直接问 AI，不用搜索。",
  },
] as const;

const governanceItems = [
  {
    title: "本地优先",
    description: "数据留在自己服务器，网络完全可控，没有数据外泄风险。",
  },
  {
    title: "权限与审计",
    description: "谁能操作什么、做了什么，全部记录，审计和追责有据可查。",
  },
  {
    title: "上线支持",
    description: "协助确认接入方式、运行监控和后期维护，减少上线后的问题。",
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
      answer: `不是。${brandName} 让 AI 执行真实业务操作，不只是聊天。能接入内部系统、代替人工操作、留下操作记录。`,
    },
    {
      question: "必须上云才能使用吗？",
      answer: "不需要。支持本地部署，数据留在自己服务器，网络完全可控。",
    },
    {
      question: "部署评估一般会确认什么？",
      answer: "确认从哪里切入业务、怎么接入现有系统、用什么部署方式，以及后续维护方式。",
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
              {brandName} 让 AI 进入真实业务流程：本地部署、数据可控、权限清晰、运行稳定。虾壳主机预装开箱即用。
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
            企业 AI，难的不是选模型，而是用起来
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            模型哪家都能用，真正决定能否长期运行的，是部署方式、权限管理和持续维护能力。
          </p>
        </div>

        <div class="mt-16 grid gap-10 md:grid-cols-3">
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">不只是聊天</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              AI 能代替你执行操作，不只是回答问题。
            </p>
          </article>
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">不止于模型</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              接入内部系统、数据和工具链，比选哪个模型更重要。
            </p>
          </article>
          <article class="p-6 bg-white rounded-xl shadow-soft border border-gray-100 transition-all duration-300 hover:shadow-medium hover:-translate-y-1 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h3 class="text-xl font-semibold text-secondary-900">可持续运行</h3>
            <p class="mt-3 text-sm leading-8 text-secondary-600">
              从上线第一天就考虑长期运维，不是演示完就结束。
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
              软件 + 硬件一体化交付，到手即用，缩短从选型到上线的周期。
            </p>
          </div>

          <div class="space-y-8">
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">01</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">{brandName}</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
                企业 AI 操作系统，负责任务执行、权限管理和系统接入。
              </p>
            </article>
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">02</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">Skill 接入</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
                把内部工具、数据和流程接入 AI，形成可复用的执行能力。
              </p>
            </article>
            <article class="border-t border-gray-100 pt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">03</p>
              <h3 class="mt-2 text-xl font-semibold text-secondary-900">虾壳主机</h3>
              <p class="mt-3 text-sm leading-8 text-secondary-600">
                预装 {brandName} 的硬件主机，本地运行，到手即用。
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
            部署前需要确认的事
          </h2>
          <p class="text-base leading-8 text-secondary-600">
            企业级系统不是先上线再说。先把数据怎么管、谁能用什么确认清楚，后续运行才不出问题。
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
            从部署评估开始，确认怎么用起来
          </h2>
          <p class="max-w-3xl text-base leading-8 text-secondary-600">
            适合已经明确要把 AI 引入业务流程，但需要确认部署方式和接入方案的团队。
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
