# BOM Quote + OpenClaw 技术接入说明

本文面向技术接入者，说明 `bom-quote` skill、`bom-mcp`、OpenClaw、ClawOS 之间的关系，回答以下几个关键问题：

1. 现在如何与 OpenClaw 结合使用。
2. 当前 `bom-mcp` 是否已经支持标准 MCP `stdio`。
3. 是否可以打包成一个技能包，放入目录即可使用，而不依赖 ClawOS。
4. 推荐的演进方向是什么。

## 1. 结论先看

### 1.1 当前状态

- `bom-quote` 已经是一个标准的 OpenClaw skill 目录，核心文件是 `skills/bom-quote/SKILL.md`。
- `bom-mcp` 现在已经支持最小标准 MCP `stdio` server 模式，同时保留原来的单次命令行入口：`bun mcp/bom-mcp/src/index.ts <tool> '<json-args>'`。
- `bom-mcp` manifest 已声明 `runtime.command`，宿主可以按 `bun src/index.ts serve --transport stdio` 拉起。
- 因此，`bom-quote + bom-mcp` 现在已经具备“被 OpenClaw 或其他兼容 host 以 stdio 方式接入”的最小条件；ClawOS 更适合作为分发、安装和更新层。

### 1.2 回答两个核心问题

#### Q1: `bom-mcp` 是否支持 `stdio`?

当前支持最小标准 MCP `stdio` server 形态。

理由：

- 已新增 `serve --transport stdio` 启动模式。
- manifest 已声明 `runtime.command`，可作为 MCP 运行时入口。
- 当前最小支持的 MCP 方法是：
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`

#### Q2: 能否打包成一个技能包，放入目录就能用，而不依赖 ClawOS?

可以分两层回答：

- 只从“skill 指令包”角度看，可以。OpenClaw 原生支持把 skill 目录放进工作区或共享目录后自动发现。
- 但如果你要的是“完整可用的 BOM 报价能力”，仅有 skill 不够，还需要 `bom-mcp` 这个工具后端。现在 `bom-mcp` 已具备最小 stdio runtime 入口，不过仍然建议和 skill 一起打包分发，而不是只丢一个纯 skill 目录。

结论：

- `skill` 可以脱离 ClawOS。
- `bom-mcp` 现在已经可以脱离 ClawOS 作为最小 stdio MCP runtime 启动。
- 但工程上仍建议让 ClawOS 负责下载、放置、升级，而不是让业务环境手工管理 runtime 文件。

## 2. 组件职责划分

建议把整体系统理解为 4 层：

### 2.1 `bom-quote` skill

职责：

- 教 agent 什么时候使用 BOM 报价能力。
- 规定推荐调用路径，例如优先 `quote_customer_message`、缺本地价时开启 `webPricing`、导出时使用 `export_customer_quote`。
- 规定输出规范，例如展示 `priceUpdatedAt`、`sourceRecordedAt`、`pricingState`。

它本质上是“行为编排层”，不是计算层。

### 2.2 `bom-mcp`

职责：

- 解析单 BOM / 多 BOM。
- 调用价格源与缓存。
- 产出报价行、待确认项、导出文件。

它本质上是“工具实现层”。

### 2.3 OpenClaw

职责：

- 作为 skill host / agent runtime。
- 发现 skill 目录、加载 `SKILL.md`、根据 `skills.entries.*` 注入配置和环境变量。
- 决定本轮对话哪些 skill 可见、哪些工具可调。

它本质上是“运行时宿主”。

### 2.4 ClawOS

当前更适合承担以下职责：

- 技能和 MCP 的下载、安装、放置、更新。
- UI 入口与配置入口聚合。
- 帮助业务用户在图形界面里完成启用和升级。

推荐不要把 ClawOS 设计成 `bom-quote` / `bom-mcp` 的唯一运行时依赖，而是把它定位为“分发器 + 管理器”。

## 3. 当前仓库里的真实实现状态

### 3.1 `bom-quote` 已经符合 OpenClaw skill 形态

当前 skill 文件：

- `skills/bom-quote/SKILL.md`

它已经明确要求：

- 多 BOM 消息优先调用 `quote_customer_message`
- 默认 `currency = CNY`
- 缺本地价时启用 `webPricing`
- 优先 `webSuppliers: ["digikey_cn", "ic_net"]`
- 文件导出优先 `export_customer_quote`

这意味着 `bom-quote` 本身已经可以作为 OpenClaw skill 被加载。

### 3.2 `bom-mcp` 当前同时支持 CLI tool router 和 stdio MCP server

当前入口：

- `mcp/bom-mcp/src/index.ts`

它现在支持两种工作模式：

1. 单次 CLI 模式
   - 接收 `<tool> '<json-args>'`
   - 调用 `runTool({ tool, args })`
   - 把结果一次性输出为 JSON
2. MCP stdio 模式
   - 启动命令：`serve --transport stdio`
   - 支持 `initialize`、`tools/list`、`tools/call`
   - tool 执行仍然路由到 `runTool()`

这意味着：

- 现有业务逻辑仍集中在 `runTool()`
- stdio server 只是外层 transport 包装

### 3.3 `bom-mcp` 已暴露的工具

当前 manifest 中真实存在的工具有：

- `submit_bom`
- `get_bom_job_result`
- `get_job_status`
- `get_quote`
- `export_quote`
- `export_customer_quote`
- `apply_nl_price_update`
- `quote_customer_message`

其中对 OpenClaw skill 最关键的是：

- `quote_customer_message`
- `export_customer_quote`

### 3.4 当前发布包已经具备最小运行时声明

对比参考：

- `mcp/windows-mcp/manifest.json` 包含 `runtime.command`
- `mcp/bom-mcp/manifest.json` 现在也包含 `runtime.command`

这说明：

- `windows-mcp` 被定义成可运行的 MCP artifact
- `bom-mcp` 现在也开始向“可运行的 MCP artifact”对齐
- 但它目前仍依赖 Bun 和源码运行时，不是单文件独立二进制

## 4. OpenClaw 侧如何接入

## 4.1 skill 目录投放是支持的

根据 OpenClaw 官方文档，skill 可以从以下位置加载：

- `<workspace>/skills`
- `<workspace>/.agents/skills`
- `~/.agents/skills`
- `~/.openclaw/skills`
- `skills.load.extraDirs`

对本项目最实用的两种是：

1. 工作区专用：
   - `<workspace>/skills/bom-quote/SKILL.md`
2. 机器共享：
   - `~/.openclaw/skills/bom-quote/SKILL.md`

这意味着，如果只看 skill 层，`bom-quote` 完全可以不依赖 ClawOS，只要把 skill 目录放进 OpenClaw 可发现的位置即可。

### 4.2 推荐的 skill 启用方式

在 OpenClaw 配置中启用：

```json5
{
  skills: {
    entries: {
      "bom-quote": {
        enabled: true
      }
    }
  }
}
```

如果需要共享目录：

```json5
{
  skills: {
    load: {
      extraDirs: [
        "/opt/openclaw-skills"
      ],
      watch: true,
      watchDebounceMs: 250
    }
  }
}
```

### 4.3 当前与 ClawOS 的关系

ClawOS 里当前做的事情主要是：

- 聚合“功能配置”
- 打开 OpenClaw Skills 配置页
- 帮助用户保存 `tools.profile`

这说明 ClawOS 现在更像是 OpenClaw 的管理前端，而不是 skill 必需的运行层。

### 4.4 一个可直接落地的最小接入示例

如果当前目标是“先稳定接入并能跑起来”，宿主侧至少要同时准备两部分：

1. 把 `skills/bom-quote/SKILL.md` 放到 OpenClaw 可发现的 skill 目录
2. 让 host 能按 `bom-mcp/manifest.json` 的 `runtime.command` 拉起 stdio server

推荐把 runtime 环境变量固定下来，例如：

```bash
export BOM_MCP_STATE_DIR="$HOME/.openclaw/state/bom-mcp"
export BOM_MCP_DB_PATH="$BOM_MCP_STATE_DIR/bom-mcp.sqlite"
export BOM_MCP_EXPORT_DIR="$BOM_MCP_STATE_DIR/exports"
export BOM_MCP_CACHE_DIR="$BOM_MCP_STATE_DIR/cache"
export BOM_MCP_PUBLIC_BASE_URL="https://files.example.com/bom-mcp"
```

仓库里也提供了可直接拷贝的样例文件：

- `examples/mcp/bom-mcp.env.example`
- `examples/mcp/bom-mcp.doctor.json`
- `examples/mcp/bom-mcp.quote_customer_message.json`
- `examples/mcp/bom-mcp.export_customer_quote.json`

如果只是在本机或内网里先跑通，也可以先不设置 `BOM_MCP_PUBLIC_BASE_URL`。
这时导出结果仍然可用，只是只返回 `filePath` / `fileName` / `mimeType` 等本地文件元数据，不返回 `downloadUrl`。

业务侧推荐默认按下面的调用偏好使用：

- 多 BOM 消息：`quote_customer_message`
- 需要文件：`export_customer_quote`
- 缺本地价时：
  - `webPricing = true`
  - `webSuppliers = ["digikey_cn", "ic_net"]`
- 部署排障：先跑 `doctor`

如果技术接入者需要一个最小心智模型，可以直接按下面理解：

- skill 决定“什么时候调用 BOM 工具”
- `quote_customer_message` / `export_customer_quote` 决定“日常业务主路径”
- `doctor` 决定“环境有没有装对”
- `filePath` 决定“导出文件最终落在哪”

## 5. 当前不依赖 ClawOS 能走到哪一步

### 5.1 可以做到的

- 直接把 `bom-quote` skill 放到 OpenClaw 的 skill 目录中。
- 让 OpenClaw 在新会话中发现并加载该 skill。
- 在仓库环境中，通过 Bun 直接调用 `bom-mcp/src/index.ts`。

### 5.2 目前做不到的

下面这些能力，当前依然不能只靠“丢一个 skill 目录进去”自然成立：

- 让任意第三方 MCP host 无缝复用 `bom-mcp`
- 让 `bom-mcp` 发布包在没有仓库源码上下文的前提下稳定运行

原因是目前缺少：

- 明确的安装目录、数据目录、缓存目录约定
- 与 OpenClaw plugin/runtime 的正式装配层
- 脱离 Bun 和源码布局后的独立可执行打包形态

## 6. 推荐接入方案

## 6.1 短期推荐: OpenClaw skill + stdio runtime + ClawOS 分发

适用场景：

- 先尽快上线使用
- 当前宿主明确就是 OpenClaw / ClawOS

方案：

1. `bom-quote` 继续保持为独立 skill 目录
2. `bom-mcp` 以 `stdio` runtime 形式运行
3. ClawOS 负责把 skill 放入合适目录，并把 `bom-mcp` 放到约定位置
4. OpenClaw/宿主通过 `runtime.command` 拉起 `bom-mcp`

优点：

- 改动最小
- 上线最快
- 兼容当前发布流程
- 已经符合 MCP stdio 接入方向

缺点：

- 仍然对 ClawOS 安装流程有依赖
- 不够通用

## 6.2 中期推荐: OpenClaw plugin bundle

适用场景：

- 目标宿主主要是 OpenClaw
- 希望“一次安装即带 skill + runtime”

方案：

1. 新建一个 OpenClaw plugin
2. plugin 内置：
   - `skills/bom-quote/SKILL.md`
   - `bom-mcp` runtime
   - 可选配置 schema
3. OpenClaw 通过 plugin 安装和启用
4. ClawOS 只做 plugin 的下载和更新

优点：

- 对 OpenClaw 来说最自然
- 可以把 skill 和工具运行时一起交付
- 比单独散落的 skill/MCP 更好管理

缺点：

- 仍然偏 OpenClaw 生态内
- 对“通用 MCP host 兼容”帮助有限

## 6.3 长期推荐: 标准 stdio MCP server + skill 包

适用场景：

- 希望脱离 ClawOS
- 希望兼容更多 MCP host
- 希望把 BOM 报价能力作为可复用基础设施

方案：

1. 为 `bom-mcp` 增加正式 server 模式，例如：

```bash
bom-mcp serve --transport stdio
```

2. 在 manifest 中补充 runtime 信息，例如：

```json
{
  "runtime": {
    "command": ["bom-mcp", "serve", "--transport", "stdio"],
    "cwd": "."
  }
}
```

3. skill 保持纯说明层，不直接绑定 ClawOS
4. ClawOS 退回到“下载、放置、升级”的分发角色

优点：

- 架构最干净
- 最容易跨宿主复用
- skill 与 runtime 职责边界清晰

缺点：

- 需要补一轮 runtime 改造

## 7. 优化建议

以下建议按优先级排序。

### P0: 继续补全 `bom-mcp` 的标准 `stdio` MCP server

最小 stdio 模式已经落地，但还需要从“能用”补到“好用”。

建议目标：

- 支持标准 MCP tool discovery
- 支持 `stdin/stdout` transport
- 支持长生命周期 server 进程
- 保持现有 `runTool()` 作为内部调度层

推荐做法：

1. 保留当前 `runTool()` 逻辑不动
2. 已实现 `serve` 入口，把 MCP 协议层包在外面
3. 下一步补齐更完整的协议覆盖，例如更丰富的错误语义和更稳定的内容结构

### P0: 明确运行时目录与状态目录

当前 `bom-mcp` 虽然能跑，但对“安装后放哪里、缓存放哪里、导出文件放哪里”没有稳定规范。

建议明确：

- 安装目录：例如 `~/.openclaw/tools/bom-mcp/`
- 缓存目录：例如 `~/.openclaw/state/bom-mcp/cache/`
- 导出目录：例如 `~/.openclaw/state/bom-mcp/exports/`
- 配置目录：通过 OpenClaw `skills.entries` 或 plugin config 注入

否则一旦脱离仓库源码环境，运行时就容易失控。

### P0: 让导出结果对宿主无关

当前导出结果里已经会出现相对偏 ClawOS 的下载路径语义。

建议把导出结果设计成以下二选一：

1. 返回宿主本地绝对路径
2. 返回原始文件内容或文件句柄，由宿主自行生成下载 URL

不要在 `bom-mcp` 核心逻辑里硬编码 ClawOS 风格 URL。

### P1: 打包成 OpenClaw plugin bundle

如果近期目标仍以 OpenClaw 为主，最实用的交付形态不是“只有 skill 目录”，而是：

- 一个 plugin bundle
- 里面同时包含 skills 和 runtime

这样接入者只需：

1. 安装 plugin
2. 启用 plugin
3. 启用 `bom-quote`

就能拿到完整能力。

### P1: 为 `bom-mcp` 增加自检命令

建议增加：

```bash
bom-mcp doctor
```

至少检查：

- 价格源访问能力
- 缓存目录可写
- 导出目录可写
- 必需依赖是否存在
- 当前版本号与 manifest 是否一致

这对技术接入和运维排错非常有帮助。

### P1: 增加配置 schema，而不是把策略写死在 skill 里

下面这些策略不应长期硬编码在 `SKILL.md`：

- 默认币种
- 默认税率
- 供应商优先级
- 缓存 TTL
- stale fallback 策略

建议通过 OpenClaw `skills.entries.bom-quote.config` 或 plugin config 下发，skill 只保留默认建议。

### P1: 修正文档源

当前 `mcp/bom-mcp/README.md` 仍保留历史状态，容易误导接入者。

建议：

- 把当前文档作为新的技术接入主文档
- 旧 README 只保留“快速说明 + 指向新文档”

### P2: 做宿主无关的发布物

长期建议同时发布两类产物：

1. `skill bundle`
   - 只包含 `SKILL.md` 和辅助资源
2. `runtime bundle`
   - 标准 `stdio` MCP server
   - 带版本号和平台信息

这样 OpenClaw、ClawOS、其他 MCP host 都能按各自方式组合使用。

## 8. 推荐目录结构

### 8.1 当前阶段推荐

```txt
~/.openclaw/
  skills/
    bom-quote/
      SKILL.md
  tools/
    bom-mcp/
      bom-mcp
      manifest.json
  state/
    bom-mcp/
      cache/
      exports/
```

### 8.2 如果改成 plugin bundle

```txt
my-bom-plugin/
  openclaw.plugin.json
  skills/
    bom-quote/
      SKILL.md
  runtime/
    bom-mcp/
      bom-mcp
      manifest.json
```

## 9. 实际接入建议

如果目标是“尽快可用”，建议按下面顺序推进：

1. 先保持现有 `bom-quote` skill 目录结构不变
2. 新增一份正式技术文档，统一替代旧 README
3. 已为 `bom-mcp` 增加最小 `stdio` server 模式
4. 再决定走：
   - OpenClaw plugin bundle
   - 或 skill bundle + runtime bundle 双产物

如果目标是“OpenClaw 内最佳交付体验”，推荐：

- 中期走 plugin bundle

如果目标是“跨宿主复用能力”，推荐：

- 长期走 stdio MCP server + 独立 skill 包

## 10. 参考

### 仓库内实现

- `skills/bom-quote/SKILL.md`
- `mcp/bom-mcp/src/index.ts`
- `mcp/bom-mcp/manifest.json`
- `mcp/windows-mcp/manifest.json`
- `app/webview/src/pages/skills-page.tsx`

### OpenClaw 官方文档

- Skills: https://docs.openclaw.ai/tools/skills
- Creating Skills: https://docs.openclaw.ai/tools/creating-skills
- Plugins: https://docs.openclaw.ai/tools/plugin
