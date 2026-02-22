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
  browser:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 10h18"/><path d="M12 3c2.5 2.3 4 5.5 4 9s-1.5 6.7-4 9c-2.5-2.3-4-5.5-4-9s1.5-6.7 4-9z"/></svg>',
  start:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/></svg>',
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
  config:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h8"/></svg>',
};

function icon(name: string): string {
  return ICONS[name] || "";
}

function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        --base-100: #f5f8fb;
        --base-content: #142334;
        --primary: #126d62;
        --line: rgba(20, 35, 52, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--base-content);
        background:
          radial-gradient(900px 620px at -20% -14%, rgba(18, 109, 98, 0.2), transparent 70%),
          radial-gradient(760px 580px at 115% -10%, rgba(11, 78, 136, 0.16), transparent 70%),
          linear-gradient(150deg, #eef5fb 0%, var(--base-100) 45%, #f7fbff 100%);
      }

      .wrap {
        width: min(1100px, 100% - 36px);
        margin: 0 auto;
        padding: 22px 0 36px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 9px;
        font-weight: 700;
      }

      .brand-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: var(--primary);
        box-shadow: 0 0 0 5px rgba(18, 109, 98, 0.18);
      }

      .nav {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .card {
        background: rgba(255, 255, 255, 0.74);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 12px 30px rgba(9, 25, 40, 0.08);
        backdrop-filter: blur(12px) saturate(120%);
        -webkit-backdrop-filter: blur(12px) saturate(120%);
      }

      .hero {
        padding: 24px;
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: 16px;
        align-items: stretch;
      }

      .badge-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }

      .badge {
        font-size: 12px;
        border-radius: 999px;
        border: 1px solid rgba(18, 109, 98, 0.35);
        color: var(--primary);
        background: rgba(18, 109, 98, 0.08);
        padding: 4px 10px;
        font-weight: 600;
      }

      h1 {
        margin: 0;
        font-size: clamp(1.7rem, 4vw, 2.4rem);
        line-height: 1.18;
      }

      p {
        margin: 10px 0 0;
        color: rgba(20, 35, 52, 0.75);
      }

      .actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 12px;
        border: 1px solid transparent;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      }

      .btn:hover { transform: translateY(-1px); }

      .btn-primary {
        background: var(--primary);
        border-color: var(--primary);
        color: #f3fffd;
        box-shadow: 0 10px 24px rgba(18, 109, 98, 0.22);
      }

      .btn-ghost {
        background: rgba(255, 255, 255, 0.74);
        border-color: var(--line);
        color: var(--base-content);
      }

      .btn-icon {
        width: 15px;
        height: 15px;
        display: inline-flex;
      }

      .btn-icon svg {
        width: 100%;
        height: 100%;
      }

      .visual {
        border-radius: 14px;
        border: 1px solid var(--line);
        background: linear-gradient(165deg, rgba(11, 78, 136, 0.1), rgba(18, 109, 98, 0.12));
        padding: 14px;
        display: grid;
        grid-template-rows: 1fr auto;
      }

      .visual svg {
        width: 100%;
        height: 180px;
      }

      .visual-caption {
        font-size: 12px;
        color: rgba(20, 35, 52, 0.65);
      }

      .section {
        margin-top: 16px;
        padding: 20px;
      }

      .section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .section-head h2 {
        margin: 0;
        font-size: 21px;
      }

      .section-head span {
        font-size: 13px;
        color: rgba(20, 35, 52, 0.62);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .icon-card {
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.62);
        padding: 14px;
      }

      .icon-wrap {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        color: var(--primary);
        background: rgba(18, 109, 98, 0.12);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .icon-wrap svg {
        width: 20px;
        height: 20px;
      }

      .icon-card h3 {
        margin: 10px 0 0;
        font-size: 15px;
      }

      .icon-card p {
        margin: 6px 0 0;
        font-size: 13px;
      }

      code {
        border-radius: 8px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.9);
        padding: 2px 8px;
        font-size: 13px;
      }

      @media (max-width: 1024px) {
        .hero,
        .grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 760px) {
        .wrap {
          width: min(1100px, 100% - 22px);
          padding-top: 14px;
        }

        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .hero,
        .grid {
          grid-template-columns: 1fr;
        }

        .hero,
        .section {
          padding: 16px;
        }

        .actions,
        .btn {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      ${content}
    </main>
  </body>
</html>`;
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

pageRoutes.get("/", async (c) => {
  const latest = await readLatestRelease();
  const hasInstaller = Boolean(latest?.installer);
  const downloadHref = hasInstaller ? "/downloads/latest" : "/downloads";

  return c.html(
    layout(
      "ClawOS 官网",
      `<header class="topbar">
        <div class="brand">
          <span class="brand-dot" aria-hidden="true"></span>
          <span>ClawOS</span>
        </div>
        <nav class="nav">
          <a class="btn btn-ghost" href="/downloads"><span class="btn-icon">${icon("download")}</span>下载中心</a>
        </nav>
      </header>

      <section class="card hero">
        <div>
          <div class="badge-row">
            <span class="badge">Windows + WSL</span>
            <span class="badge">Gateway 管理</span>
          </div>
          <h1>更快部署，更少命令</h1>
          <p>用可视化界面管理 Openclaw：升级、重启、配置一步完成。</p>
          <div class="actions">
            <a class="btn btn-primary" href="${downloadHref}"><span class="btn-icon">${icon("download")}</span>下载安装</a>
            <a class="btn btn-ghost" href="/downloads/clawos_xiake.json"><span class="btn-icon">${icon("config")}</span>下载配置文件</a>
          </div>
        </div>
        <aside class="visual">
          ${heroVisual()}
          <div class="visual-caption">ClawOS 控制台 · 下载中心 · 自动化发布</div>
        </aside>
      </section>

      <section class="card section">
        <div class="section-head">
          <h2>核心能力</h2>
          <span>少文字，直接上手</span>
        </div>
        <div class="grid">
          <article class="icon-card"><span class="icon-wrap">${icon("panel")}</span><h3>控制面板</h3><p>升级 / 重启 / 状态</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("chat")}</span><h3>Channels</h3><p>渠道配置可视化</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("agent")}</span><h3>Agents</h3><p>模型策略集中管理</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("browser")}</span><h3>Browser</h3><p>自动化浏览器配置</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("start")}</span><h3>自启动</h3><p>开机策略一键设置</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("wsl")}</span><h3>WSL 诊断</h3><p>常见问题快速定位</p></article>
        </div>
      </section>

      <section class="card section">
        <div class="section-head">
          <h2>行业定制</h2>
          <span>按业务分支交付</span>
        </div>
        <div class="grid">
          <article class="icon-card"><span class="icon-wrap">${icon("edu")}</span><h3>教育</h3><p>教务与校内协作</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("med")}</span><h3>医疗</h3><p>流程规范与合规协作</p></article>
          <article class="icon-card"><span class="icon-wrap">${icon("biz")}</span><h3>企业服务</h3><p>客服、运营、内容团队</p></article>
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
        `<header class="topbar">
          <div class="brand">
            <span class="brand-dot" aria-hidden="true"></span>
            <span>ClawOS 下载中心</span>
          </div>
          <nav class="nav">
            <a class="btn btn-ghost" href="/">返回首页</a>
          </nav>
        </header>

        <section class="card section">
          <div class="section-head">
            <h2>暂无安装包</h2>
            <span>等待发布</span>
          </div>
          <div class="grid">
            <article class="icon-card">
              <span class="icon-wrap">${icon("download")}</span>
              <h3>安装包</h3>
              <p>发布后可直接下载。</p>
            </article>
            <article class="icon-card">
              <span class="icon-wrap">${icon("config")}</span>
              <h3>配置文件</h3>
              <p>接口：<code>POST /api/upload/xiake-config</code></p>
            </article>
            <article class="icon-card">
              <span class="icon-wrap">${icon("panel")}</span>
              <h3>发布接口</h3>
              <p><code>POST /api/upload/installer</code></p>
            </article>
          </div>
        </section>`,
      ),
    );
  }

  return c.html(
    layout(
      "下载 - ClawOS",
      `<header class="topbar">
        <div class="brand">
          <span class="brand-dot" aria-hidden="true"></span>
          <span>ClawOS 下载中心</span>
        </div>
        <nav class="nav">
          <a class="btn btn-ghost" href="/">返回首页</a>
        </nav>
      </header>

      <section class="card hero">
        <div>
          <div class="badge-row">
            <span class="badge">稳定发布</span>
            <span class="badge">Windows</span>
          </div>
          <h1>下载 ClawOS</h1>
          <p>安装包与配置文件已就绪。</p>
          <div class="actions">
            <a class="btn btn-primary" href="/downloads/latest"><span class="btn-icon">${icon("download")}</span>下载安装包</a>
            <a class="btn btn-ghost" href="/downloads/clawos_xiake.json"><span class="btn-icon">${icon("config")}</span>下载配置文件</a>
          </div>
        </div>
        <aside class="visual">
          ${heroVisual()}
          <div class="visual-caption">如果下载失败，请重试或联系管理员。</div>
        </aside>
      </section>`,
    ),
  );
});
