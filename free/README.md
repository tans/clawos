# clawos-free-provider

本地免费测试接口（回显服务），用于 ClawOS 自定义模型 Provider 联调。

## 运行

```bash
bun run free:dev
```

默认端口：`18765`

生产部署时可由平台注入 `PORT`，服务会自动监听该端口。

## 接口

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`（回显最后一条 user 消息）
- `POST /v1/responses`（回显最后一条 user input）

## 部署建议

- 域名：`freegpt.minapp.xin`
- Provider Base URL：`https://freegpt.minapp.xin/v1`
- Provider API：`openai-completions`
- Model：`free-echo`
