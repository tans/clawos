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
        --bg: #f6f8fa;
        --card: #ffffff;
        --text: #122233;
        --muted: #4b5f75;
        --line: #dde4eb;
        --accent: #0f766e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        background: linear-gradient(180deg, #f7fbff 0%, var(--bg) 100%);
        color: var(--text);
      }
      .wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 6px 20px rgba(4, 26, 42, 0.04);
      }
      h1, h2 {
        margin: 0 0 12px;
      }
      p { margin: 8px 0; color: var(--muted); }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
      .btn {
        display: inline-block;
        text-decoration: none;
        border: 1px solid var(--accent);
        color: var(--accent);
        padding: 8px 12px;
        border-radius: 10px;
        font-size: 14px;
      }
      .btn.primary {
        background: var(--accent);
        color: white;
      }
      code {
        background: #eef4f8;
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 1px 6px;
      }
      ul { margin: 8px 0 0 18px; }
    </style>
  </head>
  <body>
    <div class="wrap">${content}</div>
  </body>
</html>`;
}

pageRoutes.get("/", (c) => {
  return c.html(
    layout(
      "ClawOS 官网",
      `<section class="card">
        <h1>ClawOS</h1>
        <p>基于 Windows + Bun + WSL 的 Openclaw 管理工具，提供中文友好的可视化配置与运维入口。</p>
        <p>聚焦 Gateway Protocol：控制面板、channels、agents、skills、browser 与自启动管理。</p>
        <div class="actions">
          <a class="btn primary" href="/downloads">下载</a>
          <a class="btn" href="/api/releases/latest">最新版本元数据</a>
        </div>
      </section>
      <section class="card">
        <h2>能力概览</h2>
        <ul>
          <li>openclaw 升级、重启与状态检查</li>
          <li>WSL 环境检测与常见问题提示</li>
          <li>面向中文用户的配置可视化</li>
        </ul>
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
        `<section class="card">
          <h1>下载</h1>
          <p>当前尚未发布安装包。请先通过上传接口发布版本。</p>
          <p>上传接口：<code>POST /api/upload/installer</code> 与 <code>POST /api/upload/xiake-config</code></p>
        </section>`,
      ),
    );
  }

  return c.html(
    layout(
      "下载 - ClawOS",
      `<section class="card">
        <h1>下载</h1>
        <p>最新版本：<strong>${escapeHtml(latest.version)}</strong></p>
        <p>发布时间：${escapeHtml(latest.publishedAt)}</p>
        <div class="actions">
          <a class="btn primary" href="/downloads/latest">下载最新安装包</a>
          <a class="btn" href="/downloads/clawos_xiake.json">下载 clawos_xiake.json</a>
        </div>
      </section>
      <section class="card">
        <h2>校验信息</h2>
        <p>安装包 SHA256：<code>${escapeHtml(latest.installer?.sha256 ?? "未上传")}</code></p>
        <p>配置 SHA256：<code>${escapeHtml(latest.xiakeConfig?.sha256 ?? "未上传")}</code></p>
      </section>`,
    ),
  );
});
