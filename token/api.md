# ClawOS Token API（v1）

本文档为当前已实现版本，目标是给 OpenClaw 直接接入统一模型入口，并提供充值/续费能力。

## 1. 基础约定

- Base URL：`https://token.clawos.cc`
- 鉴权：`Authorization: Bearer <token_api_key>`
- 响应：`application/json; charset=utf-8`
- 请求追踪：`x-request-id`（可选）

## 2. 已实现接口

### 2.1 健康检查

`GET /health`

### 2.2 模型列表

`GET /v1/models`

返回至少包含：`auto`、`auto-fast`、`auto-code`。

### 2.3 统一聊天接口

`POST /v1/chat/completions`

说明：

- 兼容 OpenAI Chat Completions。
- 支持 `stream=false` 与 `stream=true`。
- `model` 允许传别名（推荐 `auto`）。
- 当前路由策略：DeepSeek -> OpenAI -> Anthropic。

示例请求：

```json
{
  "model": "auto",
  "stream": false,
  "messages": [
    { "role": "system", "content": "你是中文助手" },
    { "role": "user", "content": "解释 bun serve" }
  ]
}
```

示例响应（节选）：

```json
{
  "id": "chatcmpl_...",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  },
  "token": {
    "resolved_model": "deepseek/deepseek-chat",
    "billing": {
      "charged_cents": 1,
      "charged_amount": 0.01,
      "balance_cents": 999,
      "balance": 9.99,
      "plan_active": false,
      "plan_expires_at": null
    }
  }
}
```

### 2.4 查询余额

`GET /token/v1/account/balance`

示例响应：

```json
{
  "ok": true,
  "accountId": "acct_demo",
  "currency": "CNY",
  "balance": 10.5,
  "balanceCents": 1050,
  "plan": {
    "code": "pro-monthly",
    "active": true,
    "expiresAt": 1769817600000
  },
  "updatedAt": 1767225600000
}
```

### 2.5 充值

`POST /token/v1/billing/recharge`

请求体：

```json
{
  "accountId": "acct_demo",
  "amount": 100,
  "channel": "wechat",
  "outTradeNo": "recharge_202603020001"
}
```

说明：

- `amount` 单位是元（`CNY`）。
- `outTradeNo` 用于幂等。
- `accountId` 可省略（默认当前 API key 账户）。

### 2.6 用量汇总

`GET /token/v1/billing/usage?from=2026-03-01&to=2026-03-31&modelLimit=20`

参数：

- `from`：起始日期，`YYYY-MM-DD`（可选，默认最近 30 天）
- `to`：结束日期，`YYYY-MM-DD`（可选，默认今天）
- `modelLimit`：模型明细条数，`1..50`（可选，默认 20）
- `accountId`：可选，不传使用当前 API key 账户

示例响应：

```json
{
  "ok": true,
  "accountId": "acct_demo",
  "period": {
    "from": "2026-03-01",
    "to": "2026-03-31",
    "fromMs": 1772323200000,
    "toMs": 1775001599999
  },
  "summary": {
    "requests": 1291,
    "promptTokens": 1823390,
    "completionTokens": 924110,
    "totalTokens": 2747500,
    "costCents": 8642,
    "chargedCents": 3210,
    "costAmount": 86.42,
    "chargedAmount": 32.1,
    "currency": "CNY"
  },
  "byModel": [
    {
      "modelAlias": "auto",
      "resolvedModel": "deepseek/deepseek-chat",
      "requests": 900,
      "promptTokens": 1200000,
      "completionTokens": 600000,
      "totalTokens": 1800000,
      "costCents": 5000,
      "chargedCents": 2000,
      "costAmount": 50,
      "chargedAmount": 20
    }
  ]
}
```

### 2.7 续费

`POST /token/v1/billing/renew`

请求体：

```json
{
  "accountId": "acct_demo",
  "planCode": "pro-monthly",
  "months": 1,
  "channel": "alipay",
  "outTradeNo": "renew_202603020001"
}
```

说明：

- 当前内置套餐：`basic-monthly`、`pro-monthly`。
- `amount` 可选，不传则按套餐月价 `* months` 自动计算。
- 有效期叠加逻辑：若当前套餐未过期，则在原到期时间上顺延。

## 3. 鉴权与账户映射

Token API key 与账户映射来自启动配置：

- `TOKEN_API_KEYS`：默认绑定到 `TOKEN_DEFAULT_ACCOUNT_ID`，兼容 `ROUTER_API_KEYS`
- `TOKEN_SEED_KEYS`：显式配置 `accountId -> keys`，兼容 `ROUTER_SEED_KEYS`

约束：

- 充值/续费接口只允许操作当前 API key 绑定账户。
- 未鉴权或 token 无效返回 `401`。

## 4. 计费规则（当前实现）

- 套餐有效期内：请求可继续，`charged_cents=0`
- 套餐过期后：按 token 计费，从余额扣除
- `stream=true`：按 `TOKEN_STREAM_FLAT_CENTS` 固定扣费

默认单价（可通过环境变量覆盖）：

- 输入：`TOKEN_PRICE_INPUT_PER_1M_CENTS=200`
- 输出：`TOKEN_PRICE_OUTPUT_PER_1M_CENTS=800`

## 5. 错误规范

常见状态码：

- `400` 参数错误
- `401` 鉴权失败
- `402` 余额不足
- `403` 账户不可用/越权
- `404` 资源不存在
- `503` 上游不可用

统一错误体：

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "type": "billing_error",
    "message": "余额不足，请充值或续费。",
    "request_id": "req_..."
  }
}
```

## 6. OpenClaw 接入示例

```toml
[models.providers.clawos_token]
baseUrl = "http://127.0.0.1:8788/v1"
apiKey = "${TOKEN_API_KEY}"
api = "openai-completions"

[[models.providers.clawos_token.models]]
id = "auto"
name = "ClawOS Auto Token"
```

```toml
[agents.defaults.model]
primary = "clawos_token/auto"
fallbacks = ["clawos_token/auto-fast"]
```
