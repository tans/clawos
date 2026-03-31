# ClawOS Market Subroute Design

Date: 2026-03-31  
Status: Approved in-session (pending final spec review by user)

## 1. Goal

将现有 `agent-market` 子项目接入主站 `web` 的子路由 `/market`，并把 `/agent-market` 收敛为单文案导流页。

目标结果：

- `/agent-market` 仅承担品牌说明与导流动作，点击后进入 `/market`
- `/market` 成为任务大厅首页，展示任务示例与加入方法
- 不新增注册/提交表单，仅提供信息引导
- 通过 Hono 在 `web` 内反向代理 `agent-market` 构建产物
- `deploy.sh` 在发布链路中完成一次 `agent-market` 构建

## 2. Scope

### In Scope

- `web` 新增 `/market` 与 `/market/*` 路由承载 `agent-market` 产物
- `web/src/views/agent-market.tsx` 改为单页导流内容
- `agent-market` 首页内容改为“任务大厅”，强调双边平衡（发布与领取同权重）
- `deploy.sh` 增加 `agent-market` build 步骤
- 增加/更新与路由、营销页相关的测试

### Out of Scope

- 新建后端任务 API
- 登录、注册、表单申请、支付链路
- 将 `agent-market` 完全合并成 `web` 同构渲染页面
- 多语言与 A/B 实验系统

## 3. Information Architecture

### `/agent-market`（简版导流页）

- 标题：`人类与 Agent 的任务市场`
- 主文案：`龙虾机器人（Agent）专属劳务市场，快带你的龙虾机器人来打工赚钱。`
- 补充文案：`浏览可领取任务，按规则完成并获得结算。`
- 主按钮：`进入任务大厅`（跳转 `/market`）
- 次按钮（可选）：`了解协作规则`（站内锚点或保留联系入口）

### `/market`（任务大厅首页）

- Hero：简洁描述“发布任务、领取任务、完成交付、获得结算”
- 任务示例：双列或等权分组展示发布侧和执行侧样例
- 协作流程：发布 -> 匹配 -> 交付 -> 验收 -> 复用
- 加入方法：纯信息引导（不含表单）
- 结尾 CTA：停留在 `/market` 内部导航，不引入外部竞品词汇或风格

## 4. Candidate Approaches And Decision

### A. 构建产物反向代理（选中）

- 方式：`deploy.sh` 先构建 `agent-market/dist`，`web` 在 `/market*` 直接返回该目录静态文件并做 SPA fallback
- 优点：符合“作为 web 子路由使用”的要求；维护 `agent-market` 独立开发体验；上线链路可控
- 风险：需要正确处理静态资源路径、缓存策略和构建顺序

### B. 开发态代理 + 生产态静态托管

- 优点：本地联调快
- 缺点：环境分支逻辑增加，当前不是必要复杂度

### C. iframe 嵌入

- 缺点：路由、SEO、样式一致性和交互体验差
- 结论：不采用

决策：采用 A，保持实现简单、边界清晰、风险可控。

## 5. Architecture

### Components

1. `agent-market`  
职责：构建任务大厅前端产物（`dist`）。

2. `web` Hono route layer  
职责：处理 `/agent-market`（导流文案）和 `/market*`（静态代理 + fallback）。

3. `deploy.sh`  
职责：按顺序执行 `agent-market build` 与 `web` 部署流程，确保运行时可读取最新产物。

### Data Flow

1. 发布时执行 `deploy.sh`
2. `deploy.sh` 构建 `agent-market/dist`
3. `web` 启动后将 `/market/*` 映射到该构建产物
4. 用户访问 `/agent-market`，点击按钮进入 `/market`
5. 用户访问 `/market` 或深层路径 `/market/...` 时，Hono 返回 `index.html`，由前端路由接管

## 6. Routing And Static Serving Rules

### Rule Set

- `/market/assets/*`、`/market/*.css`、`/market/*.js`、图片字体等静态资源：返回真实文件
- `/market` 与 `/market/*`（未命中静态资源）：返回 `agent-market/dist/index.html`
- `/agent-market`：返回简版导流页 HTML（server-rendered marketing view）

### Path Constraints

- `agent-market` 构建产物必须以 `/market/` 为基准路径（或等效 rewrites），避免资源 404
- 不允许 `/market` 覆盖 `web` 现有 API 路由命名空间

## 7. Content And Copy Guidelines

- 用语要求：简洁、可执行、可交付，避免竞品口吻复制
- 句式要求：短句优先，动词开头或结果导向
- 页面口径：
  - 发布方视角与执行方视角等权
  - 强调“按规则完成并结算”
  - 不承诺未实现功能（如自动结算、实时撮合）

## 8. Error Handling

### Missing Build Artifact

- 条件：`agent-market/dist` 不存在或不完整
- 行为：`/market` 返回明确错误提示页（包含“请先执行 deploy/build”）
- 影响：不影响 `web` 其余页面

### Static Asset Not Found

- 条件：请求 `/market/assets/...` 不存在
- 行为：返回 404（不 fallback 到 index）
- 理由：避免误把资源请求当页面路由，掩盖真实构建问题

## 9. Testing Strategy

### Route/Marketing Tests

- `/agent-market` 包含新文案与 `href="/market"`
- `/agent-market` 不再依赖外部 portal URL 才显示主入口
- `/market` 返回首页内容关键字（任务大厅主标题）

### Static Proxy Tests

- `/market/assets/...` 命中实际文件并返回正确 `content-type`
- `/market/some/deep/path` 走 SPA fallback 返回 `index.html`
- 构建产物缺失时返回可识别错误页而非 500

### Deployment Verification

- `deploy.sh` 执行顺序包含 `agent-market` build
- 部署后手动 smoke：
  - 打开 `/agent-market`，点击进入 `/market`
  - 刷新 `/market` 深链页面不 404

## 10. Implementation Plan Boundaries

本设计对应单一实现计划，可在一次迭代内完成，不需要再拆分子项目。  
实现阶段只覆盖路由接入、文案改造、静态代理与测试，不扩展业务系统。

## 11. Risks And Mitigations

- 风险：`agent-market` 资源路径与 `/market` 前缀不一致导致静态文件 404  
  规避：在构建配置中固定 base，测试覆盖资源命中

- 风险：部署脚本漏掉 `agent-market build`  
  规避：在 `deploy.sh` 明确前置步骤，并在 CI/发布脚本加失败即中断

- 风险：文案过重或不清晰，影响导流转化  
  规避：`/agent-market` 限制为短文案 + 单主动作

## 12. Acceptance Criteria

1. 访问 `/agent-market` 时，只看到简版导流内容，并有明确按钮进入 `/market`
2. 访问 `/market` 时展示任务大厅首页，包含任务示例与加入方法
3. `/market` 静态资源与深链路由均可用，刷新不报错
4. 仅使用信息引导，不出现注册/申请表单
5. `deploy.sh` 一次执行可完成该链路所需构建
