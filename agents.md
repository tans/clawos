clawos 一个基于 windows + bun + WSL 的 openclaw 管理工具

本文档用于说明产品定位、核心功能、运行与更新流程。面向中文用户，重点优化 Windows 体验。

## 项目概述
- 本机提供 8080 端口的 HTTP 服务，供用户访问与操作
- 程序打包为可执行文件分发给 Windows 用户
- UI 基于 shadcn/ui 构建

openclaw 官方文档：https://docs.openclaw.ai
重点关注 gateway 章节：https://docs.openclaw.ai/gateway
我们会基于 Gateway Protocol 提供方便用户的可视化操作和数据展现。

## 目标
1. 中文用户友好
2. 针对 Windows 用户优化

## 功能范围（基于 Gateway Protocol）
1. 控制面板：升级、重启
2. 配置 channels
3. 配置 agents
4. 配置 技能（skills）
5. 配置 浏览器（browser）
6. 配置 自启动（auto start）

## 运行环境与目录
- openclaw 唯一 WSL 目录：/data/openclaw
- openclaw 配置目录：/root/.openclaw
- clawos 提供本机 8080 端口 HTTP 服务

## 更新 openclaw（标准流程）
openclaw 在 WSL 的 /data/openclaw 中，以 git 源码形式存在。标准更新流程如下：

1. 进入 /data/openclaw
2. 由于本地 lock 文件冲突，使用以下方式拉取：
   - git pull -X theirs
3. 使用腾讯源：
   - nrm use tencent
4. 安装依赖：
   - pnpm install
5. 构建：
   - pnpm run build
6. 构建 UI：
   - pnpm run ui:build
7. 重启 gateway：
   - openclaw gateway restart

这是标准的更新流程，需要写到 bun 中调用 WSL 执行。

## WSL 调用要求（由 bun 执行）
- clawos 需要调用 WSL 执行上述更新流程
- 确保命令按顺序执行，遇到错误需提示用户并中止后续步骤
- 建议在 UI 中提供步骤日志与进度状态

## 关于软件自身的更新（clawos）
程序会通过 bun build 成可执行文件。
自动更新受文件锁影响，需要通过“先重命名旧文件，再替换新文件”的方式完成更新。

## 体验优化建议（Windows）
- 统一引导用户完成 WSL 初始化与 openclaw 安装
- 针对中文用户提供清晰的错误提示与修复建议
- 端口占用、WSL 未启动、权限不足等常见问题需明确说明
