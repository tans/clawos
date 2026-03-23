# MCP 低代码管理机制设计（mcp-lowcode）

## 1. 目标与范围

### 1.1 背景
当前系统中每个 MCP（如 `crm-mcp`、`wechat-mcp`、`yingdao-mcp`）有各自 `manifest.json` 与运行逻辑，但“在 App 内可点击查看与管理”的体验仍偏工程化，通常需要改前端代码 + 后端接口 + MCP 元数据三方联动。

### 1.2 目标
设计一个**配置驱动（low-code）**机制，让每个 MCP 都可通过配置文件声明：
- 在 App 中是否展示、展示位置、图标、标签；
- 可查看哪些信息（状态、版本、文档、连接信息）；
- 可执行哪些管理动作（启停、重载、参数更新、健康检查、日志查看）；
- 动作参数校验与权限控制；
- UI 组件类型与交互（表单、表格、状态卡片）可配置。

实现目标是新增 MCP 时尽量不改代码或只做极小适配。

### 1.3 非目标（第一阶段）
- 不做“任意 DSL 脚本执行”（避免安全风险）；
- 不做复杂流程编排（如多 MCP 事务）；
- 不做细粒度租户级可视化布局编辑器（先用 JSON/YAML 配置）。

---

## 2. 整体架构

```text
┌──────────────────── App Frontend ────────────────────┐
│ MCP 列表页 / MCP 详情页 / 动作面板 / 动态表单渲染器      │
└───────────────────────▲──────────────────────────────┘
                        │ (schema + data + action APIs)
┌───────────────────────┴──────────────────────────────┐
│               MCP Low-Code Gateway（后端）            │
│ 1) 配置加载器 Config Loader                            │
│ 2) Schema 编译器 Schema Compiler                       │
│ 3) 运行时执行器 Action Executor                        │
│ 4) 权限拦截器 AuthZ Guard                              │
│ 5) 审计日志 Audit Logger                               │
└───────────────▲───────────────────────▲──────────────┘
                │                       │
        ┌───────┴───────┐       ┌──────┴──────────┐
        │ MCP 注册信息源  │       │ MCP Runtime/Agent│
        │ manifest.json  │       │ start/stop/check │
        └───────────────┘       └──────────────────┘
```

核心思路：
1. 每个 MCP 的管理面板由配置定义；
2. 后端将配置编译为统一 Schema；
3. 前端基于 Schema 自动渲染页面和动作；
4. 动作执行通过执行器路由（内置 + 通用回退）保证可用性。

---

## 3. 配置模型设计

建议新增目录：
- `mcp/<mcp-name>/lowcode.config.yaml`（每个 MCP 一份）
- 或集中式 `config/mcp-lowcode/<mcp-name>.yaml`（统一管理）

推荐先用 **YAML**（可读性高），运行时转为 JSON Schema。

### 3.1 顶层结构（示例）

```yaml
apiVersion: clawos/v1
kind: MCPPanel
metadata:
  name: crm-mcp
  title: CRM Connector
  icon: plug
  category: business
  order: 20
  tags: [crm, production]

spec:
  visibility:
    enabled: true
    environments: [dev, staging, prod]

  status:
    source: health_endpoint
    endpoint: /internal/mcp/crm/health
    fields:
      - key: status
        label: 运行状态
        type: badge
      - key: version
        label: 版本
        type: text
      - key: lastHeartbeatAt
        label: 最近心跳
        type: datetime

  views:
    - id: overview
      title: 概览
      blocks:
        - type: key_value
          source: status
        - type: markdown
          source: static
          content: |
            CRM MCP 提供客户查询、线索更新等能力。

    - id: config
      title: 配置
      blocks:
        - type: form
          submitAction: update_config
          fields:
            - name: baseUrl
              label: CRM 地址
              component: input
              required: true
              rules:
                - type: url
            - name: timeoutMs
              label: 超时时间
              component: number
              default: 5000
              rules:
                - type: min
                  value: 100
                - type: max
                  value: 30000

  actions:
    - id: start
      label: 启动
      type: lifecycle
      executor: mcp_runtime.start
      confirm: true

    - id: stop
      label: 停止
      type: lifecycle
      executor: mcp_runtime.stop
      confirm: true

    - id: reload
      label: 重载配置
      type: lifecycle
      executor: mcp_runtime.reload

    - id: update_config
      label: 保存配置
      type: config
      executor: mcp_config.update
      payloadSchemaRef: '#/components/schemas/ConfigUpdate'

  components:
    schemas:
      ConfigUpdate:
        type: object
        properties:
          baseUrl:
            type: string
            format: uri
          timeoutMs:
            type: integer
            minimum: 100
            maximum: 30000
        required: [baseUrl]
```

### 3.2 关键字段解释
- `metadata`：决定列表展示（图标、排序、分组、标签）。
- `spec.status`：定义“查看”信息来源与展示方式。
- `spec.views`：定义详情页 tab 与区块类型。
- `spec.actions`：定义“管理”动作、权限、执行器映射。
- `components.schemas`：动作入参结构，供前端表单与后端校验共享。

---

## 4. 前端低代码渲染机制

### 4.1 页面构成
- **MCP 列表页**：从 `/api/mcps/panels` 获取元数据，自动渲染卡片。
- **MCP 详情页**：读取 `/api/mcps/{name}/panel-schema`，动态渲染 tabs + blocks。
- **动作区**：基于 `actions` 渲染按钮、弹窗、表单。

### 4.2 渲染组件集合
限制可用组件，避免配置无限制膨胀：
- 展示类：`key_value`, `table`, `badge`, `markdown`, `logs`
- 输入类：`input`, `number`, `select`, `switch`, `textarea`, `json_editor`
- 交互类：`confirm_dialog`, `drawer_form`

### 4.3 动态表单策略
- 使用统一字段协议（name/label/component/rules/default/visibleWhen）。
- 提交时由后端按 `payloadSchemaRef` 进行二次校验（前端校验仅提升体验）。

---

## 5. 后端执行与安全设计

### 5.1 配置加载与编译
- 启动时扫描 `lowcode.config.yaml`；
- 使用 `ajv` 或 `zod` 校验配置本身格式；
- 编译为内部结构 `CompiledMCPPanel`，缓存至内存；
- 支持文件变更热更新（可选：chokidar watch + debounce）。

### 5.2 动作执行模型
禁止配置直接写 shell 命令，采用**执行器映射**：

```ts
const ACTION_EXECUTORS = {
  "mcp_runtime.start": runtimeService.start,
  "mcp_runtime.stop": runtimeService.stop,
  "mcp_runtime.reload": runtimeService.reload,
  "mcp_config.update": configService.update,
  "mcp_observe.healthcheck": observeService.healthcheck,
};
```

执行流程：
1. 参数 schema 校验；
2. 执行器路由匹配（内置 + 通用回退）；
3. 执行动作并记录审计日志（操作者、参数摘要、结果、耗时）。

### 5.3 安全与治理
- 当前阶段默认全开放，不做动作级权限控制；
- 审计：所有管理操作可追踪；
- 限流：对 restart/reload 等高频动作加限流；
- 幂等：start/stop/reload 提供状态判定与幂等响应；
- 敏感字段脱敏：token/secret 在查看态默认掩码。

---

## 6. API 设计草案

### 6.1 列表与详情
- `GET /api/mcps/panels`
  - 返回 MCP 卡片元数据 + 当前状态摘要。
- `GET /api/mcps/:name/panel-schema`
  - 返回该 MCP 编译后的可渲染 schema。
- `GET /api/mcps/:name/panel-data`
  - 返回 schema 中各 block 所需数据。

### 6.2 动作执行
- `POST /api/mcps/:name/actions/:actionId`
  - body: `{ payload: any }`
  - 返回执行结果、错误码、traceId。

### 6.3 错误码建议
- `MCP_PANEL_NOT_FOUND`
- `MCP_ACTION_PAYLOAD_INVALID`
- `MCP_RUNTIME_UNAVAILABLE`

---

## 7. 与现有仓库结构对齐建议

结合当前目录（`mcp/*/manifest.json`）建议：

1. 每个 MCP 下新增 `lowcode.config.yaml`；
2. 网关服务读取 manifest + lowcode 合并成“展示+管理模型”；
3. 在 `docs/` 增补《MCP 低代码配置规范》；
4. 在 `test/` 增加配置校验与动作鉴权测试。

可选演进：
- 将 manifest 内部分字段（标题、描述、版本）透传到 lowcode；
- 对无 `lowcode.config.yaml` 的 MCP 使用默认只读模板（至少可查看状态）。

---

## 8. 分阶段实现计划

### Phase 0（1~2 天）：设计与脚手架
- 定义 `lowcode.config.yaml` JSON Schema；
- 建立 `ConfigLoader` / `SchemaCompiler` 基础代码；
- 输出 1 个示例 MCP（如 `crm-mcp`）配置。

**里程碑**：可以读取并校验配置，返回静态 panel schema。

### Phase 0 具体落地产物（本轮）
- `schemas/mcp-lowcode.schema.json`：提供可执行校验的 JSON Schema，约束顶层结构、视图 block、动作定义与参数模型。
- `examples/mcp/crm-mcp.lowcode.yaml`：提供可直接用于联调的示例配置（含 overview/config/logs 三个视图、5 个动作）。
- 配置接入建议：
  1. 后端启动扫描 `mcp/*/lowcode.config.yaml` + `examples/mcp/*.lowcode.yaml`（开发态）；
  2. 用 AJV 在启动期一次性校验，失败即阻止服务启动；
  3. 编译成 `CompiledMCPPanel` 缓存，供 `/api/mcps/panels` 和 `/api/mcps/:name/panel-schema` 直接读取。

### Phase 0 验收标准（DoD）
- 至少 1 个 MCP 的 low-code 配置可通过 schema 校验。
- App 列表页可拉取并展示 `metadata`（name/title/icon/category/order/tags）。
- 详情页可渲染静态 schema（可先不接真实 runtime 数据）。
- `POST /api/mcps/:name/actions/:actionId` 可完成鉴权 + payload 校验 + executor 路由（可先 mock 执行）。

### Phase 1（3~5 天）：可查看（Read）
- 完成 MCP 列表与详情页面动态渲染；
- 打通 `status` 与 `panel-data` 聚合接口；
- 支持基础展示组件（key-value/table/badge/markdown）。

**里程碑**：App 内可点击查看每个 MCP 详情。

### Phase 1 当前实现（本轮）
- 已提供读取侧 API：
  - `GET /api/mcps/panels`
  - `GET /api/mcps/:mcpId/panel-schema`
  - `GET /api/mcps/:mcpId/panel-data`
- 已支持从 `mcp/<mcp-id>/lowcode.config.json` 读取面板定义，保证配置变更可直接生效到读取接口。
- 已实现 Phase-1 回退机制：当某 MCP 暂无 low-code 面板定义时，自动基于 `manifest.json` 生成只读 overview 面板，保证“可查看”能力不缺口。
- 已定义统一错误码：缺失面板返回 `MCP_PANEL_NOT_FOUND`。

### Phase 2（3~5 天）：可管理（Manage）
- 实现动作执行 API 与执行器路由；
- 支持确认弹窗、动态表单、参数校验；
- 接入审计日志（阶段内默认全开放）。

**里程碑**：通过配置即可新增“启停/重载/更新配置”等管理动作。

### Phase 2 当前实现（本轮）
- 已提供动作执行 API：`POST /api/mcps/:mcpId/actions/:actionId`。
- 当前阶段默认全开放（不做 RBAC 与权限拦截），本地 MCP 服务可直接执行管理动作。
- 已支持配置型动作 payload 校验（基于 `payloadSchemaRef -> components.schemas` 的最小可用校验：required/type/uri/minimum/maximum）。
- 已支持内置执行器 + 通用执行器回退，避免因 executor 未注册导致动作不可用。
- 已定义阶段性错误码：`MCP_ACTION_NOT_FOUND`、`MCP_ACTION_PAYLOAD_INVALID`。

### Phase 3（2~4 天）：稳定性与治理
- 热更新配置、缓存失效策略；
- 限流、幂等、超时与重试策略；
- 增加端到端测试与回归用例。

**里程碑**：可在生产环境灰度上线。

### Phase 4（持续演进）
- 可视化配置编辑器（可选）；
- 组件市场（logs chart、metrics chart）；
- 多环境差异配置（dev/staging/prod 覆写）。

---

## 9. 测试策略

### 9.1 单元测试
- 配置解析合法/非法用例；
- schema 编译一致性；
- action payload 校验与错误码。

### 9.2 集成测试
- 从 MCP 配置到 API 输出的端到端链路；
- 动作参数校验失败/成功分支；
- 动作执行失败回滚与日志记录。

### 9.3 前端测试
- 动态渲染快照测试；
- 表单可见性条件（`visibleWhen`）测试；
- 操作确认流程（弹窗 -> 提交 -> 成功/失败反馈）。

---

## 10. 风险与规避

1. **配置过于灵活导致复杂度爆炸**
   - 规避：组件集合和动作配置版本化，避免失控扩张。
2. **安全风险（命令注入、越权）**
   - 规避：禁止 shell executor，动作执行全量审计。
3. **不同 MCP 能力差异大**
   - 规避：提供默认模板 + 可选扩展块，不强求一致。
4. **前端渲染性能问题**
   - 规避：schema 编译缓存、按需加载 block 数据。

---

## 11. 交付清单（建议）

- `mcp-lowcode.md`（本文档）
- `schemas/mcp-lowcode.schema.json`
- `examples/mcp/crm-mcp.lowcode.yaml`
- 后端模块：`ConfigLoader`、`SchemaCompiler`、`ActionExecutor`
- 前端模块：`PanelRenderer`、`DynamicFormRenderer`、`ActionBar`
- 测试：配置校验、鉴权、动作执行、前端渲染

---

## 12. 一句话结论

通过“配置定义 UI + 配置定义动作 + 后端执行器路由”的方式，可以把 MCP 的查看与管理能力低代码化，并在可用优先前提下，实现“新增 MCP 即可在 App 点击管理”的目标。
