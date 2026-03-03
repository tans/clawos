# Electrobun 迁移 Day 1（基线冻结）

## 今日目标
- 不改变现有 `Bun.serve + 本地 HTTP` 主链路。
- 为 Electrobun 迁移准备脚手架入口（先改 `package.json`）。
- 固化当前行为基线，后续每一阶段都做回归对照。

## 已完成
- `package.json` 新增 Electrobun 脚本：
  - `desktop:dev`
  - `desktop:build`
  - `desktop:build:canary`
  - `desktop:build:stable`
- `package.json` 新增开发依赖：
  - `electrobun@^1.13.1`

## 当前必须保持不变的能力（回归基线）
- 本地服务启动：
  - `bun run dev` 可正常启动 `http://localhost:8080`
- 任务编排：
  - `gateway-update` 仍按顺序执行 WSL 更新步骤（失败即中止）
- 网关控制：
  - `POST /api/gateway/action` 的 `restart/status/install/uninstall/start/stop`
- 企微网关控制：
  - `restart-qw-gateway` 的 taskkill + 启动 + 10 秒稳定性校验
- 系统检测：
  - `GET /api/system/check`
- 页面访问：
  - `/`、`/config/*`、`/sessions`

## Day 2 入口（下一步）
- 增加 Electrobun 主进程壳：
  - 窗口加载 `http://127.0.0.1:8080`
  - 仅负责窗口与生命周期，不改业务 API
- 保留现有 `bun build --compile` 产线，Electrobun 构建先并行验证，不替换正式发布。

