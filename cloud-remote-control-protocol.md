# ClawOS Cloud Remote Control Protocol（CRCP）v2.1

本版本采用**设备单向绑定**模型：
- 设备端（clawos 客户端）填写 `controllerAddress` 即完成绑定。
- 云端不做绑定审批、不做多阶段状态机。
- 云端控制权限按“账号钱包地址 == 设备上报 controllerAddress”直接判定。

## 1. 使用场景（目标一致）
1. 用户购买预装 openclaw 的 Windows 主机。
2. 预装 clawos 客户端，用于本机 openclaw 更新与管理。
3. 在设备端填写云控制人的钱包地址（`controllerAddress`），完成授权。
4. 控制人通过手机号+密码登录 `cloud.clawos.cc`，在云界面远程管理该主机。

## 2. 总体架构
- Agent（设备）：clawos 客户端，常驻连接云端。
- Cloud：`cloud.clawos.cc` 控制面。
- Controller：云端登录用户（手机号+密码），账号资料中包含钱包地址。

连接方式：
- Agent 主动连接：`wss://cloud.clawos.cc/ws/agent`
- 控制台登录后，通过 API + WS 查看主机状态与下发任务。

## 3. 设备配置（clawos.json）

```json
{
  "name": "ke-home-win11",
  "cloud": {
    "url": "wss://cloud.clawos.cc/ws/agent",
    "agentToken": "agt_xxx"
  },
  "controllerAddress": "0x1234...abcd"
}
```

规则：
- `name`：主机显示名；首次为空时自动生成并写回。
- `agentToken`：设备连接云端的鉴权 token。
- `controllerAddress`：**设备端单向写入**，云端按此地址做控制权限匹配。

## 4. 权限判定（简化）
- 控制台用户登录后，云端读取该账号绑定的钱包地址 `userWalletAddress`。
- Cloud 仅展示 `controllerAddress == userWalletAddress` 的主机。
- 仅允许该用户对这些主机下发任务。
- 设备修改 `controllerAddress` 后，云端权限实时切换到新地址。

说明：
- 登录方式为手机号+密码。
- “设备绑定控制人”不需要签名确认流程。

## 5. Agent WS 协议

## 5.1 通用帧

```json
{
  "v": 2,
  "id": "msg_01J...",
  "type": "hello|hello.ok|heartbeat|task.dispatch|task.ack|task.progress|task.result|event|error",
  "ts": 1767225600000,
  "host": {
    "hostId": "host_01...",
    "name": "ke-home-win11"
  },
  "payload": {}
}
```

建议：
- `hostId` 不变（设备唯一 ID）。
- `name` 可改（显示用途）。

## 5.2 首次握手

### Agent -> Cloud: `hello`

```json
{
  "v": 2,
  "type": "hello",
  "payload": {
    "hostId": "host_01H...",
    "name": "ke-home-win11",
    "agentToken": "agt_xxx_optional",
    "controllerAddress": "0x1234...abcd",
    "platform": "windows",
    "wslDistro": "Ubuntu",
    "clawosVersion": "0.1.9",
    "capabilities": ["wsl.exec", "wsl.pty", "clawos.gateway", "clawos.local"]
  }
}
```

### Cloud -> Agent: `hello.ok`

```json
{
  "v": 2,
  "type": "hello.ok",
  "payload": {
    "agentId": "agt_01H...",
    "agentToken": "agt_new_or_existing",
    "sessionId": "sess_01H...",
    "serverTimeMs": 1767225600000,
    "heartbeatIntervalSec": 10,
    "pendingTasks": []
  }
}
```

Cloud 在 `hello` 时更新设备记录：
- `hostId`
- `name`
- `controllerAddress`
- 在线状态和版本信息

## 5.3 心跳

### Agent -> Cloud: `heartbeat`

```json
{
  "type": "heartbeat",
  "payload": {
    "wslReady": true,
    "gatewayReady": true,
    "cpu": 0.23,
    "mem": 0.61,
    "lastError": null
  }
}
```

Cloud 根据心跳更新状态：`online | degraded | offline`。

## 5.4 时间同步

### Cloud -> Agent: `event(clock.sync)`

```json
{
  "type": "event",
  "payload": {
    "event": "clock.sync",
    "serverTimeMs": 1767225600000
  }
}
```

## 5.5 任务流

### Cloud -> Agent: `task.dispatch`

```json
{
  "type": "task.dispatch",
  "payload": {
    "taskId": "task_01H...",
    "kind": "wsl.exec",
    "timeoutMs": 600000,
    "params": {
      "cwd": "/data/openclaw",
      "command": "pnpm run build"
    }
  }
}
```

### Agent -> Cloud: `task.ack`
- 已接收。

### Agent -> Cloud: `task.progress`
- 流式日志。

### Agent -> Cloud: `task.result`
- 最终结果。

## 6. 远程控制能力

## 6.1 WSL 终端
- `wsl.exec`
- `wsl.pty.open`
- `wsl.pty.write`
- `wsl.pty.resize`
- `wsl.pty.close`

## 6.2 本地 clawos 控制
- `clawos.gateway.status`
- `clawos.gateway.action`（`start|stop|restart|install|uninstall`）
- `clawos.update`
- `clawos.config.read`
- `clawos.config.write`

## 7. 云端控制台行为

## 7.1 主机列表
展示：
- `name`
- `status`
- `lastSeen`
- `clawosVersion`
- `wslReady`
- `gatewayReady`

筛选规则：
- 只显示 `controllerAddress == 当前登录账号的钱包地址` 的主机。

## 7.2 单机控制页
必须包含：
1. WSL 终端（实时输入输出）
2. ClawOS 控制（状态、重启、升级、配置）

## 8. 安全边界（保留最小必要）
- Agent 连接必须使用 `agentToken`（防止任意伪造设备上线）。
- 控制台登录使用手机号+密码（密码需安全存储，建议哈希+加盐）。
- 文件操作目录白名单：
  - `/data/openclaw/**`
  - `/root/.openclaw/**`
- 全量审计：`walletAddress`, `hostId`, `taskId`, `action`, `result`, `duration`。

## 9. MVP（按你的场景）
1. Agent WS 上线 + 心跳 + `clock.sync`
2. 主机列表（按 controllerAddress 过滤）
3. 单机页 `wsl.exec`
4. 单机页 `clawos.gateway.status` + `clawos.gateway.action(restart)`
5. 后续再加 `wsl.pty.*` 与 `clawos.update`

## 10. 仓库对应
- 协议文档：`/Users/ke/code/clawos/cloud-remote-control-protocol.md`
- 云端工程：`/Users/ke/code/clawos/cloud`
