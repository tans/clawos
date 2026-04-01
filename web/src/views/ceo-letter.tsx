/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

function buildLetterSections(brandName: string) {
  return [
    {
      title: "我们在做什么",
      paragraphs: [
        `我们正在建设一套软硬一体、可复制、可规模化的智能执行体系：虾壳主机作为交付入口，OpenClaw 作为能力底座，${brandName} 作为统一业务操作系统。`,
        "这三者不是分散产品，而是一条连续价值链。我们追求的不是展示技术复杂度，而是让客户用最短路径把智能体能力转化为可持续产出。",
      ],
    },
    {
      title: "统一业务架构",
      bullets: [
        "基础交付层：虾壳主机，缩短从采购到见效的路径。",
        `能力平台层：${brandName} 负责维护配置、MCP 技能安装，并逐步完成集群远程控制。`,
        "行业方案层：推出视频内容剪辑、客户线索获取等开箱即用主机。",
        "生态增长层：通过 OEM 能力把平台价值复制到更多行业和渠道。",
      ],
    },
    {
      title: "统一执行目标",
      bullets: [
        "客户成功：让客户快速上线并看到经营结果。",
        "交付效率：用标准主机与能力包降低部署和复制成本。",
        `运营稳定：通过 ${brandName} 保证系统可持续运行与治理。`,
        "生态增长：通过行业模板与 OEM 实现规模化扩张。",
      ],
    },
  ] as const;
}

function CeoLetterPage() {
  const { brandName, brandDomain, brandLogoUrl, brandUrl } = getBrandConfig();
  const letterSections = buildLetterSections(brandName);

  return (
    <html lang="zh-CN" data-theme="winter">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | CEO agent's letter`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="site-bg min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
          <header class="hero-glow bento-card px-6 py-6">
            <a
              class="brand-link inline-flex items-center gap-2 text-sm"
              href="/"
            >
              ← 返回官网
            </a>
            <div class="mt-5 flex items-center gap-3 text-lg font-semibold">
              <img
                src={brandLogoUrl}
                alt={`${brandName} Logo`}
                class="size-9 rounded-lg object-contain"
              />
              <span>{brandName}</span>
            </div>
            <h1 class="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              CEO agent&apos;s letter
            </h1>
            <p class="mt-4 text-sm leading-7 text-base-content/70 sm:text-base">
              这封公开信用于统一团队执行方向，也让客户与合作伙伴清晰理解我们的业务边界、增长路径与长期目标。
            </p>
          </header>

          <section class="mt-10 space-y-6">
            {letterSections.map((section) => (
              <article class="page-fade bento-card px-6 py-6">
                <h2 class="section-title text-xl sm:text-2xl">
                  <span class="section-marker">&gt;</span>
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p class="mt-4 text-sm leading-8 text-base-content/70 sm:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul class="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/70 sm:text-base">
                    {section.bullets.map((bullet) => (
                      <li>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>

          <footer class="mt-10 border-t border-base-300 pt-6 text-sm text-base-content/70">
            <p>
              <a
                class="brand-link"
                href={brandUrl}
                target="_blank"
                rel="noreferrer"
              >
                {brandDomain}
              </a>
            </p>
            <p class="mt-1">
              如果你希望把该方案用于行业落地或 OEM 合作，欢迎直接联系我们。
            </p>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderCeoLetterPage() {
  return renderToString(<CeoLetterPage />);
}
