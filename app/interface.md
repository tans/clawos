# ClawOS App Remote 接口（精简版）

## 1) 目标
服务端只返回按顺序执行的命令数组：`ACTIONS`。
App 端按顺序执行，不做服务端执行。

---

## 2) 接口

### 2.1 获取动作目录
- **GET** `/api/remote/catalog`

返回示例：
```json
{
  "ok": true,
  "executors": ["shell", "powershell", "wsl"],
  "purpose": "return-actions-for-app",
  "actions": [
    { "actionIntent": "gateway.restart", "title": "重启 openclaw", "payloadSchema": {} },
    { "actionIntent": "gateway.update", "title": "升级 openclaw", "payloadSchema": {} }
  ]
}
```

### 2.2 下发动作
- **POST** `/api/remote/dispatch`
- Header: `Content-Type: application/json`

请求体：
```ts
type RemoteDispatchRequest = {
  actionIntent: string;
  payload?: Record<string, unknown>;
  envSnapshot?: Record<string, unknown>;
};
```

成功响应：
```ts
type RemoteDispatchSuccess = {
  ok: true;
  executeOn: "app";
  purpose: "return-actions-for-app";
  actionIntent: string;
  allowedExecutors: Array<"shell" | "powershell" | "wsl">;
  ACTIONS: string[];
};
```

失败响应：
```ts
type RemoteDispatchError = {
  ok: false;
  error: string;
};
```

---

## 3) 关键行为

### 3.1 重启 openclaw
请求：
```json
{ "actionIntent": "gateway.restart" }
```

响应：
```json
{
  "ACTIONS": ["POST /api/gateway/action {\"action\":\"restart\"}"]
}
```

### 3.2 更新 openclaw（完整流程）
请求：
```json
{ "actionIntent": "gateway.update" }
```

响应：
```json
{
  "ACTIONS": [
    "cd /data/openclaw",
    "cd /data/openclaw && git fetch origin main --prune && git reset --hard origin/main && git clean -fd",
    "cd /data/openclaw && npm i -g nrm",
    "cd /data/openclaw && nrm use tencent",
    "cd /data/openclaw && pnpm install",
    "cd /data/openclaw && pnpm run build",
    "cd /data/openclaw && pnpm run ui:build",
    "cd /data/openclaw && pnpm link --global",
    "cd /data/openclaw && openclaw gateway restart"
  ]
}
```

---

## 4) App 执行约束
1. 只接受 `executeOn=app` 且 `purpose=return-actions-for-app`。
2. 严格按 `ACTIONS` 顺序执行。
3. 对未知 `actionIntent` / 未知命令直接拒绝并上报。
