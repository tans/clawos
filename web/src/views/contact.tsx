/** @jsxImportSource hono/jsx */

import { getBrandConfig } from "../lib/branding";
import { renderMarketingShell } from "./marketing-shell";

const MANUAL_URL = "https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink";

export function renderContactPage(): string {
  return renderMarketingShell({
    title: "部署评估",
    description: "围绕业务切入点、部署方式、系统接入与上线边界发起部署评估。",
    currentPath: "/contact",
    children: <ContactPage />,
  });
}

function ContactPage() {
  const { customerServiceWechat } = getBrandConfig();
  return (
    <>
      <section class="marketing-section py-24 sm:py-32">
        <div class="marketing-section-inner">
          <div class="max-w-4xl space-y-6">
            <p class="marketing-kicker">Deployment Assessment</p>
            <h1 class="marketing-h2">申请部署评估</h1>
            <p class="marketing-lead text-base leading-8">
              适合准备部署企业 AI 系统的团队。我们将围绕业务切入点、部署方式、系统接入与上线边界进行沟通。
            </p>
          </div>
        </div>
      </section>

      <section class="marketing-section py-12 sm:py-16">
        <div class="marketing-section-inner grid gap-10 md:grid-cols-3">
          <article class="border-t border-[color:var(--line-soft)] pt-6">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">部署评估</h2>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              确认适合从哪个业务场景开始，以及部署边界和实施条件。
            </p>
            <ul class="mt-4 space-y-2 text-sm leading-7 text-[color:var(--ink-soft)]">
              {customerServiceWechat ? <li>客服微信：{customerServiceWechat}</li> : null}
              <li>沟通重点：业务切入点、部署方式、系统边界</li>
            </ul>
          </article>

          <article class="border-t border-[color:var(--line-soft)] pt-6">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">交付与采购</h2>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              咨询虾壳主机、交付方式、本地优先部署与采购安排。
            </p>
            <ul class="mt-4 space-y-2 text-sm leading-7 text-[color:var(--ink-soft)]">
              <li>采购咨询：虾壳主机</li>
              <li>部署咨询：本地优先 / 混合部署</li>
            </ul>
          </article>

          <article class="border-t border-[color:var(--line-soft)] pt-6">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">基础资料</h2>
            <p class="mt-3 text-sm leading-8 text-[color:var(--ink-soft)]">
              先查看使用手册与基础信息，再决定是否进入方案沟通。
            </p>
            <a class="marketing-secondary-button mt-5" href={MANUAL_URL} target="_blank" rel="noreferrer">
              打开飞书使用手册
            </a>
          </article>
        </div>
      </section>
    </>
  );
}
