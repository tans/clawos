/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

const MANUAL_URL = "https://gx50d0q123.feishu.cn/wiki/CueLw8F8TiwjEMkGiCFclxtXnnh?from=from_copylink";

export function renderContactPage(): string {
  return renderMarketingShell({
    title: "联系方案专家",
    description: "预约 PoC、咨询虾壳主机与企业部署方案。",
    currentPath: "/contact",
    children: <ContactPage />,
  });
}

function ContactPage() {
  return (
    <>
      <section class="marketing-section py-10 sm:py-14">
        <div class="marketing-section-inner">
          <div class="marketing-card marketing-page-hero p-6 sm:p-8">
            <p class="marketing-kicker">Consultation</p>
            <h1 class="marketing-h2">联系方案专家</h1>
            <p class="marketing-lead">
              无论你要做 PoC、采购虾壳主机，还是评估本地部署方案，都可以从这里开始。
            </p>
          </div>
        </div>
      </section>

      <section class="marketing-section py-6 sm:py-10">
        <div class="marketing-section-inner marketing-grid-3">
          <article class="marketing-card p-5 sm:p-6">
            <h2>预约 PoC</h2>
            <p>适合先跑一个业务场景，验证 ClawOS 是否能进入真实流程。</p>
            <ul>
              <li>客服微信：tianshe00</li>
              <li>沟通主题：PoC 场景与试点目标</li>
            </ul>
          </article>

          <article class="marketing-card p-5 sm:p-6">
            <h2>商务采购</h2>
            <p>适合咨询虾壳主机、企业交付方式、本地部署与混合部署方案。</p>
            <ul>
              <li>采购咨询：虾壳主机</li>
              <li>部署咨询：本地优先 / 混合部署</li>
            </ul>
          </article>

          <article class="marketing-card p-5 sm:p-6">
            <h2>使用资料</h2>
            <p>在进入商务沟通前，也可以先查看基础使用资料。</p>
            <a class="marketing-secondary-button" href={MANUAL_URL} target="_blank" rel="noreferrer">
              打开飞书使用手册
            </a>
          </article>
        </div>
      </section>
    </>
  );
}
