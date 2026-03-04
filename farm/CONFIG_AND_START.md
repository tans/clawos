# ClawOS Cloud 配置与启动文档

本文档说明 `farm` 服务的配置、启动、首次初始化和 Agent 接入方式。

## 1. 项目位置与技术栈
- 目录：`/Users/ke/code/clawos/farm`
- 运行时：`bun`
- Web 框架：`hono`
- 存储：`sqlite`

## 2. 运行前准备
- 安装 Bun（建议 `1.3+`）
- 进入目录：

```bash
cd /Users/ke/code/clawos/farm
```

- 安装依赖：

```bash
bun install
```

## 3. 配置项

当前服务支持以下环境变量：

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8787` | Cloud HTTP 服务监听端口 |
| `FARM_DB_PATH` | `farm/data/farm.db` | SQLite 数据库文件路径 |

示例：

```bash
export PORT=8787
export FARM_DB_PATH=/data/clawos/farm.db
```

## 4. 启动方式

### 4.1 开发模式（自动重载）

```bash
bun run dev
```

### 4.2 生产模式

```bash
bun run start
```

启动成功后默认可访问：
- 健康检查：`http://127.0.0.1:8787/health`
- 登录页：`http://127.0.0.1:8787/console/login`
- 注册页：`http://127.0.0.1:8787/console/register`

## 5. 首次初始化（控制台账号）

1. 打开 `http://127.0.0.1:8787/console/register`
2. 填写：
- 手机号
- 钱包地址（用于匹配设备的 `controllerAddress`）
- 密码
3. 注册成功后，使用手机号 + 密码登录 `http://127.0.0.1:8787/console/login`

说明：
- 账号密码使用 `Bun.password.hash` 存储。
- 登录态通过 HttpOnly Cookie 维护（`clawos_console_session`）。

## 6. 主机接入（Agent）

Cloud 按设备上报的 `controllerAddress` 与控制台账号的 `walletAddress` 做匹配展示。

### 6.1 Agent 首次上线（获取/确认 token）

```bash
curl -X POST http://127.0.0.1:8787/api/agent/hello \
  -H 'content-type: application/json' \
  -d '{
    "hostId":"host-demo-01",
    "name":"demo-win-host",
    "controllerAddress":"0x1111111111111111111111111111111111111111",
    "platform":"windows",
    "wslDistro":"Ubuntu",
    "clawosVersion":"0.1.9"
  }'
```

返回体里的 `host.agentToken` 需要持久化到设备端。

### 6.2 心跳上报

```bash
curl -X POST http://127.0.0.1:8787/api/agent/heartbeat \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agentToken>' \
  -d '{
    "hostId":"host-demo-01",
    "wslReady":true,
    "gatewayReady":true,
    "clawosVersion":"0.1.9"
  }'
```

### 6.3 拉取任务

```bash
curl "http://127.0.0.1:8787/api/agent/commands?hostId=host-demo-01" \
  -H 'authorization: Bearer <agentToken>'
```

### 6.4 回传任务结果

```bash
curl -X POST "http://127.0.0.1:8787/api/agent/commands/<commandId>/result" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agentToken>' \
  -d '{
    "hostId":"host-demo-01",
    "ok":true,
    "result":{"stdout":"done"}
  }'
```

## 7. 控制台使用说明

登录后：
1. 进入主机列表页（`/console`）
2. 只会看到 `controllerAddress == 当前账号钱包地址` 的主机
3. 点击主机进入单机控制页，可下发：
- `wsl.exec`
- `clawos.gateway.status`
- `clawos.gateway.action (restart)`

## 8. 数据文件

默认会自动创建：
- `farm/data/farm.db`
- `farm/data/farm.db-shm`
- `farm/data/farm.db-wal`

仓库已忽略数据库与 `node_modules`。

## 9. 常见问题

### 9.1 登录后看不到主机
检查：
- 设备上报的 `controllerAddress` 是否与账号钱包地址完全一致（大小写不敏感，建议统一小写）
- Agent 是否持续发送 `heartbeat`

### 9.2 Agent 报 `AGENT_AUTH_FAILED`
检查：
- 后续请求是否带 `Authorization: Bearer <agentToken>`
- `agentToken` 是否为 `hello` 返回的最新值

### 9.3 端口冲突
修改端口：

```bash
PORT=8877 bun run start
```

## 10. 生产部署建议
- 使用反向代理（Nginx/Caddy）对外暴露 HTTPS 域名
- 限制数据库文件目录权限
- 定期备份 `farm.db`
- 打开访问日志并结合 `/api/audit` 做审计追踪

## 11. 关联文档
- Farm 简介：[/Users/ke/code/clawos/farm/README.md](/Users/ke/code/clawos/farm/README.md)
- 协议文档：[/Users/ke/code/clawos/cloud-remote-control-protocol.md](/Users/ke/code/clawos/cloud-remote-control-protocol.md)
