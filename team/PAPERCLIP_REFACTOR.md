# Company × Paperclip 改造说明（阶段一）

目标：在不影响现有“统一运维配置/任务下发”能力的前提下，引入 Paperclip 风格的 Agent 监听与洞察闭环。

## 1. 保留能力（原样）

- 控制台账号与主机关联模型不变（`controllerAddress == walletAddress`）。
- 现有运维指令分发流程不变：
  - `wsl.exec`
  - `clawos.gateway.status`
  - `clawos.gateway.action(restart)`
- Agent 任务协议不破坏，老版本 Agent 仍可继续工作。

## 2. 新增能力（本次已落地）

参考 Paperclip 的 heartbeat + observability 思路，新增：

- 监听事件上报接口：`POST /api/agent/events`
- 洞察查询接口：`GET /api/agent/insights`
- 控制台洞察页：`GET /console/insights`
- 单机详情新增“最近监听事件”列表
- 心跳状态变化自动沉淀事件（`heartbeat.state_changed`）

## 3. 数据模型

新增 `agent_events` 表：

- `id`
- `host_id`
- `event_type`
- `severity` (`info` / `warning` / `error`)
- `title`
- `payload` (JSON string)
- `created_at`

并添加 host+time 与 severity+time 索引，支持按主机与风险快速检索。

## 4. 对齐 Paperclip 的点

- `heartbeats`：保留并增强，状态变化进入事件流。
- `auditability`：事件与审计日志双轨记录。
- `insights`：控制台支持时间窗口聚合（error/warning 排序）。
- `bring-your-own-agent`：只要求心跳与事件协议，兼容多 runtime。

## 5. 下一步建议（阶段二）

1. 增加事件触发器：当 `errorEvents` 超阈值时自动下发诊断任务（如 `wsl.exec` 健康检查）。
2. 增加预算/治理字段：为主机或 agent 设“最大并发任务数、最大每日执行时长”。
3. 增加工单关联：把 `command` 与 `agent_events` 关联到同一个 ticket 维度，形成完整追踪链路。
