import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";

export const pageRoutes = new Hono();

const ICONS: Record<string, string> = {
  panel:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 15h3"/></svg>',
  chat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v10H8l-4 4z"/><path d="M8 9h8"/><path d="M8 12h5"/></svg>',
  agent:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.6-3.4 4.3-5 8-5s6.4 1.6 8 5"/></svg>',
  skill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.8-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  browser:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 10h18"/><path d="M12 3c2.5 2.3 4 5.5 4 9s-1.5 6.7-4 9c-2.5-2.3-4-5.5-4-9s1.5-6.7 4-9z"/></svg>',
  wsl:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10l2 2-2 2"/><path d="M11 14h4"/></svg>',
  edu:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.8 2.2 3 5 3s5-1.2 5-3v-5"/></svg>',
  med:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M4 12h16"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>',
  biz:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2"/><path d="M3 12h18"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><rect x="4" y="17" width="16" height="3" rx="1"/></svg>',
  cube:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/></svg>',
};

function icon(name: string): string {
  return ICONS[name] || "";
}

function heroVisual(): string {
  return `<svg viewBox="0 0 420 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0B4E88" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#126D62" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <rect x="16" y="24" width="180" height="112" rx="14" fill="url(#g1)"/>
    <rect x="28" y="40" width="156" height="8" rx="4" fill="#DFF7F2" fill-opacity="0.9"/>
    <rect x="28" y="58" width="110" height="8" rx="4" fill="#DFF7F2" fill-opacity="0.75"/>
    <rect x="28" y="76" width="134" height="8" rx="4" fill="#DFF7F2" fill-opacity="0.6"/>
    <rect x="240" y="40" width="160" height="84" rx="14" fill="#FFFFFF" fill-opacity="0.92"/>
    <rect x="252" y="54" width="136" height="10" rx="5" fill="#126D62" fill-opacity="0.16"/>
    <rect x="252" y="72" width="92" height="10" rx="5" fill="#0B4E88" fill-opacity="0.2"/>
    <rect x="252" y="90" width="124" height="10" rx="5" fill="#E29829" fill-opacity="0.23"/>
    <circle cx="112" cy="176" r="14" fill="#126D62" fill-opacity="0.24"/>
    <circle cx="162" cy="176" r="14" fill="#0B4E88" fill-opacity="0.24"/>
    <circle cx="212" cy="176" r="14" fill="#E29829" fill-opacity="0.26"/>
    <path d="M196 82L240 82" stroke="#0B4E88" stroke-opacity="0.42" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M196 102L240 102" stroke="#126D62" stroke-opacity="0.42" stroke-width="2" stroke-dasharray="4 4"/>
  </svg>`;
}

function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="zh-CN" data-theme="silk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        background:
          radial-gradient(1000px 740px at -18% -22%, color-mix(in oklab, var(--color-primary) 16%, transparent), transparent 72%),
          radial-gradient(920px 660px at 114% -14%, color-mix(in oklab, var(--color-info) 14%, transparent), transparent 70%),
          linear-gradient(150deg, color-mix(in oklab, var(--color-base-100) 90%, var(--color-base-200)), var(--color-base-100));
      }
      .shell {
        width: min(1120px, calc(100% - 28px));
        margin: 0 auto;
        padding: 18px 0 40px;
      }
      .glass {
        background-color: color-mix(in oklab, var(--color-base-100) 72%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
        box-shadow: 0 12px 30px color-mix(in oklab, var(--color-base-content) 10%, transparent);
        backdrop-filter: blur(16px) saturate(120%);
        -webkit-backdrop-filter: blur(16px) saturate(120%);
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 16px;
      }
      .hero {
        margin-top: 14px;
        border-radius: 18px;
        padding: 18px;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 14px;
      }
      .hero h1 {
        margin: 0;
        font-size: clamp(1.5rem, 4vw, 2.3rem);
        line-height: 1.15;
      }
      .hero p {
        margin: 10px 0 0;
        color: color-mix(in oklab, var(--color-base-content) 74%, transparent);
      }
      .badge-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 16px;
      }
      .icon-sm {
        width: 16px;
        height: 16px;
        display: inline-flex;
      }
      .icon-sm svg {
        width: 100%;
        height: 100%;
      }
      .hero-visual {
        border-radius: 14px;
        padding: 12px;
        border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
        background: linear-gradient(
          160deg,
          color-mix(in oklab, var(--color-info) 14%, var(--color-base-100)),
          color-mix(in oklab, var(--color-primary) 12%, var(--color-base-100))
        );
      }
      .hero-visual svg {
        width: 100%;
        height: 180px;
      }
      .hero-note {
        margin-top: 6px;
        font-size: 12px;
        color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
      }
      .section {
        margin-top: 14px;
        border-radius: 18px;
        padding: 16px;
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 10px;
      }
      .section-head h2 {
        margin: 0;
        font-size: 1.2rem;
      }
      .section-head span {
        font-size: 13px;
        color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .soft-card {
        border-radius: 14px;
        border: 1px solid color-mix(in oklab, var(--color-base-content) 10%, transparent);
        background: color-mix(in oklab, var(--color-base-100) 80%, transparent);
        padding: 12px;
      }
      .soft-card h3 {
        margin: 8px 0 0;
        font-size: 15px;
      }
      .soft-card p {
        margin: 6px 0 0;
        font-size: 13px;
        color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
      }
      .icon-wrap {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--color-primary);
        background: color-mix(in oklab, var(--color-primary) 14%, transparent);
      }
      .icon-wrap svg {
        width: 20px;
        height: 20px;
      }
      .oem-copy {
        margin: 0 0 8px;
        font-size: 14px;
        color: color-mix(in oklab, var(--color-base-content) 74%, transparent);
      }
      @media (max-width: 980px) {
        .hero-grid,
        .cards {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 720px) {
        .shell {
          width: min(1120px, calc(100% - 18px));
          padding-top: 12px;
        }
        .topbar,
        .hero,
        .section {
          padding: 14px;
        }
        .topbar,
        .section-head {
          flex-direction: column;
          align-items: flex-start;
        }
        .hero-grid,
        .cards {
          grid-template-columns: 1fr;
        }
        .cta-row .btn {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">${content}</main>
  </body>
</html>`;
}

pageRoutes.get("/", async (c) => {
  const latest = await readLatestRelease();
  const hasInstaller = Boolean(latest?.installer);
  const downloadHref = hasInstaller ? "/downloads/latest" : "/downloads";

  return c.html(
    layout(
      "ClawOS 官网",
      `<header class="topbar glass">
        <div class="text-lg font-semibold">ClawOS</div>
        <a class="btn btn-sm btn-outline" href="/downloads"><span class="icon-sm">${icon("download")}</span>下载</a>
      </header>

      <section class="hero glass">
        <div class="hero-grid">
          <div>
            <div class="badge-row">
              <span class="badge badge-primary badge-outline">Windows + WSL</span>
              <span class="badge badge-info badge-outline">Gateway</span>
              <span class="badge badge-accent badge-outline">OEM</span>
            </div>
            <h1>openclaw OEM · 更友好的交付与销售</h1>
            <p>一键升级 openclaw，简化 Agent 模型配置，内置精选技能市场。</p>
            <div class="cta-row">
              <a class="btn btn-primary" href="${downloadHref}"><span class="icon-sm">${icon("download")}</span>下载安装包</a>
              <a class="btn btn-outline" href="#oem"><span class="icon-sm">${icon("cube")}</span>查看 OEM 方案</a>
            </div>
          </div>
          <aside class="hero-visual">
            ${heroVisual()}
            <div class="hero-note">Silk Theme · DaisyUI 版面</div>
          </aside>
        </div>
      </section>

      <section class="section glass">
        <div class="section-head">
          <h2>核心能力</h2>
          <span>产品化交付</span>
        </div>
        <div class="cards">
          <article class="soft-card"><span class="icon-wrap">${icon("panel")}</span><h3>一键升级 openclaw</h3><p>升级、重启、状态检查一体化。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("agent")}</span><h3>简化Agent模型配置</h3><p>减少手工改配置，降低上线门槛。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("skill")}</span><h3>内置精选技能市场</h3><p>内置常用技能模板，开箱即用。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("chat")}</span><h3>通讯渠道接入</h3><p>常见渠道统一接入与管理。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("browser")}</span><h3>浏览器自动化</h3><p>浏览器与工作流配置统一管理。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("wsl")}</span><h3>WSL 诊断</h3><p>端口、权限、环境问题可视排查。</p></article>
        </div>
      </section>

      <section id="oem" class="section glass">
        <div class="section-head">
          <h2>openclaw OEM</h2>
          <span>定制行业解决方案</span>
        </div>
        <p class="oem-copy">定制行业解决方案，打通现有业务体系。</p>
        <p class="oem-copy">无论是传统的 SaaS 软件还是咨询行业，通过 openclaw OEM 提供专属的软硬件一体方案，更好的服务，友好的交付，简单的销售模式。</p>
        <div class="cards">
          <article class="soft-card"><span class="icon-wrap">${icon("edu")}</span><h3>教育行业</h3><p>教务、招生与校内协作场景。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("med")}</span><h3>医疗行业</h3><p>流程规范、合规与数据协作。</p></article>
          <article class="soft-card"><span class="icon-wrap">${icon("biz")}</span><h3>SaaS / 咨询</h3><p>专属方案，标准交付，快速复制。</p></article>
        </div>
      </section>`,
    ),
  );
});

pageRoutes.get("/downloads", async (c) => {
  const latest = await readLatestRelease();

  if (!latest) {
    return c.html(
      layout(
        "下载 - ClawOS",
        `<header class="topbar glass">
          <div class="text-lg font-semibold">ClawOS 下载</div>
          <a class="btn btn-sm btn-outline" href="/">返回首页</a>
        </header>

        <section class="section glass">
          <div class="section-head">
            <h2>暂无安装包</h2>
            <span>等待发布</span>
          </div>
          <div class="cards">
            <article class="soft-card"><span class="icon-wrap">${icon("download")}</span><h3>安装包</h3><p>发布后可直接下载。</p></article>
            <article class="soft-card"><span class="icon-wrap">${icon("cube")}</span><h3>OEM 发布</h3><p>支持行业分支打包与交付。</p></article>
            <article class="soft-card"><span class="icon-wrap">${icon("panel")}</span><h3>上传接口</h3><p><code>POST /api/upload/installer</code></p></article>
          </div>
        </section>`,
      ),
    );
  }

  return c.html(
    layout(
      "下载 - ClawOS",
      `<header class="topbar glass">
        <div class="text-lg font-semibold">ClawOS 下载</div>
        <a class="btn btn-sm btn-outline" href="/">返回首页</a>
      </header>

      <section class="hero glass">
        <div class="hero-grid">
          <div>
            <div class="badge-row">
              <span class="badge badge-success badge-outline">稳定发布</span>
              <span class="badge badge-primary badge-outline">Windows x64</span>
            </div>
            <h1>下载 ClawOS 安装包</h1>
            <p>建议使用最新安装包进行部署。</p>
            <div class="cta-row">
              <a class="btn btn-primary" href="/downloads/latest"><span class="icon-sm">${icon("download")}</span>下载安装包</a>
            </div>
          </div>
          <aside class="hero-visual">
            ${heroVisual()}
            <div class="hero-note">下载失败请重试，或联系管理员。</div>
          </aside>
        </div>
      </section>`,
    ),
  );
});
