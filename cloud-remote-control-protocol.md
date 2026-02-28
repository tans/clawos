# ClawOS Cloud Remote Control Protocol（CRCP）v1

面向 `clawos` 的云端远程控制协议。目标是让云端可安全地控制一台 Windows + WSL 设备上的 openclaw 环境。

## 1. 设计目标
- 云端可远程读写 openclaw 数据目录（受控范围）。
- 云端可读取 gateway 运行信息与健康状态。
- 云端可控制 WSL 终端（含交互式命令执行）。
- 默认最小权限、全链路可审计、适配中文错误提示。

## 2. 架构与连接方式
- 角色
  - `Agent`：运行在用户本机的 clawos 进程。
  - `Cloud`：云端控制面服务。
  - `Operator`：云端发起操作的用户/系统。
- 连接模型
  - `Agent -> Cloud` 主动发起 `wss` 长连接（避免用户侧开公网端口）。
  - 所有控制命令走同一条双向流，消息为 JSON 文本帧。
- 会话模型
  - 设备会话：`device_session_id`
  - 远程操作会话：`remote_session_id`
  - 终端会话：`terminal_session_id`

## 3. 传输与消息封装
- 传输：`WebSocket over TLS 1.3`（必须 `wss://`）。
- 编码：`UTF-8 JSON`。
- 帧结构：

```json
{
  "v": 1,
  "id": "msg_01J...",
  "type": "req|res|event|ack",
  "method": "fs.read|gateway.status|terminal.exec",
  "ts": 1740643200000,
  "session": {
    "deviceSessionId": "ds_...",
    "remoteSessionId": "rs_..."
  },
  "auth": {
    "token": "optional-short-lived-jwt",
    "sig": "optional-ed25519-signature"
  },
  "payload": {}
}
```

- 请求响应语义
  - `req`：Cloud 或 Agent 发起调用。
  - `res`：对应 `id` 返回结果，包含 `ok`、`data` 或 `error`。
  - `event`：异步推送（日志、终端输出、状态变化）。
  - `ack`：大流量分片确认（可选）。

## 4. 鉴权与权限模型

## 4.1 设备注册
- 首次安装 clawos 时生成设备密钥对（建议 `ed25519`）。
- 注册后获得：
  - `device_id`
  - `device_token`（长效，仅用于换短 token）

## 4.2 会话鉴权
- 连接建立时使用 `device_token` 换取短期 `access_token`（建议 5-15 分钟）。
- 每次高风险操作（写文件、执行命令）必须带 `request_id + nonce`，防重放。

## 4.3 RBAC（权限粒度）
- `fs.read`
- `fs.write`
- `gateway.read`
- `terminal.exec`
- `terminal.interactive`
- `system.admin`（可选，高危）

## 4.4 路径沙箱
仅允许访问以下 WSL 路径：
- `/data/openclaw/**`
- `/root/.openclaw/**`

禁止：
- `..` 路径穿越
- 符号链接逃逸（需 realpath 校验后再授权）
- 访问 `/etc`, `/root` 其他路径

## 5. 协议方法定义

## 5.1 文件系统（openclaw 数据目录读写）

### `fs.stat`
- 入参：`{ "path": "/data/openclaw/package.json" }`
- 出参：`{ "type":"file|dir", "size":123, "mtime":1740643200, "mode":"0644" }`

### `fs.list`
- 入参：
```json
{ "path": "/data/openclaw", "recursive": false, "limit": 200 }
```
- 出参：
```json
{ "entries": [{ "name":"src", "type":"dir" }, { "name":"package.json", "type":"file" }], "nextCursor": null }
```

### `fs.read`
- 入参：
```json
{ "path": "/data/openclaw/openclaw.json", "encoding": "utf8", "offset": 0, "length": 65536 }
```
- 出参：
```json
{ "content": "...", "eof": true, "sha256": "..." }
```

### `fs.write`
- 入参：
```json
{
  "path": "/root/.openclaw/openclaw.json",
  "encoding": "utf8",
  "content": "{\"gateway\":{}}",
  "ifMatchSha256": "optional"
}
```
- 语义：
  - 默认原子写入：先写临时文件，再 `rename`。
  - 支持 `ifMatchSha256` 防并发覆盖。

### `fs.delete`
- 入参：`{ "path": "/data/openclaw/tmp.log", "recursive": false }`
- 限制：仅允许删除沙箱内路径。

## 5.2 Gateway 信息读取

### `gateway.status`
- 描述：读取 `status` 信息（映射 openclaw gateway 协议 `status`）。
- 入参：`{}`
- 出参：`{ "server": {"version":"..."}, "uptimeMs": 12345, "raw": {} }`

### `gateway.health`
- 描述：读取健康状态（映射 `health`）。
- 入参：`{ "probe": false }`
- 出参：`{ "ok": true, "channels": {}, "ts": 1740643200000, "raw": {} }`

### `gateway.channels.status`
- 入参：`{ "probe": false, "timeoutMs": 3000 }`
- 出参：`{ "ok": true, "items": [], "raw": {} }`

### `gateway.config.get`
- 入参：`{}`
- 出参：`{ "config": {}, "hash": "..." }`

说明：`raw` 字段保留原始 gateway 返回，便于云端兼容不同版本。

## 5.3 WSL 终端控制

### `terminal.open`
- 入参：
```json
{
  "cwd": "/data/openclaw",
  "shell": "bash",
  "login": true,
  "cols": 120,
  "rows": 30,
  "idleTimeoutSec": 900
}
```
- 出参：`{ "terminalSessionId": "ts_..." }`

### `terminal.exec`
- 描述：非交互执行一条命令。
- 入参：
```json
{
  "terminalSessionId": "ts_...",
  "command": "git pull --no-rebase -X theirs --no-edit",
  "timeoutMs": 1200000
}
```
- 出参：`{ "exitCode": 0, "stdout": "...", "stderr": "..." }`

### `terminal.stdin`
- 入参：`{ "terminalSessionId": "ts_...", "data": "pnpm run build\n" }`
- 出参：`{ "written": 15 }`

### `terminal.resize`
- 入参：`{ "terminalSessionId": "ts_...", "cols": 140, "rows": 40 }`

### `terminal.close`
- 入参：`{ "terminalSessionId": "ts_...", "signal": "SIGTERM" }`

### 终端事件
- `terminal.stdout`
- `terminal.stderr`
- `terminal.exit`

事件示例：
```json
{
  "v": 1,
  "type": "event",
  "method": "terminal.stdout",
  "payload": {
    "terminalSessionId": "ts_...",
    "chunk": "[2/8] pnpm install...\n"
  }
}
```

## 6. 任务与幂等
- 高耗时操作建议走任务模型：
  - `task.start` -> 返回 `taskId`
  - 通过 `task.event` 推送进度
  - `task.get` 查询最终状态
- 写操作都支持 `idempotencyKey`，避免重复执行。

## 7. 错误码规范
统一错误结构：

```json
{
  "ok": false,
  "error": {
    "code": "FS_PATH_DENIED",
    "message": "路径不在允许范围内。",
    "hint": "仅允许 /data/openclaw 与 /root/.openclaw",
    "retryable": false
  }
}
```

建议错误码：
- `AUTH_INVALID`
- `AUTH_EXPIRED`
- `PERMISSION_DENIED`
- `FS_PATH_DENIED`
- `FS_NOT_FOUND`
- `FS_CONFLICT`
- `GATEWAY_UNAVAILABLE`
- `TERMINAL_NOT_FOUND`
- `TERMINAL_TIMEOUT`
- `WSL_NOT_READY`
- `INTERNAL_ERROR`

## 8. 审计与安全基线
- 全量审计：记录 `operator_id`, `device_id`, `method`, `path`, `command`, `result`, `duration`。
- 敏感字段脱敏：token、密钥、密码、私钥。
- 高风险命令黑名单（可配置）：如 `rm -rf /`, `mkfs`, `shutdown`。
- 可选双确认：`terminal.exec` 命中高危规则时需要二次审批。
- 速率限制：
  - 文件读写 QPS 限制
  - 终端并发会话限制（每设备建议 <= 2）

## 9. 与 clawos 现有能力对齐建议
- `gateway.*` 直接复用现有 `callGatewayMethod`。
- `terminal.*` 复用现有 WSL 执行能力（`runWslScript` + PTY 扩展）。
- 文件操作新增 `realpath + allowlist` 统一校验中间层。
- UI 显示任务日志时沿用现有任务系统格式（步骤、状态、错误提示）。

## 10. v1 最小可交付（MVP）
第一阶段建议只上线：
1. `fs.list/fs.read/fs.write`（无递归删除）
2. `gateway.status/gateway.health/gateway.channels.status`
3. `terminal.open/terminal.exec/terminal.close`（先不做全交互）
4. 审计日志与 RBAC

这样可以优先满足“远程运维 openclaw”的核心场景，并控制安全风险。
