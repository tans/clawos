# OpenClaw Gateway Protocol 简要对接文档（含方法/事件参数）

适用范围：
- OpenClaw Docs: `Gateway Runbook` + `Gateway Protocol`
- OpenClaw 源码（`main` 分支）中的 Gateway 方法与事件清单
- 协议版本：`PROTOCOL_VERSION = 3`

## 1. 接入目标
通过 WebSocket（JSON 文本帧）接入 OpenClaw Gateway，完成：
- 控制面请求（RPC）
- 实时事件订阅（event stream）
- 节点能力调用（node invoke）
- 配对与审批流协作（pairing / exec approvals）

## 2. 连接与握手
1. 默认地址：`ws://127.0.0.1:18789`
2. 首个请求必须是 `connect`
3. Gateway 可能先发事件 `connect.challenge`（含 `nonce`）
4. `connect` 常用参数：
- `minProtocol` / `maxProtocol`: 协议版本协商范围
- `client`: `{ id, version, platform, mode, displayName?, deviceFamily?, modelIdentifier?, instanceId? }`
- `role`: `operator | node`
- `scopes`: operator 权限范围
- `caps/commands/permissions`: node 能力声明
- `auth`: `{ token?, password? }`
- `device`: `{ id, publicKey, signature, signedAt, nonce? }`
- `locale?` / `userAgent?`
5. 成功响应：`res.ok=true` 且 `payload.type="hello-ok"`
- `features.methods`: 当前连接可用方法列表
- `features.events`: 当前连接可订阅事件列表
- `snapshot`: 初始状态快照（presence/health/stateVersion）
- `auth.deviceToken`: 可复用设备 token（若返回）

## 3. 消息模型
- 请求帧：`{ type:"req", id, method, params? }`
- 响应帧：`{ type:"res", id, ok, payload?, error? }`
- 事件帧：`{ type:"event", event, payload?, seq?, stateVersion? }`

说明：
- `error` 结构：`{ code, message, details?, retryable?, retryAfterMs? }`
- 所有有副作用调用建议带幂等键（例如 `idempotencyKey`）

## 4. Gateway 方法（含参数）
注：以 `hello-ok.features.methods` 为准；下面为当前实现中的完整基线方法。

### 4.1 核心与系统
- `connect`（仅握手首包可用）: 见第 2 节
- `health`: `{ probe?: boolean }`
- `status`: `{}`
- `system-presence`: `{}`
- `system-event`: `{ text: string, deviceId?, instanceId?, host?, ip?, mode?, version?, platform?, deviceFamily?, modelIdentifier?, lastInputSeconds?, reason?, roles?: string[], scopes?: string[], tags?: string[] }`
- `last-heartbeat`: `{}`
- `set-heartbeats`: `{ enabled: boolean }`
- `wake`: `{ mode: "now" | "next-heartbeat", text: string }`

### 4.2 消息、Agent、Chat
- `send`: `{ to, message, mediaUrl?, mediaUrls?, gifPlayback?, channel?, accountId?, sessionKey?, idempotencyKey }`
- `agent`: `{ message, agentId?, to?, replyTo?, sessionId?, sessionKey?, thinking?, deliver?, attachments?, channel?, replyChannel?, accountId?, replyAccountId?, threadId?, groupId?, groupChannel?, groupSpace?, timeout?, lane?, extraSystemPrompt?, idempotencyKey, label?, spawnedBy? }`
- `agent.identity.get`: `{ agentId?, sessionKey? }`
- `agent.wait`: `{ runId, timeoutMs? }`
- `chat.history`: `{ sessionKey, limit?: 1..1000 }`
- `chat.send`: `{ sessionKey, message, thinking?, deliver?, attachments?, timeoutMs?, idempotencyKey }`
- `chat.abort`: `{ sessionKey, runId? }`
- `browser.request`: `{ method: "GET"|"POST"|"DELETE", path, query?, body?, timeoutMs? }`

### 4.3 会话
- `sessions.list`: `{ limit?, activeMinutes?, includeGlobal?, includeUnknown?, includeDerivedTitles?, includeLastMessage?, label?, spawnedBy?, agentId?, search? }`
- `sessions.preview`: `{ keys: string[], limit?, maxChars? }`
- `sessions.patch`: `{ key, label?, thinkingLevel?, verboseLevel?, reasoningLevel?, responseUsage?, elevatedLevel?, execHost?, execSecurity?, execAsk?, execNode?, model?, spawnedBy?, sendPolicy?, groupActivation? }`
- `sessions.reset`: `{ key }`
- `sessions.delete`: `{ key, deleteTranscript? }`
- `sessions.compact`: `{ key, maxLines? }`

### 4.4 节点与配对
- `node.pair.request`: `{ nodeId, displayName?, platform?, version?, coreVersion?, uiVersion?, deviceFamily?, modelIdentifier?, caps?, commands?, remoteIp?, silent? }`
- `node.pair.list`: `{}`
- `node.pair.approve`: `{ requestId }`
- `node.pair.reject`: `{ requestId }`
- `node.pair.verify`: `{ nodeId, token }`
- `node.rename`: `{ nodeId, displayName }`
- `node.list`: `{}`
- `node.describe`: `{ nodeId }`
- `node.invoke`: `{ nodeId, command, params?, timeoutMs?, idempotencyKey }`
- `node.invoke.result`（node 侧回传结果）: `{ id, nodeId, ok, payload?, payloadJSON?, error?: { code?, message? } }`
- `node.event`（node 侧上报事件）: `{ event, payload?, payloadJSON? }`

### 4.5 设备配对与设备 token
- `device.pair.list`: `{}`
- `device.pair.approve`: `{ requestId }`
- `device.pair.reject`: `{ requestId }`
- `device.token.rotate`: `{ deviceId, role, scopes?: string[] }`
- `device.token.revoke`: `{ deviceId, role }`

### 4.6 配置、审批、向导
- `config.get`: `{}`
- `config.set`: `{ raw, baseHash? }`
- `config.patch`: `{ raw, baseHash?, sessionKey?, note?, restartDelayMs? }`
- `config.apply`: `{ raw, baseHash?, sessionKey?, note?, restartDelayMs? }`
- `config.schema`: `{}`
- `exec.approvals.get`: `{}`
- `exec.approvals.set`: `{ file, baseHash? }`
- `exec.approvals.node.get`: `{ nodeId }`
- `exec.approvals.node.set`: `{ nodeId, file, baseHash? }`
- `exec.approval.request`: `{ id?, command, cwd?, host?, security?, ask?, agentId?, resolvedPath?, sessionKey?, timeoutMs? }`
- `exec.approval.resolve`: `{ id, decision }`（`decision` 支持：`allow-once | allow-always | deny`）
- `wizard.start`: `{ mode?: "local"|"remote", workspace? }`
- `wizard.next`: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel`: `{ sessionId }`
- `wizard.status`: `{ sessionId }`

### 4.7 渠道、语音、模型、代理管理
- `channels.status`: `{ probe?, timeoutMs? }`
- `channels.logout`: `{ channel, accountId? }`
- `talk.mode`: `{ enabled, phase? }`
- `voicewake.get`: `{}`
- `voicewake.set`: `{ triggers: string[] }`
- `models.list`: `{}`
- `agents.list`: `{}`
- `agents.create`: `{ name, workspace, emoji?, avatar? }`
- `agents.update`: `{ agentId, name?, workspace?, model?, avatar? }`
- `agents.delete`: `{ agentId, deleteFiles? }`
- `agents.files.list`: `{ agentId }`
- `agents.files.get`: `{ agentId, name }`
- `agents.files.set`: `{ agentId, name, content }`
- `skills.status`: `{ agentId? }`
- `skills.bins`: `{}`
- `skills.install`: `{ name, installId, timeoutMs? }`
- `skills.update`: `{ skillKey, enabled?, apiKey?, env? }`

### 4.8 TTS、日志、用量、计划任务、更新
- `logs.tail`: `{ cursor?, limit?: 1..5000, maxBytes?: 1..1000000 }`
- `tts.status`: `{}`
- `tts.providers`: `{}`
- `tts.enable`: `{}`
- `tts.disable`: `{}`
- `tts.convert`: `{ text, channel? }`
- `tts.setProvider`: `{ provider: "openai"|"elevenlabs"|"edge" }`
- `usage.status`: `{}`
- `usage.cost`: `{ startDate?: "YYYY-MM-DD", endDate?: "YYYY-MM-DD", days?: number }`
- `cron.list`: `{ includeDisabled? }`
- `cron.status`: `{}`
- `cron.add`: `{ name, agentId?, description?, enabled?, deleteAfterRun?, schedule, sessionTarget, wakeMode, payload, delivery? }`
- `cron.update`: `{ id|jobId, patch }`
- `cron.remove`: `{ id|jobId }`
- `cron.run`: `{ id|jobId, mode?: "due"|"force" }`
- `cron.runs`: `{ id|jobId, limit?: 1..5000 }`
- `update.run`: `{ sessionKey?, note?, restartDelayMs?, timeoutMs? }`

### 4.9 可能出现的扩展/兼容方法（版本或插件相关）
- `web.login.start`: `{ force?, timeoutMs?, verbose?, accountId? }`
- `web.login.wait`: `{ timeoutMs?, accountId? }`
- `chat.inject`: `{ sessionKey, message, label? }`
- `sessions.resolve`: `{ key?, sessionId?, label?, agentId?, spawnedBy?, includeGlobal?, includeUnknown? }`
- `sessions.usage`: `{ key?, startDate?, endDate?, limit?, includeContextWeight? }`
- `poll`: `{ to, question, options[2..12], maxSelections?, durationHours?, channel?, accountId?, idempotencyKey }`

## 5. Gateway 事件（含 payload）
注：所有事件帧都可能带 `seq` 与 `stateVersion`。

- `connect.challenge`: `{ nonce, ts }`
- `agent`: `{ runId, seq, stream, ts, data }`
- `chat`: `{ runId, sessionKey, seq, state: "delta"|"final"|"aborted"|"error", message?, errorMessage?, usage?, stopReason? }`
- `presence`: `{ presence: PresenceEntry[] }`
- `tick`: `{ ts }`
- `talk.mode`: `{ enabled, phase, ts }`
- `shutdown`: `{ reason, restartExpectedMs? }`
- `health`: `health` 方法返回体（HealthSummary）
  - 常见字段：`ok, ts, durationMs, channels, channelOrder, channelLabels, defaultAgentId, agents, sessions`
- `heartbeat`: `{ ts, status, to?, accountId?, preview?, durationMs?, hasMedia?, reason?, channel?, silent?, indicatorType? }`
- `cron`: `{ jobId, action: "added"|"updated"|"removed"|"started"|"finished", runAtMs?, durationMs?, status?, error?, summary?, sessionId?, sessionKey?, nextRunAtMs? }`
- `node.pair.requested`: `{ requestId, nodeId, displayName?, platform?, version?, coreVersion?, uiVersion?, deviceFamily?, modelIdentifier?, caps?, commands?, permissions?, remoteIp?, silent?, isRepair?, ts }`
- `node.pair.resolved`: `{ requestId, nodeId, decision, ts }`
- `node.invoke.request`: `{ id, nodeId, command, paramsJSON?, timeoutMs?, idempotencyKey? }`
- `device.pair.requested`: `{ requestId, deviceId, publicKey, displayName?, platform?, clientId?, clientMode?, role?, roles?, scopes?, remoteIp?, silent?, isRepair?, ts }`
- `device.pair.resolved`: `{ requestId, deviceId, decision, ts }`
- `voicewake.changed`: `{ triggers: string[] }`
- `exec.approval.requested`: `{ id, request: { command, cwd?, host?, security?, ask?, agentId?, resolvedPath?, sessionKey? }, createdAtMs, expiresAtMs }`
- `exec.approval.resolved`: `{ id, decision, resolvedBy?, ts }`

## 6. 错误与可靠性建议
- 常见错误码：`NOT_LINKED`、`AGENT_TIMEOUT`、`INVALID_REQUEST`、`UNAVAILABLE`
- 事件默认不回放；若发现 `seq` 缺口，先拉 `health + system-presence` 重建状态
- 实现 ping/pong 与 `tick` 监控；不要把 `tick` 当业务 ACK
- 对 `shutdown`、网络断开、`UNAVAILABLE` 做指数退避重连

## 7. 最小落地流程
1. 建立 WS 连接
2. 处理 `connect.challenge`（如有）并发送 `connect`
3. 校验 `hello-ok`，缓存 `features.methods/events` 与 `deviceToken`
4. 根据 `features.methods` 动态启用客户端能力
5. 订阅并处理事件（含 `seq gap` 检测）
6. 业务调用走 `req/res`，副作用接口统一使用幂等键

## 8. 参考来源
- Docs: [Gateway Runbook](https://docs.openclaw.ai/gateway)
- Docs: [Gateway Protocol](https://docs.openclaw.ai/gateway/protocol)
- Source: [server-methods-list.ts](https://github.com/openclaw/openclaw/blob/main/src/gateway/server-methods-list.ts)
- Source: [protocol/schema 目录](https://github.com/openclaw/openclaw/tree/main/src/gateway/protocol/schema)
- Source: [server-methods 目录](https://github.com/openclaw/openclaw/tree/main/src/gateway/server-methods)
