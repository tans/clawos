# company 模块协作说明（agents.md）

本文档面向在 `company/` 目录内工作的 AI/开发者，约束实现方向与协作方式。

## 模块定位
`company` 是 `clawos` 的云端控制面（Control Plane），负责：
- 管理用户与可控主机的关系。
- 接收桌面端 Agent 上报状态并持久化。
- 向 Agent 下发控制命令并追踪执行结果。
- 提供控制台页面给用户查看状态、资源消耗与执行操作。

技术栈：`bun + hono + sqlite`。

---

## 当前优先级（P0）
围绕“云端 company 可以查看 openclaw 运行情况、token 使用量，同时可修改配置并重启 openclaw”实现闭环。

### P0 必须覆盖的能力
1. **运行状态可见**
   - 控制台可看到目标主机 openclaw/gateway 的在线状态、最近心跳、最近一次状态检查结果。
   - 状态来源应区分：
     - Agent 心跳（在线性）
     - 主动命令结果（例如 `clawos.gateway.status`）

2. **Token 使用量可见**
   - 支持展示可解析的 token 指标（至少包含时间戳 + 数值 + 来源主机）。
   - 若上游暂未提供完整结构，先按“原始上报 + 结构化字段（可空）”双轨存储，避免协议变更导致数据丢失。

3. **配置可修改**
   - 云端下发“修改配置”命令，Agent 在本地执行并返回结果。
   - 需要记录：变更目标、变更内容摘要、执行状态、错误信息。
   - 高风险配置修改必须具备最小审计信息（操作者、时间、主机、命令摘要）。

4. **可远程重启 openclaw**
   - 云端可下发 `restart` 动作。
   - 需有防重复触发机制（短时间内幂等/限流）与结果回传。

---

## 推荐命令模型
统一采用任务队列模型（command -> agent pull -> result callback）：
- 下发：写入 `command` 记录（`pending`）
- 拉取：Agent 从 `/api/agent/commands` 获取任务
- 执行：Agent 本地调用 clawos/openclaw 命令
- 回传：`/api/agent/commands/:id/result` 更新为 `succeeded/failed`

建议命令类型（可扩展）：
- `clawos.gateway.status`
- `clawos.gateway.action`（如 `restart`）
- `clawos.gateway.config.get`
- `clawos.gateway.config.set`
- `clawos.gateway.usage.tokens.get`

---

## 数据与审计要求
1. **命令可追踪**：谁在何时对哪台主机下发了什么命令。
2. **结果可追踪**：成功/失败、退出码、标准输出摘要、错误摘要。
3. **关键动作审计**：重启、配置修改必须可追溯。
4. **时间统一**：统一存储 UTC 时间戳（展示层再做本地化）。

---

## API/页面实现建议（与现有结构对齐）
- 控制台控制器优先补齐：
  - 查看状态
  - 查看 token 使用量
  - 提交配置修改
  - 触发重启
- Agent 控制器保持轻量：
  - hello / heartbeat / commands / result
- 视图层先保证“可用、可诊断”，样式优化可后置。

---

## 开发约定
1. **先定义协议，再写实现**：新增命令类型需先明确 request/response 字段。
2. **向后兼容**：Agent 与 Company 可能不同版本并存；新增字段应可选。
3. **错误信息可读**：返回给控制台的错误要可定位问题（不要只返回 `failed`）。
4. **最小变更原则**：优先复用现有 `controller/model/view` 结构。

---

## 非目标（当前阶段不优先）
- 大规模多租户权限系统重构
- 复杂报表与 BI
- 全量自动化运维编排

先保证 P0 链路打通与稳定，再迭代增强。
