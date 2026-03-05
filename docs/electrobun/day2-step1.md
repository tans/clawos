# Electrobun 迁移 Day 2 - Step 1

## 本步完成
- 新增 Electrobun 配置文件：`electrobun.config.ts`
- 新增桌面主进程入口：`src/bun/index.ts`

## 行为说明
- 启动时直接创建桌面窗口并加载 `views://clawos/shell.html`
- 页面数据通过 RPC 转发到本地 API 处理器，不再依赖 `src/server.ts`
- 若桌面壳初始化失败，展示启动错误页

## 范围边界
- 不改现有 `src/routes/*`、`src/tasks/*`、Gateway/WSL 逻辑
- 构建产线切换为 Electrobun 桌面构建
