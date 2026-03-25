# Company ↔ ClawOS Agent HTTP 协议补充（当前实现）

> 本文档描述 `company` 与设备端 `clawos` 在当前代码中的**实际通讯协议**。
> 
> 与 `cloud-remote-control-protocol.md` 中的 WS 版本属于同一业务模型，当前落地形态为 HTTP 轮询。

## 1. 鉴权与绑定

- 设备唯一标识：`hostId`
- 控制权限绑定：`controllerAddress`
- Agent 鉴权：`Authorization: Bearer <agentToken>`

绑定规则：
- `hello` 首次上报时，Company 为主机生成（或更新）`agentToken`。
- 控制台仅展示 `controllerAddress == user.walletAddress` 的主机。

## 2. 上线注册（hello）

- `POST /api/agent/hello`
- `Content-Type: application/json`

请求示例：

```json
{
  "hostId": "host-demo-01",
  "name": "demo-win-host",
  "controllerAddress": "0x1111111111111111111111111111111111111111",
  "platform": "windows",
  "wslDistro": "Ubuntu",
  "clawosVersion": "0.1.9"
}
```

响应关键字段：
- `host.agentToken`：后续 heartbeat/commands/result 必带。
- `commands`：可选，返回当前 pending 任务。

## 3. 心跳上报（heartbeat）

- `POST /api/agent/heartbeat`
- Header: `Authorization: Bearer <agentToken>`

请求示例：

```json
{
  "hostId": "host-demo-01",
  "wslReady": true,
  "gatewayReady": true,
  "clawosVersion": "0.1.9"
}
```

## 4. 任务拉取（polling）

- `GET /api/agent/commands?hostId=<hostId>&limit=<n>`
- Header: `Authorization: Bearer <agentToken>`

响应示例：

```json
{
  "ok": true,
  "hostId": "host-demo-01",
  "commands": [
    {
      "id": "cmd_xxx",
      "type": "clawos.gateway.status",
      "payload": {},
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## 5. 任务结果回传（result callback）

- `POST /api/agent/commands/:id/result`
- Header: `Authorization: Bearer <agentToken>`

请求示例：

```json
{
  "hostId": "host-demo-01",
  "ok": true,
  "result": {
    "stdout": "done"
  }
}
```

失败时：

```json
{
  "hostId": "host-demo-01",
  "ok": false,
  "error": "gateway not ready"
}
```

## 6. 命令类型（当前）

- `wsl.exec`
- `clawos.gateway.status`
- `clawos.gateway.action`（如 `restart`）

## 7. 监听事件上报（events）

- `POST /api/agent/events`
- Header: `Authorization: Bearer <agentToken>`

请求示例：

```json
{
  "hostId": "host-demo-01",
  "eventType": "runtime.queue.blocked",
  "severity": "warning",
  "title": "任务队列阻塞",
  "payload": {
    "queueDepth": 42,
    "oldestWaitSec": 180
  }
}
```

约束：
- `eventType` 必填，建议使用 `domain.action` 风格。
- `severity` 可选：`info` / `warning` / `error`，默认 `info`。

## 8. Agent 侧洞察拉取（insights）

- `GET /api/agent/insights?hostId=<hostId>&limit=<n>`
- Header: `Authorization: Bearer <agentToken>`

返回：
- `summary`：最近事件总数与分级统计。
- `events`：最近事件列表（含 `eventType/severity/title/payload/createdAt`）。

## 9. 兼容性约定

- 新增字段应保持可选，旧 Agent 可忽略未知字段。
- `controllerAddress` 继续作为唯一授权绑定字段。
- 配置页“Company 通讯地址（companyAddress）”仅影响外部页面跳转，不参与 Agent 鉴权与任务协议。
