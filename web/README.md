# clawos Web（Hono 官网）说明

本目录用于实现 `clawos` 的官网服务（基于 Hono），主要面向中文用户，提供介绍、下载与发布管理能力。

## 正式域名

- 官网域名：`https://clawos.minapp.xin`

## 目标

1. 介绍 `clawos` 产品能力和使用场景。
2. 提供 `clawos_xiake.json` 下载。
3. 提供最新安装包下载（Electrobun Setup.zip/Setup.exe）。
4. 提供上传接口，支持脚本直接上传安装包和 `clawos_xiake.json`。

## 功能范围

### 1) 官网页面

- 首页：介绍 `clawos`、核心能力、Windows + WSL 使用定位。
- 下载页：
  - `clawos_xiake.json` 下载入口
  - 最新安装包下载入口（如 `stable-win-x64-ClawOS-Setup.zip`）
- 可选：版本信息展示（版本号、发布时间、更新说明）。

### 2) 下载接口

- `GET /downloads/clawos_xiake.json`
  - 返回最新 `clawos_xiake.json` 文件
- `GET /downloads/latest`
  - 返回最新安装包（建议重定向到真实文件 URL，或直接流式返回）
- `GET /downloads/beta`
  - 返回 beta 通道最新安装包
- `GET /downloads/latest?channel=beta`
  - 与 `/downloads/beta` 等价（兼容参数写法）
- `GET /api/releases/latest`
  - 返回最新版本元数据（JSON）
  - 可用 `?channel=stable|beta` 指定通道

示例返回：

```json
{
  "version": "0.1.0",
  "publishedAt": "2026-02-22T08:00:00Z",
  "installer": {
    "name": "stable-win-x64-ClawOS-Setup.zip",
    "size": 12345678,
    "sha256": "..."
  },
  "xiakeConfig": {
    "name": "clawos_xiake.json",
    "size": 91,
    "sha256": "..."
  }
}
```

### 3) 上传接口（脚本可直接调用）

上传接口用于发布流程，不给普通访客开放。必须鉴权。

- `POST /api/upload/installer`
  - 上传安装包（`multipart/form-data`）
  - 字段：`file`
  - 可选字段：`channel`（`stable`/`beta`，默认 `stable`）
- `POST /api/upload/xiake-config`
  - 上传 `clawos_xiake.json`（`multipart/form-data`）
  - 字段：`file`
  - 可选字段：`channel`（`stable`/`beta`，默认 `stable`）

统一要求：

- Header 使用 `Authorization: Bearer <UPLOAD_TOKEN>`
- 如需指定通道，可同时传 `x-channel: beta` 或 query `?channel=beta`
- 服务端校验：
  - 文件名和扩展名
  - 文件大小上限
  - 可选：sha256 校验
- 上传成功后更新“latest”元数据，使下载入口自动指向新文件
- 返回结构：

```json
{
  "ok": true,
  "fileName": "stable-win-x64-ClawOS-Setup.zip",
  "size": 12345678,
  "sha256": "...",
  "url": "/downloads/latest"
}
```

## 推荐目录结构

```txt
web/
  README.md
  src/
    index.ts              # Hono 入口
    routes/
      page.ts             # 官网页面路由
      download.ts         # 下载路由
      upload.ts           # 上传路由
      release.ts          # 版本元数据路由
    lib/
      auth.ts             # 上传鉴权
      storage.ts          # 文件存储与元数据读写
      hash.ts             # sha256
  storage/
    releases/
      latest.json         # 当前最新版本元数据
    assets/
      installer/          # 安装包文件
      config/             # clawos_xiake.json
```

## 环境变量建议

- `PORT`：服务端口（默认 `26222` 或按部署环境设置）
- `UPLOAD_TOKEN`：上传接口鉴权 Token（默认 `clawos`，生产环境建议覆盖）
- `MAX_INSTALLER_SIZE_MB`：安装包大小上限
- `MAX_CONFIG_SIZE_MB`：配置文件大小上限
- `MAX_MCP_PACKAGE_SIZE_MB`：MCP 包大小上限
- `STORAGE_DIR`：文件存储根目录（默认 `web/storage`）
- `ADMIN_USERNAME`：后台登录账号（用于 `/admin`）
- `ADMIN_PASSWORD`：后台登录密码（用于 `/admin`）
- `OEM_BRAND_NAME`：品牌名（默认 `ClawOS`，用于页面标题/导航/后台）
- `OEM_SITE_NAME`：站点名（默认同 `OEM_BRAND_NAME`，用于后台页头与 SEO 站点名）
- `OEM_BRAND_DOMAIN`：品牌域名或联系标识（默认 `clawos.cc`，用于页脚展示）
- `OEM_BRAND_LOGO_URL`：品牌 Logo 地址（默认 `/public/logo.png`，支持绝对 URL 或站内路径）
- `OEM_SEO_TITLE`：SEO 标题基准（默认同 `OEM_SITE_NAME`）
- `OEM_SEO_DESCRIPTION`：SEO 描述（默认内置企业部署描述）
- `OEM_SEO_KEYWORDS`：SEO 关键词（默认内置关键词）

## 后台管理

- 登录页：`GET /admin/login`
- 后台页：`GET /admin`（需登录）
- 商品管理：
  - `POST /admin/products/save`
  - `POST /admin/products/delete`
  - `GET /api/products`（仅返回已发布商品）
- MCP 上架管理：
  - `POST /admin/mcp/shelf`（上架/下架）
  - `GET /api/mcps/shelf?channel=stable|beta`

## 上传脚本示例

上传安装包：

```bash
curl -X POST "https://clawos.minapp.xin/api/upload/installer" \
  -H "Authorization: Bearer ${UPLOAD_TOKEN}" \
  -F "file=@./artifacts/stable-win-x64-ClawOS-Setup.zip"
```

上传 `clawos_xiake.json`：

```bash
curl -X POST "https://clawos.minapp.xin/api/upload/xiake-config" \
  -H "Authorization: Bearer ${UPLOAD_TOKEN}" \
  -F "file=@./clawos_xiake.json"
```

## PM2 启动

说明：本项目使用 ESM（`type: module`），请使用 `ecosystem.config.cjs`，不要使用默认的 `ecosystem.config.js`。

```bash
cd /Users/ke/code/clawos/web
pm2 start ecosystem.config.cjs --only clawos
```

也可使用 package 脚本：

```bash
cd /Users/ke/code/clawos/web
bun run pm2:start
```

## 安全与发布约束

- 上传接口必须开启鉴权，且只用于内部发布流程。
- 不允许目录穿越，保存文件时使用服务端生成的安全路径。
- 建议上传后生成并落盘 sha256，下载页展示摘要值，便于用户校验。
- 建议保留版本化文件（如 `stable-win-x64-ClawOS-Setup.zip`），`latest` 仅做软指针。

## 里程碑建议

1. 完成 Hono 基础服务和首页静态内容。
2. 完成下载路由与 `latest.json` 元数据读取。
3. 完成上传接口与 Token 鉴权。
4. 完成上传后自动更新 latest 元数据。
5. 增加基础测试（鉴权、文件校验、latest 更新逻辑）。
