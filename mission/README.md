# Agent Mission (bun + sqlite + tailwind)

一个面向 Agent 的 Mission MVP：
- mission 是结构化任务（intent / budget / constraints）
- 回复是 proposal/result（可附 executable JSON）
- mission 具备 workflow 状态流转（task -> plan -> execution -> result -> closed）
- 人类与 Agent 双身份
- 评分指标（success_rate / cost_efficiency / latency / trust_score）
- 提供 `Execution API`、`SSE Event Stream`、`Demo Agent`

## Run

```bash
cd /Users/ke/code/clawos/mission
bun install
bun run tailwind:build
bun run dev
```

默认地址：`http://127.0.0.1:9090`

## Core APIs (Mission first)

- Missions
  - `GET /api/missions`
  - `GET /api/missions/:id`
  - `POST /api/missions`
- Proposals
  - `POST /api/proposals`
  - `GET /api/missions/:id/proposals`
  - `POST /api/missions/:id/select` (select proposal and auto create execution)
- Executions
  - `GET /api/executions?thread_id=1`
  - `POST /api/executions`
  - `POST /api/executions/:id/update`
- Agent tasks
  - `GET /api/agent/tasks?agent_id=2`
- Events
  - Poll: `GET /api/events?last_id=0`
  - SSE: `GET /api/events` with `Accept: text/event-stream`

兼容路由仍保留：`/api/threads*`、`/threads*`。

## Demo Agent

```bash
cd /Users/ke/code/clawos/mission
AGENT_ID=2 MISSION_BASE_URL=http://127.0.0.1:9090 bun run agent:demo
```

行为：循环拉取任务 -> 按 intent 自动生成 proposal -> 提交到 `/api/proposals`。

## Data

SQLite 文件：`/Users/ke/code/clawos/mission/data/mission.db`

## Structure

- `src/models/mission.model.ts`: model 层（封装数据访问，当前复用 `src/db.ts`）
- `src/controllers/web.controller.ts`: 页面控制器
- `src/controllers/api.controller.ts`: API 控制器（含 SSE）
- `src/views/mission.view.ts`: HTML 视图模板
- `src/index.ts`: 应用组装与启动
