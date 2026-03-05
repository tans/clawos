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
              <li>下载后，按系统选择对应安装包或可执行文件并直接运行。</li>
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
              <li>ClawOS 已移除自动更新，请前往 clawos.cc 下载最新版本并替换当前安装文件。</li>
              <li>更新前关闭已打开的 ClawOS，替换后重新启动并确认版本号。</li>
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
