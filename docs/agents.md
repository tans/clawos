# clawos monorepo 协作说明（agents.md）

本文档用于说明 `clawos` 仓库的定位、目录结构、关键子项目，以及常用开发命令。
面向在本仓库协作的开发者/Agent，默认以中文沟通。

## 1. 项目定位

`clawos` 是一个围绕 **Windows + Bun + WSL + openclaw Gateway** 的工具集合，核心目标：

1. 为中文用户提供更友好的 OpenClaw 使用体验。
2. 针对 Windows 场景，降低 WSL、Gateway、模型配置、运维操作门槛。
3. 同时支持本地桌面端与云端配套服务（控制面、路由、官网、调试 Provider）。

## 2. Monorepo 重要项目介绍

以下目录是当前 monorepo 中最重要的几个项目：

### 2.1 `app/`（桌面端主工程）
- 目录：`app/src/`、`scripts/`、根目录构建配置文件（如 `electrobun.config.ts`）
- 职责：
  - ClawOS 桌面应用主逻辑（Electrobun + Bun）。
  - 本地页面与系统交互（含 WSL 调用、Gateway 相关流程）。
  - 打包发布 Windows 可执行安装产物。
- 常用命令：
  - `bun run dev`
  - `bun run desktop:build`

### 2.2 `company/`（云端控制面）
- 职责：
  - 提供云端主机管理与任务下发能力。
  - 对接 Agent 心跳、命令拉取与结果回传。
  - 支持控制台查看运行状态与执行记录。
- 技术栈：Bun + Hono + SQLite。
- 本地启动：`cd company && bun run dev`

### 2.3 `router/`（模型路由与计费）
- 职责：
  - 对外暴露 OpenAI 兼容接口。
  - 聚合多供应商模型并提供 fallback。
  - 提供基础余额/充值/续费与账单查询能力。
- 本地启动：`cd router && bun run dev`

### 2.4 `web/`（官网与下载服务）
- 职责：
  - 提供官网页面与下载入口。
  - 承载安装包与配置文件的上传/分发接口。
  - 提供 latest release 元数据读取。
- 本地启动：`cd web && bun run dev`

### 2.5 `freegpt/`（联调用 Provider）
- 职责：
  - 提供本地可用的 OpenAI 兼容回显服务。
  - 用于桌面端/路由层的联调与快速测试。
- 本地启动：`bun run freegpt:dev`

## 3. openclaw 相关约定（运行环境）

- openclaw 在 WSL 中的目录：`/data/openclaw`
- openclaw 配置目录：`/root/.openclaw`
- 关于端口说明（修正）：
  - 当前版本的桌面端主工程**没有固定的 8080 HTTP 监听**（`8080` 属于历史文档描述）。
  - 目前仅有单实例控制端口（默认 `8151`，本机回环地址）用于实例间唤起/聚焦，不对外作为业务 HTTP API 端口。
  - 若涉及浏览器任务，`http://localhost:8080` 仅是可配置的启动 URL 默认值，不代表主程序必然监听该端口。

## 4. 更新 openclaw 的标准流程（WSL 内执行）

当需要在 WSL 内更新 openclaw 源码与构建产物时，按顺序执行：

1. `cd /data/openclaw`
2. `git pull -X theirs`
3. `nrm use tencent`
4. `pnpm install`
5. `pnpm run build`
6. `pnpm run ui:build`
7. `openclaw gateway restart`

要求：
- 桌面端如封装该流程，必须串行执行。
- 任一步失败应中断后续步骤，并向用户输出清晰错误信息。
- 建议在 UI 中展示步骤日志与进度状态。

## 5. 开发协作约定

1. 新增功能优先放在对应子项目目录，避免把云端能力写入桌面端主工程。
2. 涉及协议/API 变更时，优先更新对应 README 与接口说明。
3. 与 Windows/WSL 相关逻辑必须考虑：未安装 WSL、权限不足、端口占用等错误场景。
4. 发布相关脚本（`scripts/`）改动时，需说明影响环境（dev/canary/stable）。

## 6. 文档维护规则

- 本文件用于 **仓库级总览**，保持简洁、稳定，不写过细实现细节。
- 具体模块细节应写入各子目录文档（如 `company/README.md`、`router/README.md`、`web/README.md`）。
- 若目录结构或职责发生变化，优先更新本文件中的“Monorepo 重要项目介绍”。
