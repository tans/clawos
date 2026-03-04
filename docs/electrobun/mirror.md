# Electrobun 镜像方案（国内网络）

用于解决 `bun run desktop:dev` 首次下载 Electrobun 依赖时因 GitHub 不可达导致的失败。

## 已实现
- 所有桌面命令已改为通过 `scripts/electrobun.ts` 启动
- 启动前会优先从镜像下载：
  - `electrobun-cli-<platform>-<arch>.tar.gz`
  - `electrobun-core-<platform>-<arch>.tar.gz`
- 镜像失败后自动回退到 GitHub 官方地址

## 默认镜像
- `https://gh.llkk.cc/{url}`
- `https://ghproxy.net/{url}`

说明：`{url}` 会被替换为 GitHub 原始下载地址。

## 自定义镜像（推荐）
通过环境变量 `CLAWOS_ELECTROBUN_MIRRORS` 覆盖，多个镜像用逗号分隔：

```bash
CLAWOS_ELECTROBUN_MIRRORS="https://your-mirror-1/{url},https://your-mirror-2/{url}" bun run desktop:dev
```

也支持“前缀模式”（不含 `{url}` 时会自动拼接原始地址）：

```bash
CLAWOS_ELECTROBUN_MIRRORS="https://your-proxy/" bun run desktop:dev
```

## 受影响命令
- `bun run desktop:dev`
- `bun run desktop:dev:raw`
- `bun run desktop:build`
- `bun run desktop:build:canary`
- `bun run desktop:build:stable`
