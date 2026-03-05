# Electrobun 迁移 Day 1（基线冻结）

## 今日目标
- 切换到 Electrobun 桌面主链路（`views:// + RPC`）。
- 从运行时移除 `Bun.serve + 本地 HTTP` 依赖。
- 固化迁移后基线，后续迭代只在桌面架构上演进。

## 已完成
- `package.json` 新增 Electrobun 脚本：
  - `desktop:dev`
  - `desktop:build`
  - `desktop:build:canary`
  - `desktop:build:stable`
- `package.json` 新增开发依赖：
  - `electrobun@^1.13.1`

## 当前必须保持不变的能力（回归基线）
- 桌面壳启动：
  - `bun run dev` 可正常打开 Electrobun 客户端窗口
- 任务编排：
  - `gateway-update` 仍按顺序执行 WSL 更新步骤（失败即中止）
- 网关控制：
  - `POST /api/gateway/action` 的 `restart/status/install/uninstall/start/stop`
- 企微网关控制：
  - `restart-qw-gateway` 的 taskkill + 启动 + 10 秒稳定性校验
- 系统检测：
  - `GET /api/system/check`
- 页面访问：
  - `views://clawos/shell.html` 中可访问 `/`、`/config/*`、`/sessions`

## Day 2 入口（下一步）
- 增加 Electrobun 主进程壳：
  - 窗口加载 `views://clawos/shell.html`
  - 由 RPC 直连本地 API 处理器，不暴露本地 HTTP 端口
- 构建以 `electrobun build` 为主。
