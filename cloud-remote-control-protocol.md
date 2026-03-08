# ClawOS Cloud Remote Control Protocol（CRCP）v2.2（按当前实现）

> 本文档以仓库中 **已实现代码** 为准，描述 `clawos Agent <-> farm` 的真实协议。
> 当前实现为 **HTTP 轮询模型**，不是 WebSocket 长连接。

## 1. 目标场景
1. 设备端（clawos）在本机管理 openclaw。
2. 设备通过 `controllerAddress` 声明可被哪个控制人管理。
3. 云端（farm）按 `controllerAddress` 进行主机可见性与操作权限控制。
4. Agent 通过 HTTP 接口完成上线、心跳、拉任务、回传结果。

## 2. 权限与绑定规则
- `hostId`：设备唯一标识。
- `controllerAddress`：设备上报的控制人地址（当前实现要求 `0x` 开头 40 位十六进制地址）。
- `agentToken`：Agent 鉴权凭据。

规则：
- 首次 `hello`（主机不存在）时，可不带 token；Farm 会生成并返回 `agentToken`。
- 后续 `hello`（主机已存在）必须携带正确 `agentToken`，否则返回 `AGENT_AUTH_FAILED`。
- `heartbeat / commands / result` 必须使用 `Authorization: Bearer <agentToken>`。

---

## 3. Agent -> Farm：HTTP 协议

### 3.1 上线注册 / 恢复会话
- `POST /api/agent/hello`
- `Content-Type: application/json`

请求示例：
```json
{
  "hostId": "host-demo-01",
  "name": "demo-win-host",
  "controllerAddress": "0x1111111111111111111111111111111111111111",
  "agentToken": "agt_xxx_optional",
  "platform": "windows",
  "wslDistro": "Ubuntu",
  "clawosVersion": "0.1.9"
}
```

成功响应示例：
```json
{
  "ok": true,
  "serverTimeMs": 1767225600000,
  "host": {
    "hostId": "host-demo-01",
    "name": "demo-win-host",
    "controllerAddress": "0x1111111111111111111111111111111111111111",
    "agentToken": "agt_xxx"
  },
  "pendingCommands": [
    {
      "id": "cmd_xxx",
      "kind": "clawos.gateway.status",
      "payload": {},
      "createdAt": 1767225600000
    }
  ]
}
```

### 3.2 心跳
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

成功响应示例：
```json
{
  "ok": true,
  "serverTimeMs": 1767225600000,
  "status": "online"
}
```

状态规则：
- `wslReady && gatewayReady` -> `online`
- 否则 -> `degraded`

### 3.3 拉取任务（轮询）
- `GET /api/agent/commands?hostId=<hostId>&limit=<n>`
- Header: `Authorization: Bearer <agentToken>`

成功响应示例：
```json
{
  "ok": true,
  "hostId": "host-demo-01",
  "commands": [
    {
      "id": "cmd_xxx",
      "kind": "wsl.exec",
      "payload": {
        "cwd": "/data/openclaw",
        "command": "pnpm run build",
        "timeoutMs": 600000
      },
      "createdAt": 1767225600000
    }
  ]
}
```

### 3.4 回传任务结果
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

失败示例：
```json
{
  "hostId": "host-demo-01",
  "ok": false,
  "error": "gateway not ready"
}
```

---

## 4. 命令模型（当前）

采用队列模型：
1. Console 下发命令 -> 写入 `pending`
2. Agent 轮询 `GET /api/agent/commands`
3. Agent 执行本地动作
4. Agent 回传 `POST /api/agent/commands/:id/result`

当前已使用命令类型：
- `wsl.exec`
- `clawos.gateway.status`
- `clawos.gateway.action`（示例：`restart`）

---

## 5. Console 侧能力（当前）
- 登录/注册：手机号 + 密码。
- 主机列表：按账号的 `walletAddress` 过滤可控主机。
- 单机操作：
  - 下发 `wsl.exec`
  - 下发 `clawos.gateway.status`
  - 下发 `clawos.gateway.action (restart)`

---

## 6. 安全与兼容
- `agentToken` 是 Agent 接口的核心鉴权凭据。
- `controllerAddress` 是主机授权绑定关键字段。
- 新增字段应保持可选，旧 Agent 可忽略未知字段。
- 设置页中的 `farmAddress` 仅用于页面跳转，不参与 Agent 鉴权或任务协议。

---

## 7. 与早期 WS 草案关系
历史文档里出现过 WS 帧（`hello.ok`、`task.dispatch` 等）描述。
在当前仓库实现中，这些语义已映射为上文的 HTTP 接口；若未来恢复 WS，实现应另行版本化并补充迁移说明。

## 8. 仓库定位
- 云端工程：`farm/`
- HTTP 协议补充：`farm/AGENT_HTTP_PROTOCOL.md`
- 本文档：`cloud-remote-control-protocol.md`
