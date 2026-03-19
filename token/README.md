# clawos-token

方案1实现：官方直连多供应商（OpenAI / DeepSeek / Anthropic），对外提供统一 OpenAI 兼容接口，并带最小可用计费（余额/充值/续费）。

## 已实现接口

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `GET /token/v1/account/balance`
- `GET /token/v1/billing/usage`
- `POST /token/v1/billing/recharge`
- `POST /token/v1/billing/renew`

## 路由与计费行为

- 别名模型：`auto`、`auto-fast`、`auto-code`
- provider fallback：DeepSeek -> OpenAI -> Anthropic
- provider key 轮换：同 provider 支持 `*_API_KEYS` 轮询
- 余额与续费：
  - 有效套餐内：请求可继续（`charged_cents=0`）
  - 套餐失效后：按 token 成本从余额扣费
- `stream=true`：按 `ROUTER_STREAM_FLAT_CENTS` 固定扣费（默认 1 分）

## 环境变量

### 服务基础

- `TOKEN_PORT`：监听端口（兼容 `ROUTER_PORT`，默认 `8788`）
- `TOKEN_DB_PATH`：SQLite 路径（兼容 `ROUTER_DB_PATH`，默认 `token/data/token.db`）
- `TOKEN_CURRENCY`：计费币种（兼容 `ROUTER_CURRENCY`，默认 `CNY`）

### 鉴权与账户

- `TOKEN_REQUIRE_AUTH`：`1` 时强制鉴权，兼容 `ROUTER_REQUIRE_AUTH`
- `TOKEN_DEFAULT_ACCOUNT_ID`：默认账户（兼容 `ROUTER_DEFAULT_ACCOUNT_ID`，默认 `acct_demo`）
- `TOKEN_DEFAULT_ACCOUNT_NAME`：默认账户名（兼容 `ROUTER_DEFAULT_ACCOUNT_NAME`，默认 `Demo Account`）
- `TOKEN_API_KEYS`：逗号分隔 API key，兼容 `ROUTER_API_KEYS`
- `TOKEN_SEED_KEYS`：显式绑定 key 到账户，兼容 `ROUTER_SEED_KEYS`，格式：
  - `acct_demo:rk_demo_1|rk_demo_2;acct_team:rk_team_1`

### 上游 provider

- `OPENAI_API_KEY` 或 `OPENAI_API_KEYS`
- `DEEPSEEK_API_KEY` 或 `DEEPSEEK_API_KEYS`
- `ANTHROPIC_API_KEY` 或 `ANTHROPIC_API_KEYS`
- `OPENAI_BASE_URL`（默认 `https://api.openai.com`）
- `DEEPSEEK_BASE_URL`（默认 `https://api.deepseek.com`）
- `ANTHROPIC_BASE_URL`（默认 `https://api.anthropic.com`）

### 模型映射

- `TOKEN_MODEL_AUTO_DEEPSEEK` / `ROUTER_MODEL_AUTO_DEEPSEEK`
- `TOKEN_MODEL_AUTO_OPENAI` / `ROUTER_MODEL_AUTO_OPENAI`
- `TOKEN_MODEL_AUTO_ANTHROPIC` / `ROUTER_MODEL_AUTO_ANTHROPIC`
- `TOKEN_MODEL_FAST_DEEPSEEK` / `ROUTER_MODEL_FAST_DEEPSEEK`
- `TOKEN_MODEL_FAST_OPENAI` / `ROUTER_MODEL_FAST_OPENAI`
- `TOKEN_MODEL_CODE_DEEPSEEK` / `ROUTER_MODEL_CODE_DEEPSEEK`
- `TOKEN_MODEL_CODE_OPENAI` / `ROUTER_MODEL_CODE_OPENAI`
- `TOKEN_MODEL_CODE_ANTHROPIC` / `ROUTER_MODEL_CODE_ANTHROPIC`

### 计费参数

- `TOKEN_PRICE_INPUT_PER_1M_CENTS` / `ROUTER_PRICE_INPUT_PER_1M_CENTS`（默认 `200`）
- `TOKEN_PRICE_OUTPUT_PER_1M_CENTS` / `ROUTER_PRICE_OUTPUT_PER_1M_CENTS`（默认 `800`）
- `TOKEN_STREAM_FLAT_CENTS` / `ROUTER_STREAM_FLAT_CENTS`（默认 `1`）
- `TOKEN_PLAN_BASIC_MONTHLY_CENTS` / `ROUTER_PLAN_BASIC_MONTHLY_CENTS`（默认 `3900`）
- `TOKEN_PLAN_PRO_MONTHLY_CENTS` / `ROUTER_PLAN_PRO_MONTHLY_CENTS`（默认 `9900`）

## 启动

```bash
cd token
bun run dev
```

## OpenClaw 配置示例

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
