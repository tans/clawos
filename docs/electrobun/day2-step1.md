# Electrobun 迁移 Day 2 - Step 1

## 本步完成
- 新增 Electrobun 配置文件：`electrobun.config.ts`
- 新增桌面主进程入口：`src/bun/index.ts`

## 行为说明
- 启动时优先探测本地 ClawOS 服务：`http://127.0.0.1:<port>/api/health`
- 若服务未启动，主进程会动态加载现有 `src/server.ts` 拉起服务
- 自动设置 `CLAWOS_AUTO_OPEN_BROWSER=0`，避免桌面壳模式下弹出外部浏览器
- 服务就绪后，窗口加载本地 URL；若失败，展示启动错误页

## 范围边界
- 不改现有 `src/routes/*`、`src/tasks/*`、Gateway/WSL 逻辑
- 不改现有 Bun 单文件打包产线（`build:exe`）
