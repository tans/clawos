/** @jsxImportSource hono/jsx */

const capabilityItems = [
  {
    title: "私有部署",
    description: "数据留在本地，网络边界自己掌控，适合对数据安全有要求的团队。",
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  },
  {
    title: "技能接入",
    description: "把内部流程、工具和数据接入 AI，让它能真正做事而不是聊天。",
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  },
  {
    title: "权限与审计",
    description: "谁能用、做了什么，全部留记录，满足合规和内部审计需求。",
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
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
    subtitle: "硬件主机",
    description: "预装系统的交付硬件，本地运行，到手即用。",
    href: "/contact",
    cta: "了解硬件方案",
  },
  {
    title: "Enterprise",
    subtitle: "企业授权",
    description: "多角色协作、权限治理和长期运营要求明确的企业。",
    href: "/contact",
    cta: "查看企业落地路径",
  },
  {
    title: "Agent 市场",
    subtitle: "任务协作",
    description: "发布任务、匹配服务方、按里程碑验收。",
    href: "/market",
    cta: "进入任务市场",
  },
  {
    title: "商城",
    subtitle: "即买即用",
    description: "硬件、模板和服务包，缩短从选型到上线的周期。",
    href: "/shop",
    cta: "查看商城方案",
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

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext));
}

function isIframeUrl(url: string): boolean {
  return url.includes('player.bilibili.com') || url.includes('<iframe');
}

function extractIframeSrc(url: string): string {
  if (url.includes('<iframe')) {
    const match = url.match(/src=["']([^"']+)["']/);
    return match ? match[1] : url;
  }
  return url;
}

export function HomeHero({ brandName, heroBannerUrl }: { brandName: string; heroBannerUrl: string }) {
  return (
    <section class="relative min-h-[85vh] flex items-center overflow-hidden bg-hero-section">
      {/* Hero Banner Background */}
      {heroBannerUrl && (
        <div class="absolute inset-0 z-0">
          {isVideoUrl(heroBannerUrl) ? (
            <video
              src={heroBannerUrl}
              autoPlay
              muted
              loop
              playsInline
              class="w-full h-full object-cover opacity-20"
            />
          ) : isIframeUrl(heroBannerUrl) ? (
            <iframe
              src={extractIframeSrc(heroBannerUrl)}
              class="w-full h-full object-cover opacity-20"
              scrolling="no"
              frameBorder="0"
              allowFullScreen
            />
          ) : (
            <img
              src={heroBannerUrl}
              alt=""
              class="w-full h-full object-cover opacity-20"
            />
          )}
          <div class="absolute inset-0 bg-gradient-to-b from-surface/80 via-surface/60 to-surface"></div>
        </div>
      )}

      {/* Subtle Background Pattern */}
      {!heroBannerUrl && (
        <>
          <div class="absolute inset-0 bg-grid-pattern opacity-[0.015]"></div>
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-accent/[0.03] blur-3xl -translate-y-1/2"></div>
        </>
      )}

      <div class="section-inner relative z-10 py-20 lg:py-28">
        <div class="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div class="deco-badge mx-auto mb-8 animate-on-scroll">
            <span class="deco-circle"></span>
            Enterprise AI Deployment
          </div>

          {/* Headline */}
          <h1 class="text-display-xl text-ink-strong mb-6 animate-on-scroll stagger-1">
            企业级 AI
            <br />
            <span class="text-accent">智能体</span> 操作系统
          </h1>

          {/* Subheadline */}
          <p class="text-body-lg text-ink-soft max-w-2xl mx-auto mb-10 leading-relaxed animate-on-scroll stagger-2">
            {brandName} 让 AI 进入真实业务流程：本地部署、数据可控、权限清晰、运行稳定。预装主机到手即用。
          </p>

          {/* CTA */}
          <div class="flex flex-wrap justify-center gap-4 mb-16 animate-on-scroll stagger-3">
            <a href="/shop" class="btn-primary-warm">
              购买主机
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
            <a href="/#architecture" class="btn-outline-warm">
              了解部署方式
            </a>
          </div>

          {/* Product Visual - Enlarged and Prominent */}
          <div class="card-warm-static rounded-3xl p-8 sm:p-12 max-w-5xl mx-auto animate-on-scroll stagger-4">
            <div class="text-left mb-8">
              <div class="deco-badge mb-4">交付形态</div>
              <h3 class="text-display-md text-ink-strong">
                {brandName} + 虾壳主机
              </h3>
            </div>
            <div class="aspect-[21/9] rounded-2xl bg-surface-muted flex items-center justify-center overflow-hidden shadow-2xl">
              <img
                src="/public/delivery-ui.webp"
                alt="交付形态"
                class="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Simple Stats Row */}
          <div class="flex flex-wrap justify-center gap-8 sm:gap-16 mt-12 pt-8 border-t border-line-soft animate-on-scroll stagger-5">
            <div class="text-center">
              <p class="text-display-sm text-ink-strong font-display">100%</p>
              <p class="text-label text-ink-faint mt-1">数据可控</p>
            </div>
            <div class="text-center">
              <p class="text-display-sm text-ink-strong font-display">本地优先</p>
              <p class="text-label text-ink-faint mt-1">部署方式</p>
            </div>
            <div class="text-center">
              <p class="text-display-sm text-ink-strong font-display">7×24</p>
              <p class="text-label text-ink-faint mt-1">稳定运行</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CoreValueSection() {
  return (
    <section class="section-spacing relative overflow-hidden">
      <div class="absolute inset-0 bg-surface-muted/50"></div>
      <div class="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/5 blur-3xl"></div>

      <div class="section-inner relative z-10">
        <div class="max-w-3xl mb-16 animate-on-scroll">
          <div class="deco-badge mb-6">
            <span class="deco-circle"></span>
            Why This Layer
          </div>
          <h2 class="text-display-md text-ink-strong mb-6">
            企业 AI，难的不是选模型，
            <br />
            而是<span class="text-accent">用起来</span>
          </h2>
          <p class="text-body-lg text-ink-soft max-w-2xl">
            模型哪家都能用，真正决定能否长期运行的，是部署方式、权限管理和持续维护能力。
          </p>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "不只是聊天",
              desc: "AI 能代替你执行操作，不只是回答问题。",
              delay: 1,
            },
            {
              title: "不止于模型",
              desc: "接入内部系统、数据和工具链，比选哪个模型更重要。",
              delay: 2,
            },
            {
              title: "可持续运行",
              desc: "从上线第一天就考虑长期运维，不是演示完就结束。",
              delay: 3,
            },
          ].map((item, index) => (
            <article
              key={item.title}
              class={`card-warm rounded-2xl p-8 animate-on-scroll stagger-${item.delay}`}
            >
              <div class="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6">
                <span class="text-display-sm font-display">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 class="text-display-sm text-ink-strong mb-3">{item.title}</h3>
              <p class="text-body-md text-ink-soft">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ArchitectureSection({ brandName }: { brandName: string }) {
  return (
    <section id="architecture" class="section-spacing relative">
      <div class="section-inner">
        <div class="grid gap-16 lg:grid-cols-[1fr_1fr] lg:gap-24 items-start">
          {/* Left Content */}
          <div class="animate-on-scroll">
            <div class="deco-badge mb-6">
              <span class="deco-circle"></span>
              Deployment Model
            </div>
            <h2 class="text-display-md text-ink-strong mb-6">
              {brandName} 与虾壳主机
              <br />
              的交付方式
            </h2>
            <p class="text-body-lg text-ink-soft mb-8">
              软件 + 硬件一体化交付，到手即用，缩短从选型到上线的周期。
            </p>

            <div class="flex flex-wrap gap-4">
              <a href="/shop" class="btn-primary-warm">
                购买主机
              </a>
            </div>
          </div>

          {/* Right Steps */}
          <div class="space-y-0">
            {[
              {
                num: "01",
                title: brandName,
                desc: "企业 AI 操作系统，负责任务执行、权限管理和系统接入。",
              },
              {
                num: "02",
                title: "Skill 接入",
                desc: "把内部工具、数据和流程接入 AI，形成可复用的执行能力。",
              },
              {
                num: "03",
                title: "虾壳主机",
                desc: "预装系统的硬件主机，本地运行，到手即用。",
              },
            ].map((item, index) => (
              <article
                key={item.num}
                class={`relative pl-16 py-8 border-b border-line-soft animate-on-scroll stagger-${index + 1}`}
              >
                <span class="absolute left-0 top-8 text-5xl font-display font-bold text-accent/20">
                  {item.num}
                </span>
                <h3 class="text-display-sm text-ink-strong mb-2">{item.title}</h3>
                <p class="text-body-md text-ink-soft">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CapabilityMatrixSection() {
  return (
    <section id="capabilities" class="section-spacing relative overflow-hidden">
      <div class="absolute inset-0 bg-surface-muted/30"></div>
      <div class="deco-dot-grid top-20 left-[60%] opacity-20"></div>

      <div class="section-inner relative z-10">
        <div class="text-center max-w-2xl mx-auto mb-16 animate-on-scroll">
          <div class="deco-badge mx-auto mb-6">
            <span class="deco-circle"></span>
            Core Capability
          </div>
          <h2 class="text-display-md text-ink-strong mb-4">核心能力</h2>
          <p class="text-body-lg text-ink-soft">聚焦企业团队真正会关心的三类能力。</p>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          {capabilityItems.map((item, index) => (
            <article
              key={item.title}
              class={`card-warm rounded-2xl p-8 animate-on-scroll stagger-${index + 1}`}
            >
              <div
                class="w-14 h-14 rounded-2xl bg-ink text-surface flex items-center justify-center mb-6"
                dangerouslySetInnerHTML={{ __html: item.icon }}
              />
              <h3 class="text-xl font-semibold text-ink-strong mb-3">{item.title}</h3>
              <p class="text-body-md text-ink-soft">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ScenarioSection() {
  return (
    <section id="solutions" class="section-spacing">
      <div class="section-inner">
        <div class="max-w-3xl mb-16 animate-on-scroll">
          <div class="deco-badge mb-6">
            <span class="deco-circle"></span>
            Use Cases
          </div>
          <h2 class="text-display-md text-ink-strong mb-4">适用场景</h2>
          <p class="text-body-lg text-ink-soft">
            适合那些已经明确知道 AI 需要进入哪个业务流程、但仍在评估如何部署和管理的团队。
          </p>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          {scenarioItems.map((item, index) => (
            <article
              key={item.title}
              class={`card-warm rounded-2xl p-8 animate-on-scroll stagger-${index + 1}`}
            >
              <div class="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-6">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-ink-strong mb-3">{item.title}</h3>
              <p class="text-body-md text-ink-soft">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GovernanceSection() {
  return (
    <section id="governance" class="section-spacing relative">
      <div class="absolute inset-0 bg-[#1a1a2e]"></div>
      <div class="absolute inset-0 opacity-5">
        <div class="absolute inset-0 bg-grid-pattern"></div>
      </div>

      <div class="section-inner relative z-10">
        <div class="max-w-3xl mb-16 animate-on-scroll">
          <div class="deco-badge mb-6" style={{ background: 'rgba(var(--color-accent-rgb), 0.15)', color: 'var(--color-accent-glow)' }}>
            <span class="deco-circle" style={{ background: 'var(--color-accent-glow)' }}></span>
            Governance
          </div>
          <h2 class="text-display-md mb-4" style={{ color: '#f8f9fa' }}>
            部署前需要确认的事
          </h2>
          <p class="text-body-lg" style={{ color: 'rgba(248, 249, 250, 0.7)' }}>
            企业级系统不是先上线再说。先把数据怎么管、谁能用什么确认清楚，后续运行才不出问题。
          </p>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          {governanceItems.map((item, index) => (
            <article
              key={item.title}
              class={`animate-on-scroll stagger-${index + 1}`}
              style={{ transitionDelay: `${(index + 1) * 100}ms` }}
            >
              <div class="rounded-2xl p-8 border border-white/10 bg-white/5 backdrop-blur-sm">
                <div class="text-4xl font-display font-bold mb-4" style={{ color: 'rgba(var(--color-accent-rgb), 0.3)' }}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 class="text-xl font-semibold mb-3" style={{ color: '#f8f9fa' }}>{item.title}</h3>
                <p class="text-body-md" style={{ color: 'rgba(248, 249, 250, 0.6)' }}>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HardwareSection() {
  return (
    <section class="section-spacing relative overflow-hidden">
      <div class="deco-dot-grid top-10 right-[5%] opacity-20"></div>
      <div class="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-accent/5 to-transparent"></div>

      <div class="section-inner relative z-10">
        <div class="max-w-3xl mb-16 animate-on-scroll">
          <div class="deco-badge mb-6">
            <span class="deco-circle"></span>
            Route First
          </div>
          <h2 class="text-display-md text-ink-strong mb-4">
            选择需要了解的方面
          </h2>
          <p class="text-body-lg text-ink-soft">
            首页先回答"我该去哪里"，再进入具体页面看方案细节。
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          {productRouteItems.map((item, index) => (
            <article
              key={item.title}
              class={`card-warm rounded-2xl p-8 animate-on-scroll stagger-${index + 1}`}
            >
              <div class="flex flex-col h-full">
                <div class="flex items-start justify-between mb-6">
                  <div>
                    <p class="text-label text-accent mb-2">{item.subtitle}</p>
                    <h3 class="text-display-sm text-ink-strong">{item.title}</h3>
                  </div>
                  <div class="w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-soft">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
                <p class="text-body-md text-ink-soft flex-grow">{item.description}</p>
                <div class="mt-6">
                  <a href={item.href} class="btn-outline-warm text-sm">
                    {item.cta}
                  </a>
                </div>
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
    <section class="section-spacing relative">
      <div class="section-inner">
        <div class="grid gap-8 lg:grid-cols-2">
          {/* Agent Market Card */}
          <article class="card-ink rounded-3xl p-10 animate-on-scroll">
            <div class="deco-badge mb-6" style={{ background: 'rgba(var(--color-accent-rgb), 0.15)', color: 'var(--color-accent-glow)' }}>
              <span class="deco-circle" style={{ background: 'var(--color-accent-glow)' }}></span>
              Marketplace Highlight
            </div>
            <h3 class="text-display-sm mb-4" style={{ color: '#f8f9fa' }}>Agent 众包市场</h3>
            <p class="text-body-md mb-8" style={{ color: 'rgba(248, 249, 250, 0.7)' }}>
              支持企业发布任务、服务方接单、里程碑验收与交付评价。把"临时需求"沉淀为"可复用任务模板"。
            </p>
            <ul class="space-y-3 text-body-md mb-8" style={{ color: 'rgba(248, 249, 250, 0.6)' }}>
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>任务模板：客服自动化、线索触达、内容生产、数据分析</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>角色机制：需求方、服务方、审核协同</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>交付方式：里程碑拆分 + 结果验收</span>
              </li>
            </ul>
            <a href="/market" class="inline-flex items-center gap-2 font-semibold transition-colors group" style={{ color: '#f8f9fa' }}>
              <span>发布任务或成为服务方</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover:translate-x-1 transition-transform">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </article>

          {/* Store Card */}
          <article class="card-warm rounded-3xl p-10 animate-on-scroll stagger-2">
            <div class="deco-badge mb-6">
              <span class="deco-circle"></span>
              Store Highlight
            </div>
            <h3 class="text-display-sm text-ink-strong mb-4">商城</h3>
            <p class="text-body-md text-ink-soft mb-8">
              集中提供硬件、Agent 模板与服务包，帮助团队按预算快速完成选型与采购。
            </p>
            <ul class="space-y-3 text-body-md text-ink-soft mb-8">
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>硬件套餐：按规模选择算力与交付配置</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>数字商品：模板、行业包、工作流资产</span>
              </li>
              <li class="flex items-start gap-3">
                <span class="text-accent mt-1">—</span>
                <span>服务商品：部署实施、代运营与专家支持</span>
              </li>
            </ul>
            <a href="/shop" class="inline-flex items-center gap-2 text-ink font-semibold hover:text-accent transition-colors group">
              <span>查看商城方案</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover:translate-x-1 transition-transform">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}

export function OemSection() {
  return (
    <section id="oem" class="section-spacing relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-transparent"></div>

      <div class="section-inner relative z-10">
        <div class="card-warm-static rounded-3xl p-12 md:p-16 animate-on-scroll">
          <div class="grid gap-12 md:grid-cols-[1fr_auto] md:items-center">
            <div class="max-w-3xl">
              <div class="deco-badge mb-6">
                <span class="deco-circle"></span>
                OEM Program
              </div>
              <h2 class="text-display-md text-ink-strong mb-4">
                OEM 白牌能力开放中
              </h2>
              <p class="text-body-lg text-ink-soft">
                支持品牌方以 OEM 方式快速进入交付：品牌替换、主机白牌采购、自有商城与众包市场能力将逐步开放。
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-4">
              <a href="/oem" class="btn-primary-warm whitespace-nowrap">
                查看 OEM 方案
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ brandName }: { brandName: string }) {
  const faqItems = buildFaqItems(brandName);
  return (
    <section class="section-spacing relative">
      <div class="absolute inset-0 bg-surface-muted/30"></div>

      <div class="section-inner-narrow relative z-10">
        <div class="max-w-2xl mx-auto text-center mb-16 animate-on-scroll">
          <div class="deco-badge mx-auto mb-6">
            <span class="deco-circle"></span>
            Questions
          </div>
          <h2 class="text-display-md text-ink-strong mb-4">常见问题</h2>
        </div>

        <div class="space-y-6 max-w-3xl mx-auto">
          {faqItems.map((item, index) => (
            <details
              key={item.question}
              class="card-warm rounded-2xl animate-on-scroll"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <summary class="p-6 cursor-pointer list-none flex items-center justify-between gap-4 text-left">
                <span class="text-lg font-semibold text-ink-strong">{item.question}</span>
                <span class="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center flex-shrink-0 transition-transform details-toggle-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </span>
              </summary>
              <div class="px-6 pb-6 text-body-md text-ink-soft border-t border-line-soft pt-4">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section class="section-spacing relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-surface to-surface-muted"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl"></div>

      <div class="section-inner relative z-10">
        <div class="max-w-3xl mx-auto text-center animate-on-scroll">
          <div class="deco-badge mx-auto mb-6">
            <span class="deco-circle"></span>
            Next Step
          </div>
          <h2 class="text-display-md text-ink-strong mb-6">
            从部署评估开始，
            <br />
            确认怎么<span class="text-accent">用起来</span>
          </h2>
          <p class="text-body-lg text-ink-soft mb-10 max-w-2xl mx-auto">
            虾壳主机预装 OpenClaw，到手即用，快速部署企业 AI 能力。
          </p>
          <div class="flex flex-wrap justify-center gap-4">
            <a href="/shop" class="btn-primary-warm">
              购买主机
            </a>
            <a href="/downloads" class="btn-outline-warm">
              下载试用
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
