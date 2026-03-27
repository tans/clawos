# ClawOS App Remote 接口（按真实执行链路）

## 1) 目标
服务端通过 `/api/remote/dispatch` 返回动作计划，App 侧按顺序执行。  
本文档不只描述 `ACTIONS` 字符串，还补充每个按钮在 App 中最终落到的真实后端任务与关键命令步骤。

### 1.1 本文档写法约定
- 除 `dispatch` 返回的动作外，本文在后文增加“实现级命令清单”，把每个按钮对应 Task 中实际执行的命令模板完整列出。
- 其中带 `<...>` 的部分是运行时变量（如端口、路径、IP、MCP 名称），其取值由当前机器环境和 payload 决定。

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
["openclaw gateway restart"]
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
[
  "powershell -NoProfile -Command \"$target='<normalized_managed_cli_exe_path>'; ... taskkill ...\"",
  "powershell -NoProfile -Command \"Start-Process -FilePath '<qwcli_exe_path>' -WorkingDirectory '<qwcli_working_dir>' -WindowStyle Hidden\"",
  "powershell -NoProfile -Command \"$target='<normalized_managed_cli_exe_path>'; ... probe process ...\""
]
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
["powershell -NoProfile -Command \"curl.exe -sS http://127.0.0.1:<cdp_port>/json/version\""]
```
- App 实际调用：`POST /api/browser/action`
- 后端真实任务：`startBrowserDetectTask()`
- 真实步骤（1 步）：
  1. 检测本机 `127.0.0.1:<cdpPort>` 是否可达。

### 3.5 browser.repair（浏览器修复）
- dispatch 返回动作：
```json
[
  "powershell -NoProfile -Command \"netsh advfirewall ... localport=<cdp_port>\"",
  "powershell -NoProfile -Command \"netsh interface portproxy ... listenport=<cdp_port> ...\"",
  "powershell -NoProfile -Command \"curl.exe -sS http://127.0.0.1:<cdp_port>/json/version\"",
  "openclaw config set browser.cdpUrl=http://<wsl_host_or_windows_ip>:<cdp_port>"
]
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
[
  "powershell -NoProfile -Command \"taskkill /F /IM chrome.exe; Start-Process ... --remote-debugging-port=<cdp_port> ...\"",
  "powershell -NoProfile -Command \"netsh advfirewall ... localport=<cdp_port>\"",
  "powershell -NoProfile -Command \"netsh interface portproxy ... listenport=<cdp_port> ...\"",
  "openclaw config set browser.cdpUrl=http://<wsl_host_or_windows_ip>:<cdp_port>"
]
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
[
  "wsl -d <distro> bash -lc \"<install-uv-for-wsl>\"",
  "wsl -d <distro> bash -lc \"uv --version\""
]
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
["echo windows-mcp uses local service mode (skip build.ps1)"]
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
["openclaw app update --trigger manual --auto-restart=true"]
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
["openclaw gateway restart"]
```
- App 实际调用：`POST /api/gateway/action`
- 当前真实行为：与 `gateway.restart` 一致，调用 `openclaw gateway restart`（不是独立的桌面进程重启流）。

### 3.11 app.log_center.open（打开日志中心）
- dispatch 返回动作：
```json
["openclaw app log-center open"]
```
- App 实际行为：不走后端任务，直接执行 UI 指令打开日志中心面板。

---

## 4) App 执行约束
1. 只接受 `executeOn=app` 且 `purpose=return-actions-for-app` 的 remote 响应。
2. 必须按顺序执行动作，不得重排。
3. 未知 `actionIntent` / 未知命令立即拒绝并上报。
4. `environment.install` / `mcp.build` / `app.upgrade` 只允许白名单 payload，禁止透传任意参数。
5. 所有后端任务都应将 `taskId` 接入日志中心跟踪。

---

## 5) 所有按钮实现级命令清单（全量）

> 说明：以下为当前代码里的真实命令模板；`<...>` 为运行时变量。

### 5.1 gateway.restart / app.restart
```bash
openclaw gateway restart
```

### 5.2 gateway.restart_qw
1) 停止目标进程（PowerShell）：
```powershell
$ErrorActionPreference = 'Stop'
$target = '<normalized_managed_cli_exe_path>'
$procs = @(Get-CimInstance Win32_Process -Filter "Name='cli.exe'" -ErrorAction SilentlyContinue | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath.Replace('/', '\\').Trim().ToLowerInvariant() -eq $target
})
if ($procs.Count -eq 0) { exit 0 }
foreach ($proc in $procs) {
  & taskkill /F /T /PID $proc.ProcessId | Out-Null
}
exit 0
```
2) 启动进程（PowerShell）：
```powershell
Start-Process -FilePath '<qwcli_exe_path>' -WorkingDirectory '<qwcli_working_dir>' -WindowStyle Hidden
```
3) 两次探活（PowerShell）：
```powershell
$target = '<normalized_managed_cli_exe_path>'
$p = @(Get-CimInstance Win32_Process -Filter "Name='cli.exe'" -ErrorAction SilentlyContinue | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath.Replace('/', '\\').Trim().ToLowerInvariant() -eq $target
})
if ($p.Count -gt 0) { exit 0 } else { exit 1 }
```

### 5.3 gateway.update（9 步）
```bash
cd /data/openclaw
cd /data/openclaw && git fetch origin main --prune && git reset --hard origin/main && git clean -fd
cd /data/openclaw && npm i -g nrm
cd /data/openclaw && nrm use tencent
cd /data/openclaw && pnpm install
cd /data/openclaw && pnpm run build
cd /data/openclaw && pnpm run ui:build
cd /data/openclaw && pnpm link --global
cd /data/openclaw && openclaw gateway restart
```

### 5.4 browser.detect
- 探测地址：
```text
GET http://127.0.0.1:<cdpPort>/json/version
```

### 5.5 browser.open_cdp
1) 杀掉 Chrome：
```bash
taskkill /F /IM chrome.exe /T
```
2) 启动 Chrome（PowerShell）：
```powershell
Start-Process -FilePath '<chrome_exe>' -WorkingDirectory '<chrome_dir>' -ArgumentList '--remote-debugging-address=127.0.0.1','--remote-debugging-port=<cdpPort>','--user-data-dir=<BROWSER_USER_DATA_DIR>','--new-window','--no-first-run','--no-default-browser-check','<BROWSER_BOOT_URL>' -WindowStyle Hidden
```
3) 防火墙规则（netsh）：
```bash
netsh.exe advfirewall firewall delete rule name=<BROWSER_CDP_FIREWALL_RULE_NAME>
netsh.exe advfirewall firewall add rule name=<BROWSER_CDP_FIREWALL_RULE_NAME> dir=in action=allow protocol=TCP localport=<cdpPort>
```
4) 端口代理（netsh）：
```bash
netsh.exe interface portproxy delete v4tov4 listenport=<cdpPort> listenaddress=<legacy_or_candidate_address>
netsh.exe interface portproxy add v4tov4 listenport=<cdpPort> listenaddress=<selected_windows_host> connectport=<cdpPort> connectaddress=127.0.0.1
```
5) WSL 连通性探测：
```bash
curl -fsS --globoff --max-time 4 "http://<windows_host>:<cdpPort>/json/version" >/dev/null
# 或 wget -q -T 4 -O - "http://<windows_host>:<cdpPort>/json/version" >/dev/null
```

### 5.6 browser.repair
与 `browser.open_cdp` 共用以下命令族（但不执行 taskkill + Start-Process）：
- 防火墙 `netsh advfirewall ...`
- portproxy `netsh interface portproxy ...`
- CDP 探测 `GET http://127.0.0.1:<cdpPort>/json/version`
- WSL 连通性探测 `curl/wget http://<windows_host>:<cdpPort>/json/version`

### 5.7 environment.install
#### target=windows, tool=python
```powershell
if (Get-Command python -ErrorAction SilentlyContinue) { python --version; exit 0 }
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
python --version
```
#### target=windows, tool=uv
```powershell
if (Get-Command uv -ErrorAction SilentlyContinue) { uv --version; exit 0 }
Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
uv --version
```
#### target=windows, tool=bun
```powershell
if (Get-Command bun -ErrorAction SilentlyContinue) { bun --version; exit 0 }
Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression
bun --version
```
#### target=wsl, tool=python
```bash
apt-get update
apt-get install -y python3 python3-pip
python3 --version
```
#### target=wsl, tool=uv
```bash
apt-get update
apt-get install -y curl ca-certificates
curl -LsSf https://astral.sh/uv/install.sh | sh
uv --version
```
#### target=wsl, tool=bun
```bash
apt-get update
apt-get install -y curl ca-certificates
curl -fsSL https://bun.sh/install | bash
bun --version
```

### 5.8 mcp.build
- `windows-mcp`：无构建命令（本地服务模式，跳过 legacy build）。
- 其他 MCP：
```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File <repo>/mcp/<name>/build.ps1
```

### 5.9 app.upgrade
- 触发命令入口（API）：
```text
POST /api/app/update/run {"trigger":"manual","autoRestart":<true|false>}
```
- 任务内部执行为更新器流程（检查 -> 下载 -> 应用），命令由更新器实现托管，不是固定 shell 单行命令。

### 5.10 app.log_center.open
```text
UI open-log-center
```
