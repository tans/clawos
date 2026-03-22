# Company 项目设计补充（App 配置 URL 即可入企）

> 目标：当用户在 App 中仅设置 `company` 的服务 URL 后，当前设备即可完成“加入公司”流程；后续所有管理动作都由 company 后台统一编排与审计。

## 0. 术语说明（避免歧义）

- 本文中的 **Client** 指运行在用户设备上的 **clawos/openclaw 桌面端守护进程（客户端）**，负责与 company 后台 gateway 进行心跳、命令拉取与结果回传。
- 本文中的 Client **不是** “AI Agent（智能体）”。
- 若需指代 AI 能力，建议统一使用“AI 助手 / AI 智能体”字样，避免与设备代理混淆。

---

## 1. 目标与范围

### 1.1 业务目标
- **零手工配对（最简接入）**：用户只需在 App 中填写 company URL，无需手动复制复杂 token。
- **后台统一管理**：设备加入公司后，所有状态查看、命令下发、审计追踪在 company 后台完成。
- **可扩展协议**：兼容未来多版本 Client / Company Gateway 共存。

### 1.2 本阶段范围（P0）
- App 支持配置并持久化 `company.url`。
- Client 首次连接 company gateway 时自动完成注册/绑定。
- company 后台可管理已加入设备（在线状态、命令、结果、审计）。
- 核心动作：查看状态、查看 token 使用量、修改配置、重启 openclaw。

### 1.3 非目标
- 复杂组织架构与细粒度 RBAC（后续迭代）。
- 全自动证书体系（P0 先使用签名 token + HTTPS）。

---

## 2. 总体架构

```text
App(Desktop)                          Company(Control Plane)
┌────────────────┐    HTTPS API      ┌─────────────────────────┐
│ Settings: URL  │ ───────────────▶  │ /api/gateway/*          │
│ Client Runtime │ ◀───────────────  │ /api/console/*          │
│ Local Gateway  │   command/result  │ DB + Audit + Queue      │
└────────────────┘                    └─────────────────────────┘
```

### 2.1 关键组件
- **App/Webview 设置页**：录入 company URL、显示接入状态。
- **Client 服务任务**：读取 `company.url`，周期 heartbeat + 轮询命令。
- **Company Gateway API**：`hello/heartbeat/commands/result`。
- **Company Console API + 页面**：设备管理、命令下发、审计展示。

---

## 3. “只配 URL 即入企”流程设计

## 3.1 首次接入流程
1. 用户在 App 设置 `company.url=https://company.example.com`。
2. App 生成并持久化本机 `device_id`（UUID）与 `device_fingerprint`（硬件/系统摘要）。
3. Client 调用 `POST /api/gateway/hello`，上报：
   - `device_id`
   - `device_name`
   - `client_version`
   - `fingerprint`
   - `capabilities`
4. Company 执行匹配策略：
   - 若设备已存在：更新最后上线信息并返回会话凭据。
   - 若新设备：根据“自动接纳策略”处理：
     - `auto_accept=true`：自动加入默认公司/空间；
     - `auto_accept=false`：进入待审批队列，返回 `pending_approval`。
5. App 拿到 `client_session_token` 后进入正常心跳与命令轮询。

## 3.2 接纳策略（建议）
- 默认开发/内网环境：`auto_accept=true`，降低接入门槛。
- 生产环境：`auto_accept=false`，控制台审批后生效。

## 3.3 安全基线
- 强制 HTTPS（非 localhost 环境）。
- 会话 token 短期有效 + 可轮换。
- heartbeat/commands/result 全链路带 `Authorization: Bearer <client_session_token>`。
- 首次注册时记录来源 IP、UA、fingerprint，供审计与风控。

---

## 4. 数据模型（建议）

## 4.1 核心表

### `companies`
- `id`
- `name`
- `created_at`

### `devices`
- `id`
- `company_id`
- `device_id`（客户端生成，唯一）
- `device_name`
- `fingerprint`
- `client_version`
- `status`（`online/offline/pending`）
- `last_seen_at`
- `created_at`
- `updated_at`

### `client_sessions`
- `id`
- `device_id`（FK）
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`

### `commands`
- `id`
- `company_id`
- `device_id`
- `type`
- `payload_json`
- `status`（`pending/running/succeeded/failed/canceled`）
- `requested_by`
- `requested_at`
- `started_at`
- `finished_at`
- `dedupe_key`（防重）

### `command_results`
- `id`
- `command_id`
- `success`
- `exit_code`
- `stdout_summary`
- `stderr_summary`
- `raw_json`
- `reported_at`

### `token_usage_samples`
- `id`
- `company_id`
- `device_id`
- `timestamp`
- `tokens`
- `raw_json`

### `audit_logs`
- `id`
- `company_id`
- `actor`
- `action`
- `target_type`
- `target_id`
- `summary`
- `meta_json`
- `created_at`

---

## 5. API 设计（P0）

## 5.1 Client 侧 API

### `POST /api/gateway/hello`
- 用途：首次注册/重连鉴权。
- 返回：
  - `accepted=true` + `client_session_token`
  - 或 `accepted=false` + `reason=pending_approval`

### `POST /api/gateway/heartbeat`
- 用途：上报在线状态 + 简要运行信息。
- 入参：`device_id`, `metrics`, `timestamp`。

### `GET /api/gateway/commands?device_id=...&limit=...`
- 用途：Client 拉取待执行命令。
- 返回：`pending` 命令列表。

### `POST /api/gateway/commands/:id/result`
- 用途：命令执行结果回传。
- 入参：`success/exit_code/stdout/stderr/raw`。

## 5.2 Console 侧 API

### `GET /api/console/devices`
- 设备列表 + 在线状态 + 最后心跳。

### `POST /api/console/devices/:id/actions/restart`
- 下发 `clawos.gateway.action(restart)`。

### `POST /api/console/devices/:id/actions/config-set`
- 下发 `clawos.gateway.config.set`。

### `GET /api/console/devices/:id/token-usage`
- 查询 token 使用量时序。

### `GET /api/console/commands/:id`
- 查询命令状态与结果。

---

## 6. 命令编排与幂等

## 6.1 命令类型
- `clawos.gateway.status`
- `clawos.gateway.action`（`restart`）
- `clawos.gateway.config.get`
- `clawos.gateway.config.set`
- `clawos.gateway.usage.tokens.get`

## 6.2 幂等策略
- 同设备同动作短窗口（如 30s）使用 `dedupe_key=device_id:type:hash(payload):time_bucket`。
- 命中重复请求时直接返回已有命令 ID。

## 6.3 超时与重试
- `pending` 超过阈值（如 2min）可标记 `timeout`。
- `running` 超时后由后台判定失败并写审计。
- 控制台支持“重新下发”并关联原命令。

---

## 7. App 端改造点（建议落地到 clawos/app）

1. 设置页新增字段：`company.url`（必填校验：URL 格式 + https）。
2. 本地配置持久化：写入现有 settings/store。
3. Client 后台任务：
   - 启动时检测 `company.url`，无值则跳过。
   - 有值则执行 `hello -> heartbeat loop -> command poll loop`。
4. 状态反馈：设置页展示
   - `Connected / Pending Approval / Auth Failed / Offline`。
5. 日志：将接入失败原因明确到可诊断级别。

---

## 8. Company 后台改造点

1. `gateway.controller`：补齐 `hello/heartbeat/commands/result` 语义与校验。
2. `console.controller`：提供设备管理、命令下发、结果查询。
3. `audit.controller`：记录高风险动作（配置修改、重启）。
4. `company.model`：增加设备、会话、命令、审计相关数据访问方法。
5. 控制台页面：
   - 设备列表页
   - 设备详情页（状态、token、命令历史）
   - 操作面板（重启、配置修改）

---

## 9. 实施安排（建议 4 个迭代）

## Iteration 1（第 1 周）：协议与基础链路
- 定义 Client/Gateway/Console API 契约（字段可选策略、错误码）。
- 实现 `hello + heartbeat`，打通设备在线状态。
- App 设置页支持 `company.url` 并落库。
- 交付标准：设置 URL 后能在 company 看到设备上线。

## Iteration 2（第 2 周）：命令队列闭环
- 实现 `commands` 下发、拉取、结果回传。
- 支持 `gateway.status` 与 `restart` 两类命令。
- 增加去重键与基本超时处理。
- 交付标准：后台发起重启，Client 执行并可见结果。

## Iteration 3（第 3 周）：配置管理与 token 可视化
- 新增 `config.set/get` 命令链路。
- 新增 `token_usage_samples` 存储与查询接口。
- 控制台设备详情页展示 token 趋势与配置修改记录。
- 交付标准：可远程改配置并审计，可查看 token 数据。

## Iteration 4（第 4 周）：稳定性与安全增强
- 审批流（pending_approval）与会话轮换。
- 命令重试、告警、错误分级。
- 补齐集成测试与回归测试。
- 交付标准：P0 全链路稳定，异常场景可观测可恢复。

---

## 10. 验收指标（DoD）
- 设置 URL 后 1 分钟内设备可出现在 company 控制台。
- 在线状态刷新延迟 < 30s。
- 重启动作成功率（可控环境）> 95%。
- 配置修改动作 100% 产生审计记录。
- 所有命令具备可追踪生命周期（请求、执行、结果）。

---

## 11. 风险与缓解
- **版本兼容风险**：字段新增导致旧 Client 失败。
  - 缓解：新增字段保持可选；服务端容错解析。
- **误操作风险**：误触发重启/配置变更。
  - 缓解：二次确认 + 审计 + 短窗口防重。
- **网络抖动风险**：命令状态不一致。
  - 缓解：命令状态机 + 超时补偿 + 幂等回传。

---

## 12. 后续扩展方向
- 多组织/多环境（dev/staging/prod）隔离。
- 细粒度权限模型（RBAC/ABAC）。
- 批量运维编排（灰度配置、批量重启）。
- 指标接入统一观测平台（Prometheus/OpenTelemetry）。
