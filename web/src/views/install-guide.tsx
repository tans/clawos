/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";

function InstallGuidePage() {
  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ClawOS 安装说明</title>
        <link rel="icon" type="image/png" href="/public/logo.png" />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-base-200/40 text-base-content">
        <main class="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
          <header class="rounded-[1.5rem] border border-base-content/10 bg-base-100/85 p-6 backdrop-blur sm:p-8">
            <div class="flex items-center gap-3">
              <img src="/public/logo.png" alt="ClawOS Logo" class="size-9 rounded-md object-contain" />
              <div>
                <h1 class="text-2xl font-semibold sm:text-3xl">安装说明</h1>
                <p class="mt-2 text-sm leading-7 text-base-content/70">适合第一次安装，或者已有版本需要更新的时候使用。</p>
              </div>
            </div>
          </header>

          <section class="mt-10 rounded-[1.5rem] border border-base-content/10 bg-base-100/85 p-6 sm:p-8">
            <h2 class="text-xl font-semibold">Windows 安装</h2>
            <ul class="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-base-content/80">
              <li>
                推荐直接运行 <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">install-or-update-clawos.bat</code>。
              </li>
              <li>脚本会自动识别安装包，并完成安装或更新。</li>
              <li>如果 Windows 弹出安全提示，可以先点“更多信息”，再选择继续运行。</li>
              <li>
                安装后可以把程序放到常用目录，例如{" "}
                <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">c:\xiake\</code>。
              </li>
            </ul>
          </section>

          <section class="mt-8 rounded-[1.5rem] border border-base-content/10 bg-base-100/85 p-6 sm:p-8">
            <h2 class="text-xl font-semibold">更新方式</h2>
            <ul class="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-base-content/80">
              <li>
                更新时还是运行 <code class="rounded bg-base-200 px-1.5 py-0.5 text-sm">install-or-update-clawos.bat</code>。
              </li>
              <li>脚本会处理旧版本替换，不需要你手动改路径。</li>
              <li>不建议只单独运行 Setup.exe，优先使用完整安装脚本或完整安装包。</li>
            </ul>
          </section>

          <div class="mt-10">
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
