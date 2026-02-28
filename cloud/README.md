# clawos-cloud

`clawos` 云端控制面工程，技术栈：`bun + hono + sqlite`。

## 已实现能力
- 控制台账号：手机号 + 密码登录。
- 控制台主机列表：按账号钱包地址过滤可控主机。
- 单机控制页：
  - 下发 `wsl.exec`
  - 下发 `clawos.gateway.status`
  - 下发 `clawos.gateway.action(restart)`
  - 查看最近任务与结果
- Agent 接口：
  - 上线注册 `POST /api/agent/hello`
  - 心跳上报 `POST /api/agent/heartbeat`
  - 拉取任务 `GET /api/agent/commands`
  - 回传结果 `POST /api/agent/commands/:id/result`

协议文档：
- [/Users/ke/code/clawos/cloud-remote-control-protocol.md](/Users/ke/code/clawos/cloud-remote-control-protocol.md)

## 本地运行

```bash
cd cloud
bun install
bun run dev
```

默认端口：`8787`

访问：
- 登录页: [http://127.0.0.1:8787/console/login](http://127.0.0.1:8787/console/login)
- 注册页: [http://127.0.0.1:8787/console/register](http://127.0.0.1:8787/console/register)
- 健康检查: [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health)

## 数据库
- 默认路径：`cloud/data/cloud.db`
- 可通过环境变量覆盖：`CLOUD_DB_PATH=/path/to/cloud.db`

## Agent 对接最小示例

1. 首次上线（无 token）

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

返回的 `host.agentToken` 需要持久化到设备端。

2. 心跳上报

```bash
curl -X POST http://127.0.0.1:8787/api/agent/heartbeat \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <agentToken>' \
  -d '{"hostId":"host-demo-01","wslReady":true,"gatewayReady":true}'
```

3. 拉取任务

```bash
curl "http://127.0.0.1:8787/api/agent/commands?hostId=host-demo-01" \
  -H 'authorization: Bearer <agentToken>'
```
