# clawos-company

`clawos` Team 云端控制面工程，已调整为**前后端分离**架构：
- 后端：`bun + hono + sqlite`（`team/src`）
- 前端：`React + Vite + shadcn 风格组件`（`team/frontend`）

## 文档
- 配置与启动文档：[/Users/ke/code/clawos/company/CONFIG_AND_START.md](/Users/ke/code/clawos/company/CONFIG_AND_START.md)
- 协议文档：[/Users/ke/code/clawos/cloud-remote-control-protocol.md](/Users/ke/code/clawos/cloud-remote-control-protocol.md)
- HTTP 实现补充：[`company/AGENT_HTTP_PROTOCOL.md`](./AGENT_HTTP_PROTOCOL.md)

## 已实现能力
- 控制台账号：手机号 + 密码登录。
- 控制台主机列表：按账号钱包地址过滤可控主机。
- 单机控制页：
  - 下发 `wsl.exec`
  - 下发 `clawos.gateway.status`
  - 下发 `clawos.gateway.action(restart)`
  - 查看最近任务与结果
- Agent 接口：
  - 上线注册 `POST /api/agent/hello`
  - 心跳上报 `POST /api/agent/heartbeat`
  - 监听事件上报 `POST /api/agent/events`
  - 拉取任务 `GET /api/agent/commands`
  - 拉取主机洞察 `GET /api/agent/insights`
  - 回传结果 `POST /api/agent/commands/:id/result`
- Agent 洞察：
  - 控制台聚合页：`GET /console/insights`
  - 单机详情页展示最近监听事件（心跳状态变化 + 主动上报事件）

## 本地运行（前后端分离）

```bash
cd team
bun install
# 终端1：启动后端 API
bun run dev:backend

# 终端2：启动前端
cd frontend
bun install
bun run dev
```

默认端口：
- 后端 API：`8787`
- 前端开发服务：`5178`

访问：
- 前端应用: [http://127.0.0.1:5178](http://127.0.0.1:5178)
- Team 模块 API: [http://127.0.0.1:8787/api/team/modules](http://127.0.0.1:8787/api/team/modules)
- 健康检查: [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health)

生产部署时，后端会优先从 `team/frontend/dist` 提供 `/app` 页面静态资源。

## 数据库
- 默认路径：`company/data/company.db`
- 可通过环境变量覆盖：`COMPANY_DB_PATH=/path/to/company.db`
