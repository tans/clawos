# clawos-team

`team/` 现在是一个面向 OEM / 多公司的 Team Chat 产品首版：
- 后端：`Bun + Hono + SQLite`
- 前端：`React 19 + Vite + Vitest`
- 主入口：`/app`
- 后端静态托管：`team/frontend/dist`

## Team V1 功能范围
- 公司级品牌配置：品牌名、Logo、主题色、欢迎语
- Gateway 连接测试与主 Agent 同步
- 团队配置：每个 team 绑定一个主 Agent
- 邀请链接：按公司发放、可设置失效时间和使用上限
- 成员进入：通过 invite token + nickname 建立 session
- 持久会话：成员可创建并继续 team conversation
- 消息与附件：支持文本、图片、文件消息以及 agent 流式回复

## Team V1 本地工作流

1. 安装后端依赖：`cd /Users/ke/code/clawos/team && bun install`
2. 启动后端：`cd /Users/ke/code/clawos/team && bun run dev:backend`
3. 安装前端依赖：`cd /Users/ke/code/clawos/team/frontend && bun install`
4. 启动前端：`cd /Users/ke/code/clawos/team/frontend && bun run dev`
5. 打开 `http://127.0.0.1:5178/app`

## 操作顺序

1. Admin setup: company -> gateway -> agents -> teams -> invites
2. Business flow: invite link -> nickname -> conversation -> text/image/file send

## 关键路径

- 前端 SPA：`http://127.0.0.1:5178/app`
- 后端健康检查：`http://127.0.0.1:8787/health`
- Admin API：`http://127.0.0.1:8787/api/team/admin/...`
- Chat API：`http://127.0.0.1:8787/api/team/chat/...`

## 生产说明

- 先构建前端：`cd /Users/ke/code/clawos/team/frontend && bun run build`
- 后端会从 `team/frontend/dist` 直接提供 `/app` 和 `/app/assets/*`
- SPA 深链例如 `/app/invite/:token` 会回落到 `index.html`
- 老入口 `/console/login`、`/console/register`、`/console/companies/new` 已迁移到 `/app/*` 并保留重定向兼容

## 验证命令

- 后端测试：
  `cd /Users/ke/code/clawos/team && bun test test/models/team-v1-models.test.ts test/api/team-admin-api.test.ts test/api/team-chat-api.test.ts test/runtime/team-runtime.service.test.ts`
- 前端测试：
  `cd /Users/ke/code/clawos/team/frontend && bun run test`
- 前端构建：
  `cd /Users/ke/code/clawos/team/frontend && bun run build`
