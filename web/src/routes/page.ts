import { Hono } from "hono";
import { readLatestRelease } from "../lib/storage";

export const pageRoutes = new Hono();

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
        --base-200: #e7edf3;
        --base-content: #142334;
        --primary: #126d62;
        --primary-content: #f3fffd;
        --secondary: #0b4e88;
        --secondary-content: #ecf6ff;
        --accent: #e29829;
        --line: rgba(20, 35, 52, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--base-content);
        background:
          radial-gradient(1000px 700px at -18% -15%, rgba(18, 109, 98, 0.18), transparent 72%),
          radial-gradient(860px 640px at 116% -12%, rgba(11, 78, 136, 0.16), transparent 72%),
          linear-gradient(150deg, #f0f6fb 0%, var(--base-100) 45%, #f8fbfd 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.08;
        background-image:
          linear-gradient(90deg, rgba(20, 35, 52, 0.1) 1px, transparent 1px),
          linear-gradient(0deg, rgba(20, 35, 52, 0.08) 1px, transparent 1px);
        background-size: 24px 24px;
      }

      main {
        position: relative;
        z-index: 1;
      }

      .wrap {
        width: min(1120px, 100% - 40px);
        margin: 0 auto;
        padding: 24px 0 40px;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 16px;
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
        gap: 10px;
        flex-wrap: wrap;
      }

      .card {
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: 0 12px 30px rgba(9, 25, 40, 0.08);
        backdrop-filter: blur(14px) saturate(120%);
        -webkit-backdrop-filter: blur(14px) saturate(120%);
      }

      .hero {
        padding: 28px;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.8fr 1fr;
        gap: 18px;
        align-items: stretch;
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        line-height: 1.18;
      }

      .hero p {
        margin: 12px 0 0;
        color: rgba(20, 35, 52, 0.78);
      }

      .badge-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
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

      .actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
        flex-wrap: wrap;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid transparent;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn-primary {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--primary-content);
        box-shadow: 0 10px 24px rgba(18, 109, 98, 0.22);
      }

      .btn-primary:hover {
        background: #0f5f56;
      }

      .btn-ghost {
        background: rgba(255, 255, 255, 0.72);
        border-color: var(--line);
        color: var(--base-content);
      }

      .btn-ghost:hover {
        background: rgba(255, 255, 255, 0.95);
      }

      .meta {
        padding: 18px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 14px;
      }

      .meta-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(20, 35, 52, 0.58);
      }

      .meta-value {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.2;
      }

      .meta-help {
        font-size: 13px;
        color: rgba(20, 35, 52, 0.72);
      }

      .sections {
        margin-top: 18px;
        display: grid;
        gap: 18px;
      }

      .section {
        padding: 24px;
      }

      .section h2 {
        margin: 0;
        font-size: 22px;
      }

      .section-subtitle {
        margin: 10px 0 0;
        color: rgba(20, 35, 52, 0.72);
      }

      .feature-grid,
      .industry-grid {
        margin-top: 16px;
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .feature-card,
      .industry-card {
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.6);
        padding: 16px;
      }

      .feature-card h3,
      .industry-card h3 {
        margin: 0;
        font-size: 16px;
      }

      .feature-card p,
      .industry-card p {
        margin: 8px 0 0;
        font-size: 14px;
        color: rgba(20, 35, 52, 0.72);
      }

      code {
        border-radius: 8px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.9);
        padding: 2px 8px;
        font-size: 13px;
      }

      @media (max-width: 1024px) {
        .hero-grid,
        .feature-grid,
        .industry-grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 760px) {
        .wrap {
          width: min(1120px, 100% - 24px);
          padding-top: 16px;
        }

        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .hero,
        .section {
          padding: 18px;
        }

        .hero-grid,
        .feature-grid,
        .industry-grid {
          grid-template-columns: 1fr;
        }

        .actions {
          width: 100%;
        }

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

pageRoutes.get("/", async (c) => {
  const latest = await readLatestRelease();

  const hasInstaller = Boolean(latest?.installer);
  const downloadHref = hasInstaller ? "/downloads/latest" : "/downloads";
  const metaValue = latest ? escapeHtml(latest.version) : "尚未发布";
  const metaHelp = latest
    ? `发布时间：${escapeHtml(latest.publishedAt)}`
    : "发布安装包后会自动展示最新版下载入口";

  return c.html(
    layout(
      "ClawOS 官网",
      `<header class="topbar">
        <div class="brand">
          <span class="brand-dot" aria-hidden="true"></span>
          <span>ClawOS</span>
        </div>
        <nav class="nav">
          <a class="btn btn-ghost" href="/downloads">下载中心</a>
          <a class="btn btn-ghost" href="/api/releases/latest">版本元数据</a>
        </nav>
      </header>

      <section class="card hero">
        <div class="hero-grid">
          <div>
            <div class="badge-row">
              <span class="badge">Windows 优先体验</span>
              <span class="badge">Gateway Protocol</span>
              <span class="badge">中文可视化管理</span>
            </div>
            <h1>在 Windows 上一站式管理 Openclaw Gateway</h1>
            <p>ClawOS 基于 Bun + WSL，专为中文用户打造。你可以在图形界面完成升级、重启、配置 channels / agents / skills / browser，并统一管理开机自启动与运行状态。</p>
            <div class="actions">
              <a class="btn btn-primary" href="${downloadHref}">下载安装最新版 ClawOS</a>
              <a class="btn btn-ghost" href="/downloads">查看全部下载资源</a>
            </div>
          </div>
          <aside class="card meta">
            <div>
              <div class="meta-title">Latest Release</div>
              <div class="meta-value">${metaValue}</div>
            </div>
            <div class="meta-help">${metaHelp}</div>
            <a class="btn btn-ghost" href="/downloads/clawos_xiake.json">下载 clawos_xiake.json</a>
          </aside>
        </div>
      </section>

      <div class="sections">
        <section class="card section">
          <h2>ClawOS 功能介绍</h2>
          <p class="section-subtitle">围绕 Gateway Protocol 的核心能力，面向 Windows + WSL 使用场景进行操作简化与错误可视化。</p>
          <div class="feature-grid">
            <article class="feature-card">
              <h3>控制面板</h3>
              <p>支持 openclaw 升级、重启、启动、停止与状态检查，关键操作有日志反馈。</p>
            </article>
            <article class="feature-card">
              <h3>Channels 管理</h3>
              <p>图形化维护通讯渠道配置，降低手工编辑配置文件的出错概率。</p>
            </article>
            <article class="feature-card">
              <h3>Agents 管理</h3>
              <p>集中配置模型和推理参数，配合中文提示提升调试效率。</p>
            </article>
            <article class="feature-card">
              <h3>Skills 与 Browser</h3>
              <p>可视化维护技能与浏览器相关配置，快速接入自动化工作流。</p>
            </article>
            <article class="feature-card">
              <h3>开机自启动</h3>
              <p>一键管理 ClawOS 开机启动策略，减少重复手工操作。</p>
            </article>
            <article class="feature-card">
              <h3>WSL 诊断</h3>
              <p>针对端口占用、WSL 未启动、权限不足等问题提供中文修复建议。</p>
            </article>
          </div>
        </section>

        <section class="card section">
          <h2>行业定制说明</h2>
          <p class="section-subtitle">针对企业内部环境，可以提供安装、配置、运维流程的定制化落地与交付。</p>
          <div class="industry-grid">
            <article class="industry-card">
              <h3>企业微信与私域运营</h3>
              <p>按组织架构预置 channels、会话策略和多账号运行规范，减少上线准备时间。</p>
            </article>
            <article class="industry-card">
              <h3>客服与服务台</h3>
              <p>结合客服流程定制 agents + skills 模板，支持标准问答、转人工与日志追溯。</p>
            </article>
            <article class="industry-card">
              <h3>电商与内容团队</h3>
              <p>围绕多渠道内容生成与发布设计工作流，统一浏览器和自动化配置。</p>
            </article>
          </div>
          <p class="section-subtitle">定制重点：Windows 终端部署规范、WSL 环境初始化、版本升级 SOP、故障定位指引。</p>
        </section>
      </div>`,
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
          <h2>暂无可下载版本</h2>
          <p class="section-subtitle">当前尚未发布安装包。请先通过上传接口发布版本资源。</p>
          <p>上传接口：<code>POST /api/upload/installer</code> 与 <code>POST /api/upload/xiake-config</code></p>
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
          <a class="btn btn-ghost" href="/api/releases/latest">版本元数据</a>
        </nav>
      </header>

      <section class="card hero">
        <div class="hero-grid">
          <div>
            <div class="badge-row">
              <span class="badge">稳定发布</span>
            </div>
            <h1>下载 ClawOS 最新版本</h1>
            <p>最新版本：<strong>${escapeHtml(latest.version)}</strong></p>
            <p>发布时间：${escapeHtml(latest.publishedAt)}</p>
            <div class="actions">
              <a class="btn btn-primary" href="/downloads/latest">下载最新安装包</a>
              <a class="btn btn-ghost" href="/downloads/clawos_xiake.json">下载 clawos_xiake.json</a>
            </div>
          </div>
          <aside class="card meta">
            <div>
              <div class="meta-title">SHA256</div>
              <div class="meta-help">安装包：<code>${escapeHtml(latest.installer?.sha256 ?? "未上传")}</code></div>
            </div>
            <div class="meta-help">配置文件：<code>${escapeHtml(latest.xiakeConfig?.sha256 ?? "未上传")}</code></div>
          </aside>
        </div>
      </section>`,
    ),
  );
});
