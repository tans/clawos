# ClawOS App Remote 接口（按真实执行链路）

## 1) 目标
服务端通过 `/api/remote/dispatch` 返回动作计划，App 侧按顺序执行。  
本文档不只描述 `ACTIONS` 字符串，还补充每个按钮在 App 中最终落到的真实后端任务与关键命令步骤。

---

## 2) 接口

### 2.1 获取动作目录（渲染按钮）
- **GET** `/api/remote/catalog`

返回示例：
```json
{
  "ok": true,
  "executors": ["shell", "powershell", "wsl"],
  "purpose": "return-actions-for-app",
  "actions": [
    { "actionIntent": "gateway.restart", "title": "重启 openclaw", "payloadSchema": {} },
    { "actionIntent": "gateway.restart_qw", "title": "重启企微网关", "payloadSchema": {} },
    { "actionIntent": "gateway.update", "title": "升级 openclaw", "payloadSchema": {} },
    { "actionIntent": "browser.detect", "title": "浏览器检测", "payloadSchema": {} },
    { "actionIntent": "browser.repair", "title": "浏览器修复", "payloadSchema": {} },
    { "actionIntent": "browser.open_cdp", "title": "打开浏览器 CDP", "payloadSchema": {} },
    { "actionIntent": "environment.install", "title": "环境安装", "payloadSchema": { "target": "windows|wsl", "tool": "python|uv|bun" } },
    { "actionIntent": "mcp.build", "title": "构建 MCP", "payloadSchema": { "name": "windows-mcp|yingdao-mcp|wechat-mcp|crm-mcp" } },
    { "actionIntent": "app.upgrade", "title": "桌面升级", "payloadSchema": {} },
    { "actionIntent": "app.restart", "title": "桌面重启", "payloadSchema": {} },
    { "actionIntent": "app.log_center.open", "title": "打开日志中心", "payloadSchema": {} }
  ]
}
```

### 2.2 下发动作（点击按钮后调用）
- **POST** `/api/remote/dispatch`
- Header: `Content-Type: application/json`

请求体：
```ts
type RemoteDispatchRequest = {
  actionIntent:
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
  payload?: Record<string, unknown>;
  envSnapshot?: Record<string, unknown>;
};
```

---

## 3) “按钮 -> dispatch -> 实际任务”完整行为

> 统一执行模型（与 `gateway.update` 一样）：
> 1) App 点击按钮，先 `POST /api/remote/dispatch` 拿到动作。  
> 2) App 再按动作调用具体业务 API。  
> 3) 业务 API 创建 Task；真实命令在 Task 中执行（日志中心可见）。

### 3.1 gateway.restart（重启 openclaw）
- dispatch 返回动作：
```json
["POST /api/gateway/action {\"action\":\"restart\"}"]
```
- App 实际调用：`POST /api/gateway/action`
- 后端真实任务：`startGatewayControlTask("restart")`
- 真实命令：
```bash
openclaw gateway restart
```

### 3.2 gateway.restart_qw（重启企微网关）
- dispatch 返回动作：
```json
["POST /api/gateway/action {\"action\":\"restart-qw-gateway\"}"]
```
- App 实际调用：`POST /api/gateway/action`
- 后端真实任务：`startQwGatewayRestartTask()`
- 真实步骤（3 步）：
  1. 停止目标 `cli.exe`（仅管理指定 ExecutablePath）。
  2. 用 PowerShell 启动企微网关进程。
  3. 10 秒稳定性探活（进程仍存活才算成功）。

### 3.3 gateway.update（升级 openclaw，源码升级标准）
- dispatch 返回动作：
```json
[
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
```
- App 实际调用：`POST /api/gateway/update`
- 后端真实任务：`startGatewayUpdateTask()` -> `buildOpenclawSourceUpdateSteps()`
- 真实步骤（9 步）：
  1. 进入源码目录 `/data/openclaw`
  2. 强制同步源码（`git fetch/reset/clean`）
  3. 安装 `nrm`
  4. 切换 npm 源 `nrm use tencent`
  5. `pnpm install`
  6. `pnpm run build`
  7. `pnpm run ui:build`
  8. `pnpm link --global`
  9. `openclaw gateway restart`

### 3.4 browser.detect（浏览器检测）
- dispatch 返回动作：
```json
["POST /api/browser/action {\"action\":\"detect\"}"]
```
- App 实际调用：`POST /api/browser/action`
- 后端真实任务：`startBrowserDetectTask()`
- 真实步骤（1 步）：
  1. 检测本机 `127.0.0.1:<cdpPort>` 是否可达。

### 3.5 browser.repair（浏览器修复）
- dispatch 返回动作：
```json
["POST /api/browser/action {\"action\":\"repair\",\"confirmed\":true}"]
```
- App 实际调用：`POST /api/browser/action`
- 后端真实任务：`startBrowserRepairTask()`
- 真实步骤（4 步）：
  1. 确保 Windows 防火墙 CDP 规则。
  2. 确保 WSL 访问端口代理（portproxy）。
  3. 读取本机 CDP endpoint。
  4. 回写 openclaw browser 配置（`browser.cdpUrl`）。

### 3.6 browser.open_cdp（打开浏览器 CDP）
- dispatch 返回动作：
```json
["POST /api/browser/action {\"action\":\"open-cdp\",\"confirmed\":true}"]
```
- App 实际调用：`POST /api/browser/action`
- 后端真实任务：`startBrowserRestartTask()`
- 真实步骤（4 步）：
  1. 结束现有 `chrome.exe`，按可用端口重启 Chrome（带 remote-debugging 参数）。
  2. 确保 Windows 防火墙 CDP 规则。
  3. 配置 WSL 端口代理并生成可访问的 remote CDP URL。
  4. 记录端口与 endpoint，并写回 openclaw browser 配置。

### 3.7 environment.install（环境安装）
- dispatch 返回动作（示例）：
```json
["POST /api/environment/install {\"target\":\"wsl\",\"tool\":\"uv\"}"]
```
- payload 白名单：
  - `target`: `windows | wsl`
  - `tool`: `python | uv | bun`
- App 实际调用：`POST /api/environment/install`
- 后端真实任务：`startEnvironmentInstallTask(target, tool)`
- 真实步骤（2 步）：
  1. 安装工具（Windows 走 PowerShell；WSL 走 bash 脚本，含 apt/curl/安装脚本）。
  2. 二次验证（`python/uv/bun --version`）。

### 3.8 mcp.build（构建 MCP）
- dispatch 返回动作（示例）：
```json
["POST /api/mcp/build {\"name\":\"windows-mcp\"}"]
```
- payload 白名单：
  - `name`: `windows-mcp | yingdao-mcp | wechat-mcp | crm-mcp`
- App 实际调用：`POST /api/mcp/build`
- 后端真实任务：`startMcpBuildTask(name)`
- 真实行为：
  - `windows-mcp`：跳过 legacy build，改为本地服务模式（不执行 `build.ps1`）。
  - 其他 MCP：执行 `powershell -File mcp/<name>/build.ps1`，并检查 dist 产物是否生成。

### 3.9 app.upgrade（桌面升级）
- dispatch 返回动作（示例）：
```json
["POST /api/app/update/run {\"trigger\":\"manual\",\"autoRestart\":true}"]
```
- payload：`autoRestart` 缺省为 `true`。
- App 实际调用：`POST /api/app/update/run`
- 后端真实任务：`startSelfUpdateTask("manual", { autoRestart })`
- 真实步骤（3 步）：
  1. 检查更新（读取当前/远端版本、hash、channel）。
  2. 下载更新包。
  3. 应用更新（`autoRestart=true`）或仅标记“下载完成待应用”（`autoRestart=false`）。

### 3.10 app.restart（桌面重启）
- dispatch 返回动作：
```json
["POST /api/gateway/action {\"action\":\"restart\"}"]
```
- App 实际调用：`POST /api/gateway/action`
- 当前真实行为：与 `gateway.restart` 一致，调用 `openclaw gateway restart`（不是独立的桌面进程重启流）。

### 3.11 app.log_center.open（打开日志中心）
- dispatch 返回动作：
```json
["UI open-log-center"]
```
- App 实际行为：不走后端任务，直接执行 UI 指令打开日志中心面板。

---

## 4) App 执行约束
1. 只接受 `executeOn=app` 且 `purpose=return-actions-for-app` 的 remote 响应。
2. 必须按顺序执行动作，不得重排。
3. 未知 `actionIntent` / 未知命令立即拒绝并上报。
4. `environment.install` / `mcp.build` / `app.upgrade` 只允许白名单 payload，禁止透传任意参数。
5. 所有后端任务都应将 `taskId` 接入日志中心跟踪。
