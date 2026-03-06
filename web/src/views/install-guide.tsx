/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

function InstallGuidePage() {
  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS 安装文档</title>
        <link rel="icon" type="image/png" href="/public/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200/40 text-base-content">
        <main class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
          <header class="rounded-box border border-base-content/10 bg-base-100/80 p-5 backdrop-blur sm:p-6">
            <div class="flex items-center gap-3">
              <img src="/public/logo.png" alt="ClawOS Logo" class="size-9 rounded-md object-contain" />
              <div>
                <h1 class="text-2xl font-semibold sm:text-3xl">安装文档</h1>
                <p class="mt-1 text-sm text-base-content/70">ClawOS 多平台安装与更新说明</p>
              </div>
            </div>
          </header>

          <section class="mt-6 rounded-[1.5rem] border border-base-content/10 bg-base-100/80 p-6 sm:p-8">
            <h2 class="text-xl font-semibold">安装使用</h2>
            <ul class="mt-4 list-disc space-y-2 pl-5 text-base-content/85">
              <li>Windows 推荐统一使用安装脚本：<code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">install-or-update-clawos.bat</code>。</li>
              <li>安装脚本会自动识别 Electrobun 安装包（Setup.zip / Setup.exe）并完成安装或更新。</li>
              <li>Windows 首次运行若有安全提示，可点击“更多信息”后选择“仍要运行”。</li>
              <li>
                可选：建议放入常用目录，例如 <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">{"c:\\xiake"}</code> 或{" "}
                <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">~/clawos</code>。
              </li>
            </ul>
          </section>

          <section class="mt-6 rounded-[1.5rem] border border-base-content/10 bg-base-100/80 p-6 sm:p-8">
            <h2 class="text-xl font-semibold">更新说明</h2>
            <ul class="mt-4 list-disc space-y-2 pl-5 text-base-content/85">
              <li>Windows 更新时，重复运行 <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">install-or-update-clawos.bat</code> 即可。</li>
              <li>脚本会自动刷新开机自启动路径，不需要手工修改注册表。</li>
              <li>不建议手动只运行 Setup.exe，应该优先使用脚本或完整 Setup.zip。</li>
            </ul>
          </section>

          <div class="mt-6">
            <a class="btn btn-ghost btn-sm" href="/">
              返回首页
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

export function renderInstallGuidePage(): string {
  return `<!doctype html>${renderToString(<InstallGuidePage />)}`;
}
