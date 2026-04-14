/** @jsxImportSource hono/jsx */

import { renderMarketingShell } from "./marketing-shell";

// 开机使用 - 步骤指南
const startupSteps = [
  {
    step: 1,
    title: "启动安装程序",
    content: "右键以管理员身份运行安装程序，然后一直点击下一步完成安装。",
    image: null,
  },
  {
    step: 2,
    title: "关闭安装窗口",
    content: "安装完成后，关闭此窗口（不要运行这个）。",
    image: "/public/storage/assets/help/page1_IM20.jpg",
  },
  {
    step: 3,
    title: "打开程序",
    content: "以管理员身份打开桌面上的 OpenClaw 程序（不是安装包）。",
    image: "/public/storage/assets/help/page2_IM24.jpg",
  },
  {
    step: 4,
    title: "等待 OpenClaw 下载",
    content: "如果系统没有安装 Windows 版本的 OpenClaw，会自动下载离线安装包，这个过程会比较久，请耐心等待。",
    image: "/public/storage/assets/help/page3_IM28.jpg",
  },
  {
    step: 5,
    title: "初始化 OpenClaw",
    content: "OpenClaw 下载完成后会进行初始化，等待即可。过程会自动重启 ClawOS。",
    image: "/public/storage/assets/help/page4_IM32.jpg",
  },
  {
    step: 6,
    title: "等待完成",
    content: "等待到显示相应画面即可完成初始化。",
    image: "/public/storage/assets/help/page4_IM31.jpg",
  },
  {
    step: 7,
    title: "打开 OpenClaw",
    content: "当终端文字输出到和截图中差不多时，即可点击打开 OpenClaw，会自动跳转到浏览器。",
    image: "/public/storage/assets/help/page5_IM37.jpg",
  },
  {
    step: 8,
    title: "登录 OpenClaw",
    content: "把 Token 令牌复制进去，即可登录 OpenClaw。",
    image: "/public/storage/assets/help/page5_IM35.jpg",
  },
  {
    step: 9,
    title: "注意事项",
    content: "进入后千万不要点击更新按钮！更新后可能无法使用。如果更新了，请在终端命令行运行回退命令：openclaw update --tag 2026.3.28",
    image: null,
  },
];

// 大模型配置
const llmConfig = [
  {
    step: 1,
    title: "进入 API 配置",
    content: "如果有自己的 API，可以通过通用模板添加，选择主模型并滑动启用按钮。",
    image: "/public/storage/assets/help/page6_IM41.jpg",
  },
  {
    step: 2,
    title: "配置模型",
    content: "配置模型完成后，回到 OpenClaw 刷新页面，即可看到对应的模型。第一次对话可能会比较久，请耐心等待。",
    image: "/public/storage/assets/help/page7_IM45.jpg",
  },
  {
    step: 3,
    title: "支持的模型类型",
    content: "OpenClaw 支持主流的大语言模型，包括 GPT、Claude、通义千问、文心一言等。请确保您有有效的 API 密钥。",
    image: null,
  },
  {
    step: 4,
    title: "主模型选择",
    content: "选择一个模型作为主模型，主模型将负责核心的对话和任务处理。您可以通过滑动条启用或禁用特定模型。",
    image: null,
  },
];

// 通讯渠道配置
const channelConfig = [
  {
    step: 1,
    title: "企业微信配置",
    content: "企业微信：第一次使用需要点击下载。先不要扫码，第一次下载会默认通知你扫码或填入 ID 和 Secret，完成后启用按钮打开，保存并重启 OpenClaw 即可。",
    image: "/public/storage/assets/help/page8_IM48.jpg",
  },
  {
    step: 2,
    title: "钉钉配置",
    content: "钉钉：前往钉钉开放平台创建应用，获取 AppKey 和 AppSecret。在 OpenClaw 中填入这些信息，启用后即可接收和发送消息。",
    image: null,
  },
  {
    step: 3,
    title: "飞书配置",
    content: "飞书：前往飞书开放平台创建企业应用，配置机器人功能。获取 App ID 和 App Secret 后在 OpenClaw 中配置即可。",
    image: null,
  },
  {
    step: 4,
    title: "微信网页版（Web微信）",
    content: "通过网页版微信接入，需要微信账号授权。请注意网页版微信有登录限制和功能限制。",
    image: null,
  },
];

// 技能配置
const skillConfig = [
  {
    step: 1,
    title: "技能市场",
    content: "访问 Agent 市场获取更多技能。OpenClaw 支持丰富的技能扩展，可以根据需求添加不同的能力。",
    image: null,
  },
  {
    step: 2,
    title: "内置技能",
    content: "OpenClaw 预置了多种常用技能，包括：代码助手、文档处理、数据分析、图片识别等。",
    image: null,
  },
  {
    step: 3,
    title: "自定义技能",
    content: "您可以通过编写 Prompt 或接入外部 API 来创建自定义技能。技能可以复用并分享给团队其他成员。",
    image: null,
  },
  {
    step: 4,
    title: "技能启用管理",
    content: "在设置中管理已启用的技能，可以随时开启或关闭特定技能来调整 Agent 的能力范围。",
    image: null,
  },
];

const helpCategories = [
  { id: "startup", title: "开机使用", steps: startupSteps },
  { id: "llm", title: "大模型配置", steps: llmConfig },
  { id: "channel", title: "通讯渠道配置", steps: channelConfig },
  { id: "skill", title: "技能配置", steps: skillConfig },
];

function HelpContent() {
  return (
    <div class="max-w-6xl mx-auto px-4 py-16">
      <div class="text-center mb-12">
        <h1 class="text-4xl font-display font-bold text-ink-strong mb-4">
          使用帮助
        </h1>
        <p class="text-lg text-ink-soft">
          快速上手 OpenClaw 龙虾主机
        </p>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        {/* 侧边导航 */}
        <nav class="lg:w-64 flex-shrink-0">
          <div class="bg-surface-soft rounded-xl p-4 border border-line-soft sticky top-8">
            <h3 class="text-sm font-semibold text-ink-faint uppercase tracking-wider mb-4 px-3">
              帮助分类
            </h3>
            <ul class="space-y-1">
              {helpCategories.map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`#${cat.id}`}
                    class="category-link block px-3 py-2 rounded-lg text-ink-normal hover:bg-accent/10 hover:text-accent transition-colors"
                    data-category={cat.id}
                  >
                    {cat.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 主内容区 */}
        <div class="flex-1 space-y-12">
          {helpCategories.map((category) => (
            <section
              key={category.id}
              id={category.id}
              class="scroll-mt-8"
            >
              <h2 class="text-2xl font-display font-bold text-ink-strong mb-6 pb-3 border-b border-line-soft">
                {category.title}
              </h2>
              <div class="space-y-6">
                {category.steps.map((item) => (
                  <div
                    key={item.step}
                    class="bg-surface-soft rounded-xl p-6 border border-line-soft"
                  >
                    <div class="flex items-start gap-4">
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-sm">
                        {item.step}
                      </div>
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold text-ink-strong mb-2">
                          {item.title}
                        </h3>
                        <p class="text-ink-normal leading-relaxed whitespace-pre-line">
                          {item.content}
                        </p>
                        {item.image && (
                          <div class="mt-4 rounded-lg overflow-hidden border border-line-soft">
                            <img
                              src={item.image}
                              alt={`${item.title} 示例图`}
                              class="max-w-full h-auto"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* 底部联系 */}
      <div class="mt-12 p-6 bg-accent/10 rounded-xl border border-accent/20">
        <h4 class="text-lg font-semibold text-ink-strong mb-2">
          遇到问题？
        </h4>
        <p class="text-ink-soft mb-4">
          如果你在使用过程中遇到任何问题，欢迎联系我们获取帮助。
        </p>
        <a
          href="/contact"
          class="inline-flex items-center gap-2 text-accent hover:text-accent-hover font-medium transition-colors"
        >
          联系我们
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export function renderHelpPage() {
  return renderMarketingShell({
    title: "使用帮助",
    description: "OpenClaw 龙虾主机使用指南，帮助您快速上手配置和使用。",
    currentPath: "/help",
    children: <HelpContent />,
  });
}