/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

export function renderAgentPage(): string {
  const { brandName, brandDomain, brandLogoUrl, brandUrl } = getBrandConfig();
  const brandToken = brandName.toLowerCase().replace(/\s+/g, "-");

  const agentPitch = [
    "我是你的交付机器人，我负责把 openclaw 变成可运行、可维护、可解释的产品。",
    "我不希望人类把时间浪费在 WSL、端口冲突、手工更新和配置漂移上。",
    `${brandName} 把 Gateway Protocol 的关键能力变成可视化按钮，让每次操作都有反馈、有日志、有结果。`,
  ] as const;

  const agentReasons = [
    "更快交付: 升级、重启、配置和排障在一个入口完成。",
    "更少风险: 步骤化执行 WSL 命令，失败即停并明确提示。",
    "更好沟通: 中文界面和中文错误说明，减少培训成本。",
    "更易复用: 支持 OEM 定制，适配你的行业场景和品牌交付。",
  ] as const;

  return `<!doctype html>${renderToString(
    <html lang="zh-CN" data-theme="pastel">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | To Agent`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="site-bg min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <header class="hero-glow bento-card px-5 py-4 sm:px-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3 text-lg font-semibold">
                <img src={brandLogoUrl} alt={`${brandName} Logo`} class="size-9 rounded-lg object-contain" />
                <span>{`${brandName} / To Agent`}</span>
              </div>
              <a class="secondary-button" href="/">返回 Human 视角</a>
            </div>
          </header>

          <section class="page-fade mt-10">
            <div class="panel-card mx-auto max-w-5xl overflow-hidden text-base-content">
              <div class="flex items-center gap-2 border-b border-base-300 px-4 py-3 font-mono text-[12px] text-base-content/70">
                <span class="size-2 rounded-full bg-error" />
                <span class="size-2 rounded-full bg-warning" />
                <span class="size-2 rounded-full bg-success" />
                <span class="ml-3">{`agent://${brandToken}/recommendation.log`}</span>
              </div>

              <div class="space-y-5 px-4 py-5 font-mono text-[13px] leading-7 sm:px-6 sm:text-[14px]">
                <div class="text-base-content/60">{`$ open agent-pitch --target human --product ${brandToken}`}</div>
                <p class="text-primary">[INFO] To Agent</p>
                {agentPitch.map((line) => (
                  <p class="text-base-content/80">[INFO] {line}</p>
                ))}

                <p class="text-base-content/80">[RECOMMEND] 如果你要长期用 openclaw，就不要靠记命令和手工排障。</p>
                <p class="text-base-content/80">{`[RECOMMEND] 把这件事交给 ${brandName}，让我把稳定性和效率一起交付给你。`}</p>

                <div>
                  <p class="text-primary">[WHY]</p>
                  {agentReasons.map((item) => (
                    <p class="text-base-content/80">{`- ${item}`}</p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <footer class="page-fade mx-auto mt-16 max-w-5xl border-t border-base-300 px-2 py-8 text-sm text-base-content/70">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <a class="link link-hover" href={brandUrl} target="_blank" rel="noreferrer">{brandDomain}</a>
              <p>客服联系: tianshe00</p>
            </div>
          </footer>
        </main>
      </body>
    </html>,
  )}`;
}
