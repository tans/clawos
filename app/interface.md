# ClawOS App Desktop 远程接口清单（interface.md）

> 目标：穷举当前 **App Desktop** 使用的远程编排请求与响应，作为前后端联调与 iOS/其他客户端实现的统一契约。
>
> 基于当前实现：`web/src/routes/remote.ts`。

---

## 1. 总览

当前远程编排只做一件事：

1. 客户端（App Desktop）上报用户动作 + 环境信息；
2. 服务端返回 **plan-only** 指令（不在服务端执行）；
3. 客户端按指令在本地执行。

### 1.1 固定约束

- `purpose` 固定：`"return-instructions-for-app"`
- `mode` 固定：`"plan-only"`
- `executeOn` 固定：`"app"`
- 执行器白名单固定：`["shell", "powershell", "wsl"]`

---

## 2. 接口 1：获取可用动作目录

### 2.1 请求

- Method: `GET`
- Path: `/api/remote/catalog`
- Body: 无

### 2.2 成功响应（200）

```json
{
  "ok": true,
  "executors": ["shell", "powershell", "wsl"],
  "purpose": "return-instructions-for-app",
  "actions": [
    { "actionIntent": "gateway.restart", "title": "重启 openclaw", "payloadSchema": {} },
    { "actionIntent": "gateway.restart_qw", "title": "重启企微网关", "payloadSchema": {} },
    { "actionIntent": "gateway.update", "title": "升级 openclaw", "payloadSchema": {} },
    { "actionIntent": "browser.detect", "title": "浏览器检测", "payloadSchema": {} },
    { "actionIntent": "browser.repair", "title": "浏览器修复", "payloadSchema": {} },
    { "actionIntent": "browser.open_cdp", "title": "打开浏览器 CDP", "payloadSchema": {} },
    { "actionIntent": "environment.install", "title": "环境安装", "payloadSchema": { "target": "windows|wsl", "tool": "python|uv|bun" } },
    { "actionIntent": "mcp.build", "title": "构建 MCP", "payloadSchema": { "name": "windows-mcp|yingdao-mcp|wechat-mcp|crm-mcp" } },
    { "actionIntent": "app.upgrade", "title": "桌面升级", "payloadSchema": { "autoRestart": "boolean" } },
    { "actionIntent": "app.restart", "title": "桌面重启", "payloadSchema": {} },
    { "actionIntent": "app.log_center.open", "title": "打开日志中心", "payloadSchema": {} }
  ]
}
```

---

## 3. 接口 2：下发远程编排计划

### 3.1 请求

- Method: `POST`
- Path: `/api/remote/dispatch`
- Headers: `Content-Type: application/json`

#### 请求体结构

```ts
type RemoteDispatchRequest = {
  actionIntent: RemoteIntent;
  payload?: Record<string, unknown>;
  envSnapshot?: Record<string, unknown>;
};
```

#### `actionIntent` 枚举

```ts
type RemoteIntent =
  | "gateway.restart"
  | "gateway.restart_qw"
  | "gateway.update"
  | "browser.detect"
  | "browser.repair"
  | "browser.open_cdp"
  | "environment.install"
  | "mcp.build"
  | "app.upgrade"
  | "app.restart"
  | "app.log_center.open";
```

### 3.2 成功响应（200）

```ts
type RemoteDispatchSuccess = {
  ok: true;
  mode: "plan-only";
  executeOn: "app";
  plan: RemotePlan;
};

type RemoteExecutor = "shell" | "powershell" | "wsl";

type AppInstruction = {
  id: string;
  title: string;
  executor: RemoteExecutor;
  runOn: "app";
  type: "api-call" | "ui-command";
  request?: {
    method: "GET" | "POST" | "PUT" | "PATCH";
    path: string;
    body?: Record<string, unknown>;
  };
  command?: "open-log-center";
};

type RemotePlan = {
  version: "1.0";
  actionIntent: RemoteIntent;
  purpose: "return-instructions-for-app";
  constraints: {
    allowedExecutors: RemoteExecutor[];
  };
  instructions: AppInstruction[];
};
```

### 3.3 失败响应（400）

```ts
type RemoteDispatchError = {
  ok: false;
  error: string; // 例如: "unsupported actionIntent: <empty>"
};
```

---

## 4. 按 actionIntent 穷举（请求与响应）

> 下列为 `POST /api/remote/dispatch` 的“最小请求 + 关键响应片段”。

### 4.1 `gateway.restart`

请求：

```json
{ "actionIntent": "gateway.restart" }
```

响应（plan.instructions[0]）：

```json
{
  "id": "gateway-restart",
  "title": "重启 openclaw",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/gateway/action",
    "body": { "action": "restart" }
  }
}
```

### 4.2 `gateway.restart_qw`

请求：

```json
{ "actionIntent": "gateway.restart_qw" }
```

响应：

```json
{
  "id": "gateway-restart-qw",
  "title": "重启企微网关",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/gateway/action",
    "body": { "action": "restart-qw-gateway" }
  }
}
```

### 4.3 `gateway.update`

请求：

```json
{ "actionIntent": "gateway.update" }
```

响应：

```json
{
  "id": "gateway-update",
  "title": "升级 openclaw",
  "executor": "wsl",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/gateway/update",
    "body": {}
  }
}
```

### 4.4 `browser.detect`

请求：

```json
{ "actionIntent": "browser.detect" }
```

响应：

```json
{
  "id": "browser-action",
  "title": "浏览器动作: detect",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/browser/action",
    "body": { "action": "detect" }
  }
}
```

### 4.5 `browser.repair`

请求：

```json
{ "actionIntent": "browser.repair" }
```

响应：

```json
{
  "id": "browser-action",
  "title": "浏览器动作: repair",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/browser/action",
    "body": { "action": "repair", "confirmed": true }
  }
}
```

### 4.6 `browser.open_cdp`

请求：

```json
{ "actionIntent": "browser.open_cdp" }
```

响应：

```json
{
  "id": "browser-action",
  "title": "浏览器动作: open-cdp",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/browser/action",
    "body": { "action": "open-cdp", "confirmed": true }
  }
}
```

### 4.7 `environment.install`

请求（可选 payload，不传则默认 `target=wsl`、`tool=python`）：

```json
{
  "actionIntent": "environment.install",
  "payload": { "target": "windows", "tool": "bun" }
}
```

响应：

```json
{
  "id": "environment-install",
  "title": "环境安装 windows/bun",
  "executor": "powershell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/environment/install",
    "body": { "target": "windows", "tool": "bun" }
  }
}
```

> 当 `target` 不是 `windows` 时，`executor` 为 `wsl`。

### 4.8 `mcp.build`

请求（可选 payload，不传则默认 `name=windows-mcp`）：

```json
{
  "actionIntent": "mcp.build",
  "payload": { "name": "wechat-mcp" }
}
```

响应：

```json
{
  "id": "mcp-build",
  "title": "构建 MCP wechat-mcp",
  "executor": "wsl",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/mcp/build",
    "body": { "name": "wechat-mcp" }
  }
}
```

### 4.9 `app.upgrade`

请求（可传 `envSnapshot.autoRestart`）：

```json
{
  "actionIntent": "app.upgrade",
  "envSnapshot": { "autoRestart": false }
}
```

响应：

```json
{
  "id": "app-upgrade",
  "title": "升级桌面客户端",
  "executor": "shell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/app/update/run",
    "body": { "trigger": "manual", "autoRestart": false }
  }
}
```

> 若未提供 `envSnapshot.autoRestart`，默认 `autoRestart=true`。

### 4.10 `app.restart`

请求：

```json
{ "actionIntent": "app.restart" }
```

响应：

```json
{
  "id": "app-restart",
  "title": "重启 openclaw",
  "executor": "shell",
  "runOn": "app",
  "type": "api-call",
  "request": {
    "method": "POST",
    "path": "/api/gateway/action",
    "body": { "action": "restart" }
  }
}
```

### 4.11 `app.log_center.open`

请求：

```json
{ "actionIntent": "app.log_center.open" }
```

响应：

```json
{
  "id": "open-log-center",
  "title": "打开日志中心",
  "executor": "shell",
  "runOn": "app",
  "type": "ui-command",
  "command": "open-log-center"
}
```

---

## 5. 客户端（App Desktop）实现要求建议

为避免云端/客户端语义漂移，建议 App Desktop 按以下规则执行：

1. 只接受 `mode=plan-only` 且 `executeOn=app` 的响应。
2. 只执行 `constraints.allowedExecutors` 中允许的执行器。
3. 仅在 `runOn=app` 时执行指令。
4. `type=api-call` 时调用本地 API；`type=ui-command` 时执行 UI 动作。
5. 对未知 `actionIntent` 或未知指令字段做拒绝并上报。

---

## 6. 变更同步规则

当新增/修改 `actionIntent` 时，需要同时更新：

- `web/src/routes/remote.ts` 中的 `RemoteIntent`、`buildPlan()`、`buildCatalog()`
- 本文档 `app/interface.md`
- 对应自动化测试 `web/test/remote-routes.test.ts`

