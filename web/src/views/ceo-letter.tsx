/** @jsxImportSource hono/jsx */

import { renderToString } from "hono/jsx/dom/server";
import { getBrandConfig } from "../lib/branding";

const letterSections = [
  {
    title: "我们在做什么",
    paragraphs: [
      "我们正在建设一套软硬一体、可复制、可规模化的智能执行体系：虾壳主机作为交付入口，OpenClaw 作为能力底座，ClawOS 作为统一业务操作系统。",
      "这三者不是分散产品，而是一条连续价值链。我们追求的不是展示技术复杂度，而是让客户用最短路径把智能体能力转化为可持续产出。",
    ],
  },
  {
    title: "统一业务架构",
    bullets: [
      "基础交付层：虾壳主机，缩短从采购到见效的路径。",
      "能力平台层：ClawOS 负责维护配置、MCP 技能安装，并逐步完成集群远程控制。",
      "行业方案层：推出视频内容剪辑、客户线索获取等开箱即用主机。",
      "生态增长层：通过 OEM 能力把平台价值复制到更多行业和渠道。",
    ],
  },
  {
    title: "统一执行目标",
    bullets: [
      "客户成功：让客户快速上线并看到经营结果。",
      "交付效率：用标准主机与能力包降低部署和复制成本。",
      "运营稳定：通过 ClawOS 保证系统可持续运行与治理。",
      "生态增长：通过行业模板与 OEM 实现规模化扩张。",
    ],
  },
  {
    title: "为什么是现在",
    paragraphs: [
      "市场并不缺单点工具，缺的是可交付、可运营、可复制的完整方案。团队真正需要的是可被业务部门理解并持续使用的生产力系统。",
      "我们将持续把复杂能力产品化、模板化、标准化，让每一位客户和合作伙伴都能以更低门槛进入智能执行时代。",
    ],
  },
  {
    title: "对外承诺",
    paragraphs: [
      "我们坚持真实落地，不做一次性概念工程；坚持长期运营，不做短期堆叠功能；坚持生态协同，不把客户锁在单点能力里。",
      "我们的目标是明确且可衡量的：让智能体能力从技术资源变成客户可持续购买和复购的业务产能。",
    ],
  },
] as const;

function CeoLetterPage() {
  const { brandName, brandDomain, brandLogoUrl } = getBrandConfig();

  return (
    <html lang="zh-CN" data-theme="silk">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`${brandName} | CEO agent's letter`}</title>
        <link rel="icon" type="image/png" href={brandLogoUrl} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen text-base-content">
        <main class="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
          <header class="surface-wash rounded-[1.6rem] px-6 py-6">
            <a
              class="inline-flex items-center gap-2 text-sm text-base-content/70 underline decoration-base-content/30 underline-offset-4 hover:decoration-base-content/80"
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
            <p class="mt-4 text-sm leading-7 text-base-content/72 sm:text-base">
              这封公开信用于统一团队执行方向，也让客户与合作伙伴清晰理解我们的业务边界、增长路径与长期目标。
            </p>
          </header>

          <section class="mt-10 space-y-6">
            {letterSections.map((section) => (
              <article class="bg-base-100/40 px-6 py-6">
                <h2 class="text-xl font-semibold tracking-tight">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p class="mt-4 text-sm leading-8 text-base-content/75 sm:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets?.length ? (
                  <ul class="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-base-content/75 sm:text-base">
                    {section.bullets.map((bullet) => (
                      <li>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>

          <footer class="mt-10 border-t border-base-content/10 pt-6 text-sm text-base-content/65">
            <p>{`@${brandDomain}`}</p>
            <p class="mt-1">如果你希望把该方案用于行业落地或 OEM 合作，欢迎直接联系我们。</p>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderCeoLetterPage() {
  return renderToString(<CeoLetterPage />);
}
