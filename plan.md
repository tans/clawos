# bom-mcp 实现计划（v1）

本文档用于把 `mcp/bom-mcp` 从占位目录推进到可发布、可调用、可运维的第一版实现。

> 执行进度（2026-03-22）：
> - ✅ Milestone A（骨架）已落地：`src/index.ts`、4 个 tool、`domain/infra/types` 已建立。
> - 🚧 Milestone B/C 进行中：当前为内存队列 + 内存存储的最小可运行版，后续继续补强持久化与导出能力。

## 1. 目标与范围

### 1.1 目标

在不引入复杂 AI 工作流的前提下，实现一个 **稳定、可审计、可回放** 的 BOM MCP 服务，优先支持：

1. 提交 BOM（创建任务）
2. 查询任务状态与结果
3. 获取报价结果（结构化）
4. 导出报价单（文件）

### 1.2 非目标（v1 不做）

- 不做复杂多轮 AI 推理链路对外暴露
- 不做权限细粒度多租户（先单租户 token）
- 不做完整签名体系（后续里程碑推进）
- 不做 App 内一键安装（由现有 MCP 发布/下载链路承接）

---

## 2. 对外接口设计（MCP Tools）

只暴露粗粒度业务接口，避免泄漏内部流水线细节。

### 2.1 `submit_bom`

**输入**
- `sourceType`: `json | csv | xlsx`
- `content` 或 `fileUrl`
- `customer`（可选）
- `quoteParams`（币种、税率、目标交期等）

**输出**
- `jobId`
- `acceptedAt`
- `status`: `queued`

### 2.2 `get_bom_job_result`

**输入**
- `jobId`

**输出**
- `status`: `queued | running | succeeded | failed`
- `progress`（0-100）
- `summary`（总行数、识别成功、失败数）
- `errors`（失败原因）

### 2.3 `get_quote`

**输入**
- `jobId`

**输出**
- 报价主表（总价、币种、有效期）
- 报价明细（料号、数量、单价、小计）
- 缺失项与替代建议（若有）

### 2.4 `export_quote`

**输入**
- `jobId`
- `format`: `xlsx | csv | json`

**输出**
- `downloadUrl`
- `expiresAt`

---

## 3. 内部架构与模块拆分

建议目录（位于 `mcp/bom-mcp/`）：

```txt
src/
  index.ts                 # MCP 启动入口
  tools/
    submit-bom.ts
    get-bom-job-result.ts
    get-quote.ts
    export-quote.ts
  domain/
    bom-parser.ts          # BOM 解析（csv/xlsx/json）
    normalizer.ts          # 字段归一化
    pricing.ts             # 价格聚合与计算
    quote-builder.ts       # 结果组装
  infra/
    store.ts               # 作业/结果存储（v1 可文件或 sqlite）
    queue.ts               # 任务队列（内存队列起步）
    logger.ts              # 结构化日志
  types.ts
```

关键原则：
- Tool 层只做参数校验与编排
- 领域逻辑放 `domain/*`
- 外部依赖与 IO 放 `infra/*`

---

## 4. 数据模型（v1）

## 4.1 Job
- `jobId`
- `status`
- `createdAt` / `updatedAt`
- `inputMeta`（来源、行数）
- `progress`
- `error`（失败时）

## 4.2 QuoteResult
- `jobId`
- `currency`
- `totals`
- `items[]`
- `missingItems[]`
- `warnings[]`

---

## 5. 实施里程碑与排期（建议 2 周）

## Milestone A（第 1-3 天）：可跑通骨架

1. 初始化 `src/index.ts` 与 4 个 tool 的空实现
2. 定义 `types.ts` 与输入输出 schema
3. 接入基础日志与错误模型

**验收**
- 本地可启动
- 4 个 tool 可被调用（返回 mock 数据）

## Milestone B（第 4-7 天）：业务闭环

1. 实现 `submit_bom` -> 入队 -> 处理 -> 落库
2. 实现 BOM 解析与字段归一化
3. 实现最小报价计算（按规则表）
4. 实现 `get_bom_job_result` / `get_quote`

**验收**
- 提交 BOM 后可查询到 `succeeded` 结果
- 错误输入会返回结构化错误

## Milestone C（第 8-10 天）：导出与质量

1. 实现 `export_quote`（csv/json，xlsx 可选）
2. 加入单元测试 + 集成测试
3. 接入 `manifest.json` 字段校验与版本发布脚本联调

**验收**
- 主要路径测试通过
- 可通过现有 `publish:mcp` 发布流程

---

## 6. 测试计划

### 6.1 单元测试
- BOM 解析（csv/xlsx/json）
- 归一化规则
- 报价计算（含边界值）

### 6.2 集成测试
- submit -> query -> quote -> export 全链路
- 非法输入（空文件、列缺失、字段类型错误）
- 任务失败与重试

### 6.3 回归检查
- manifest 完整性
- 发布包大小与扩展名校验
- API 错误码稳定性

---

## 7. 运行与发布要求

1. 补齐 `mcp/bom-mcp/manifest.json` 的实现相关字段（entry/能力声明可在后续 schema 升级时扩展）
2. 提供 `README` 的启动方式与示例输入
3. 通过 `bun run publish:mcp -- --mcp bom-mcp` 验证发布链路

---

## 8. 风险与缓解

1. **BOM 来源格式差异大**
   - 缓解：先固定支持 csv/json，xlsx 放第二阶段
2. **价格数据源不稳定**
   - 缓解：加入快照缓存与兜底价格策略
3. **任务处理耗时不可控**
   - 缓解：加入超时、取消、进度上报
4. **接口膨胀**
   - 缓解：坚持粗粒度 tool，不暴露内部步骤

---

## 9. 完成定义（DoD）

满足以下条件才算完成 v1：

- 4 个 MCP tools 可稳定调用
- 主链路测试通过（submit/query/quote/export）
- 错误码与日志可用于排障
- 可通过当前 MCP 发布/下载体系分发
