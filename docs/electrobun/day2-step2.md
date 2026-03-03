# Electrobun 迁移 Day 2 - Step 2

## 本步完成
- `desktop:dev` 改为开发编排脚本：`scripts/desktop-dev.ts`
- 新增 `tailwind:watch`，实现样式增量构建
- Electrobun 增加 watch 配置：`src`、`dist`、`electrobun.config.ts`
- 桌面壳支持开发模式日志与自动打开 DevTools（`CLAWOS_DESKTOP_DEV=1`）

## 开发命令
- 推荐：`bun run desktop:dev`
- 原始命令（调试用）：`bun run desktop:dev:raw`

## 作用
- 一条命令启动 `Tailwind watch + Electrobun watch`
- 当 `src/*` 或 `dist/output.css` 变化时可自动重建并重启桌面壳
- 失败时会输出明确的子进程退出信息，便于定位问题
