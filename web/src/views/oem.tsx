/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";
import { getBrandConfig } from "../lib/branding";

function OemPage({ brandName }: { brandName: string }) {
  return (
    <section class="marketing-section py-20 sm:py-24">
      <div class="marketing-section-inner space-y-10">
        <div class="max-w-4xl space-y-4">
          <p class="marketing-kicker">OEM Program</p>
          <h1 class="marketing-h1">OEM 白牌合作方案</h1>
          <p class="text-base leading-8 text-[color:var(--ink-soft)]">
            {`面向渠道商、交付商与品牌方的 OEM 能力页。你可以基于 ${brandName} 建立自己的品牌体验，并逐步接入更多白牌能力。`}
          </p>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <article class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">品牌与 Logo 可定制</h2>
            <p class="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
              可在后台配置品牌名、站点名与 Logo，快速形成面向客户的一体化品牌入口。
            </p>
          </article>
          <article class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">白牌主机采购</h2>
            <p class="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
              支持采购预装能力的白牌设备，缩短客户交付周期，降低部署与运维的落地门槛。
            </p>
          </article>
          <article class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">自有商城</h2>
            <p class="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
              可逐步构建品牌自有商城，管理商品与购买入口，形成统一销售与交付链路。
            </p>
          </article>
          <article class="rounded-2xl border border-[color:var(--line-soft)] bg-white p-6 shadow-sm">
            <h2 class="text-xl font-semibold text-[color:var(--ink-strong)]">任务市场能力</h2>
            <p class="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]">
              任务市场相关能力将陆续开放，支持围绕需求、服务与交付建立可持续协作生态。
            </p>
          </article>
        </div>

        <div>
          <a class="marketing-primary-button" href="/contact">咨询 OEM 合作</a>
        </div>
      </div>
    </section>
  );
}

export function renderOemPage() {
  const { brandName } = getBrandConfig();
  return renderMarketingShell({
    title: "OEM 白牌合作",
    description: `了解 ${brandName} OEM 能力：品牌定制、白牌主机采购、自有商城和任务市场扩展。`,
    currentPath: "/oem",
    children: <OemPage brandName={brandName} />,
  });
}
