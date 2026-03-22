# MCP 发布与下载实现说明

本文档记录当前仓库里 `MCP` 的发布、存储、下载和版本管理实现，目标是方便后续维护、升级和扩展。

当前方案基于三个边界：

- `mcp/`：每个 MCP 的源码或打包目录
- `scripts/publish-mcp.ts`：本地发布脚本
- `web/`：MCP 包的上传、存储、下载、查询服务

## 1. 当前目标

当前实现解决的是下面这条链路：

1. 从 `mcp/<mcp-id>/` 选中任意一个 MCP
2. 自动读取或生成 `manifest.json`
3. 自动升级版本号
4. 将整个 MCP 目录打成包
5. 上传到 `web`
6. 在 `web/storage` 中落盘并更新 MCP 元数据
7. 通过 API 和下载地址对外提供访问

这套实现目前是“发布与分发层”，还不包含 App 内的一键安装执行逻辑。

## 2. 目录约定

### 2.1 源码目录

每个 MCP 放在：

```txt
mcp/<mcp-id>/
```

例如：

```txt
mcp/windows-mcp/
mcp/wechat-mcp/
```

### 2.2 Manifest 文件

每个 MCP 目录下应包含：

```txt
mcp/<mcp-id>/manifest.json
```

如果不存在，`publish-mcp.ts` 会自动创建一个最小 manifest。

### 2.3 Web 存储目录

上传后，MCP 包会存储到：

```txt
web/storage/assets/mcp/<mcp-id>/<version>/<package-file>
```

例如：

```txt
web/storage/assets/mcp/windows-mcp/0.1.0/windows-mcp-0.1.0.tgz
```

MCP 的索引元数据存储在：

```txt
web/storage/releases/mcps.json
web/storage/releases/mcps-beta.json
```

分别对应：

- `stable`
- `beta`

## 3. 关键类型

定义位置：

- [web/src/lib/types.ts](C:/Users/xiake/work/clawos/web/src/lib/types.ts)

### 3.1 `McpManifest`

当前核心字段：

```json
{
  "schemaVersion": "1.0",
  "id": "windows-mcp",
  "name": "Windows MCP",
  "version": "0.1.0"
}
```

已支持的扩展字段：

- `description`
- `displayName`
- `publisher`
- `platforms`
- 以及任意其他自定义字段

脚本和服务端当前只强依赖以下字段：

- `schemaVersion`
- `id`
- `name`
- `version`

### 3.2 `McpRelease`

`web` 里 MCP 发布记录的结构：

```ts
interface McpRelease {
  id: string;
  version: string;
  publishedAt: string;
  package: ReleaseAsset;
  manifest: McpManifest;
  channel: "stable" | "beta";
}
```

说明：

- 同一个 `mcpId` 在每个 channel 只保留“当前最新”一条记录
- 当前没有做完整历史版本索引
- 包文件本身按版本落盘，因此未来可以扩展历史版本查询

## 4. 环境变量

定义位置：

- [web/src/lib/env.ts](C:/Users/xiake/work/clawos/web/src/lib/env.ts)

新增了：

- `MAX_MCP_PACKAGE_SIZE_MB`

行为：

- 如果未设置，默认跟 `MAX_INSTALLER_SIZE_MB` 一样
- 服务端上传 MCP 时按该值限制包大小

相关环境变量：

- `UPLOAD_TOKEN`
- `STORAGE_DIR`
- `MAX_INSTALLER_SIZE_MB`
- `MAX_CONFIG_SIZE_MB`
- `MAX_MCP_PACKAGE_SIZE_MB`

## 5. Web 服务端实现

### 5.1 存储层

实现位置：

- [web/src/lib/storage.ts](C:/Users/xiake/work/clawos/web/src/lib/storage.ts)

新增了以下能力。

#### 5.1.1 MCP 索引文件

新增文件名映射：

- `stable -> mcps.json`
- `beta -> mcps-beta.json`

#### 5.1.2 MCP 存储目录

新增目录：

```txt
assets/mcp/
```

并通过 `getMcpDir(mcpId?, version?)` 统一生成路径。

#### 5.1.3 MCP 校验规则

当前服务端会校验：

- `mcpId` 非空
- `mcpId` 必须匹配 `/^[a-z0-9][a-z0-9._-]*$/`
- 包扩展名必须是 `.zip`、`.tgz`、`.tar.gz`
- 包体积不能超过 `MAX_MCP_PACKAGE_SIZE_MB`
- `manifest.id` 必须等于请求中的 `mcpId`
- `manifest.version` 必须等于请求中的 `version`

#### 5.1.4 MCP 存取函数

主要函数：

- `readMcpRegistry(channel)`
- `writeMcpRegistry(registry, channel)`
- `storeMcpPackage(params)`
- `listMcpReleases(channel)`
- `readMcpRelease(mcpId, channel)`
- `resolveLatestMcpPackage(mcpId, channel)`

其中 `storeMcpPackage` 的职责是：

1. 校验 `mcpId`
2. 校验 `version`
3. 校验 `manifest`
4. 将包写入 `storage/assets/mcp/<id>/<version>/`
5. 生成 `sha256`
6. 更新当前 channel 的 `mcps.json`

### 5.2 上传接口

实现位置：

- [web/src/routes/upload.ts](C:/Users/xiake/work/clawos/web/src/routes/upload.ts)

新增接口：

```txt
POST /api/upload/mcp
```

鉴权方式：

- 与现有上传接口一致
- 受 `requireUploadAuth` 保护
- 使用 `Authorization: Bearer <UPLOAD_TOKEN>`

支持字段：

- `file`
- `mcpId`
- `version`
- `channel`
- `manifest`

返回示例：

```json
{
  "ok": true,
  "mcpId": "windows-mcp",
  "version": "0.1.0",
  "fileName": "windows-mcp-0.1.0.tgz",
  "size": 2028,
  "sha256": "xxx",
  "channel": "stable",
  "url": "/downloads/mcp/windows-mcp/latest"
}
```

### 5.3 下载接口

实现位置：

- [web/src/routes/download.ts](C:/Users/xiake/work/clawos/web/src/routes/download.ts)

新增接口：

```txt
GET /downloads/mcp
GET /downloads/mcp/:mcpId/latest
```

说明：

#### `GET /downloads/mcp`

返回当前 channel 下的 MCP 列表，包含：

- `id`
- `version`
- `publishedAt`
- `package`
- `manifest`
- `downloadUrl`

支持：

- `?channel=stable`
- `?channel=beta`

#### `GET /downloads/mcp/:mcpId/latest`

下载指定 MCP 当前最新包。

响应头里会包含：

- `x-file-sha256`
- `x-release-channel`
- `x-mcp-id`
- `x-mcp-version`

### 5.4 查询接口

实现位置：

- [web/src/routes/release.ts](C:/Users/xiake/work/clawos/web/src/routes/release.ts)

新增接口：

```txt
GET /api/mcps
GET /api/mcps/:mcpId
```

用途：

- 给后续 MCP 市场页使用
- 给 App 拉取 MCP 列表与详情使用

当前设计是“轻 registry”，即：

- `GET /api/mcps` 返回当前 channel 的 MCP 列表
- `GET /api/mcps/:mcpId` 返回某个 MCP 的当前发布信息

## 6. 发布脚本实现

实现位置：

- [scripts/publish-mcp.ts](C:/Users/xiake/work/clawos/scripts/publish-mcp.ts)

根脚本入口：

- [package.json](C:/Users/xiake/work/clawos/package.json)

新增命令：

```json
"publish:mcp": "bun run scripts/publish-mcp.ts",
"publish:mcp:beta": "bun run scripts/publish-mcp.ts --release-channel=beta"
```

### 6.1 基本用法

```bash
bun run publish:mcp -- --mcp windows-mcp
bun run publish:mcp -- --mcp wechat-mcp
bun run publish:mcp:beta -- --mcp windows-mcp
```

也支持显式版本：

```bash
bun run publish:mcp -- --mcp windows-mcp --version 0.2.0
```

### 6.2 脚本行为

脚本按以下顺序执行：

1. 解析参数
2. 定位目录 `mcp/<mcp-id>`
3. 读取 `manifest.json`
4. 如果没有传 `--version`，自动升级 patch 版本
5. 回写 `manifest.json`
6. 将整个 MCP 目录打成 `.tgz`
7. 调用 `POST /api/upload/mcp`
8. 输出发布结果

### 6.3 自动升级版本规则

如果未指定 `--version`，脚本会：

- 读取 `manifest.version`
- 按 semver 做 patch +1

例如：

- `0.1.0 -> 0.1.1`
- `1.4.9 -> 1.4.10`

如果 manifest 中版本不合法或为空，则回退为：

- `0.1.0`

注意：

- 这是“本地直接回写 manifest”的策略
- 一旦执行发布脚本，工作区中的 `manifest.json` 会被修改

### 6.4 打包格式

当前脚本会生成：

```txt
artifacts/mcp/<mcp-id>/<mcp-id>-<version>.tgz
```

例如：

```txt
artifacts/mcp/windows-mcp/windows-mcp-0.1.0.tgz
```

当前没有依赖外部压缩命令，而是用 Node/Bun 自己构建 tar 并 gzip，原因是：

- 避免依赖外部 PowerShell 或系统压缩命令
- 减少不同环境下打包失败
- 更适合后续 CI

### 6.5 上传参数

脚本会以 `multipart/form-data` 发送：

- `file`
- `mcpId`
- `version`
- `channel`
- `manifest`

并带上：

- `Authorization: Bearer <token>`

### 6.6 脚本参数

支持参数：

- `--mcp <id>`
- `--version <version>`
- `--release-channel <stable|beta>`
- `--base-url <url>`
- `--token <token>`
- `--timeout-ms <ms>`
- `--heartbeat-ms <ms>`

环境变量支持：

- `CLAWOS_PUBLISH_BASE_URL`
- `CLAWOS_UPLOAD_TOKEN`
- `UPLOAD_TOKEN`
- `CLAWOS_RELEASE_CHANNEL`
- `CLAWOS_VERSION`
- `UPLOAD_TIMEOUT_MS`
- `UPLOAD_HEARTBEAT_MS`

## 7. 测试覆盖

测试位置：

- [web/test/storage.test.ts](C:/Users/xiake/work/clawos/web/test/storage.test.ts)

当前已覆盖：

- installer 存储
- platform installer 读取
- stable / beta 分离
- xiake config 存储
- installer 非法扩展名拒绝
- MCP package 存储与 latest 解析

当前 MCP 测试覆盖的是存储层，不包含：

- 上传路由集成测试
- 下载路由集成测试
- 发布脚本端到端测试

## 8. 当前限制

当前实现是第一版，存在以下限制。

### 8.1 只记录每个 channel 下的“最新 MCP”

`mcps.json` 当前是：

- `mcpId -> McpRelease`

所以每次发布同一个 `mcpId` 会覆盖当前 channel 的 latest 记录。

包文件不会被删除，但索引只指向最新版本。

如果未来要支持历史版本：

- 需要把索引改成 `mcpId -> versions[]`
- 或新增 `mcps/<mcpId>/index.json`

### 8.2 没有 App 侧安装器协议

当前只是“可发布、可下载”，还没有实现：

- App 拉取并安装
- 解压到本地插件目录
- 执行 install hook
- 健康检查
- 回滚

### 8.3 Manifest 校验较轻

当前只校验基础字段一致性，不校验：

- `entry`
- `permissions`
- `compatibility`
- `configSchema`

后续如果要做 App 一键安装，这些字段需要升级为正式 schema。

### 8.4 没有签名机制

当前只有：

- 文件大小
- `sha256`

后续企业交付或安全要求更高时，需要补：

- 包签名
- manifest 签名
- 发布者证书链

## 9. 后续推荐升级路径

建议按下面顺序继续迭代。

### 第一阶段

- 给每个 MCP 补完整 `manifest.json`
- 在 `web` 增加一个 MCP 下载页
- App 先接入 `GET /api/mcps` 和 `GET /downloads/mcp/:mcpId/latest`

### 第二阶段

- 增加 MCP 历史版本索引
- 增加 `GET /api/mcps/:mcpId/versions`
- 支持按版本下载，不只是 latest

### 第三阶段

- 设计正式 manifest schema
- 加 `entry / permissions / compatibility / install hooks`
- App 实现一键安装和运行管理

### 第四阶段

- 加签名校验
- 加私有化镜像同步
- 加企业授权和 license 控制

## 10. 维护建议

### 10.1 发布规范

建议每个 MCP 都遵守：

- 目录名 = `manifest.id`
- manifest 中版本永远使用 semver
- 每次发布都走 `publish:mcp`
- 不手动改 `web/storage/releases/mcps*.json`

### 10.2 不要直接编辑 storage

`web/storage` 属于发布产物区，不应该手工维护。

应通过：

- `POST /api/upload/mcp`
- 或 `bun run publish:mcp`

来更新。

### 10.3 如果要支持 CI 发布

当前脚本已经基本适配 CI，后续只需在 CI 里传：

- `--mcp`
- `--base-url`
- `--token`

即可。

如果以后要批量发布多个 MCP，可以新增：

- `publish-mcp.ts --all`
- 或单独实现 `publish-mcps.ts`

## 11. 相关文件

- [package.json](C:/Users/xiake/work/clawos/package.json)
- [scripts/publish-mcp.ts](C:/Users/xiake/work/clawos/scripts/publish-mcp.ts)
- [web/src/lib/types.ts](C:/Users/xiake/work/clawos/web/src/lib/types.ts)
- [web/src/lib/env.ts](C:/Users/xiake/work/clawos/web/src/lib/env.ts)
- [web/src/lib/storage.ts](C:/Users/xiake/work/clawos/web/src/lib/storage.ts)
- [web/src/routes/upload.ts](C:/Users/xiake/work/clawos/web/src/routes/upload.ts)
- [web/src/routes/download.ts](C:/Users/xiake/work/clawos/web/src/routes/download.ts)
- [web/src/routes/release.ts](C:/Users/xiake/work/clawos/web/src/routes/release.ts)
- [web/test/storage.test.ts](C:/Users/xiake/work/clawos/web/test/storage.test.ts)

