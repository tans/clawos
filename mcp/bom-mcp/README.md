# bom-mcp 用法与问题分析

> 注意：本 README 主要保留历史开发说明，部分内容已经过时。
>
> 当前面向技术接入者的最新说明请优先参考：
> `docs/bom-quote-openclaw-integration.md`
>
> 当前 `bom-mcp` 已支持最小 stdio MCP server 启动方式：
> `bun mcp/bom-mcp/src/index.ts serve --transport stdio`

本文基于 `mcp/bom-mcp/src` 当前实现，给出可直接运行的用法说明，并分析现阶段主要问题。

## 1. 当前能力边界

`bom-mcp` 目前对外暴露 4 个 tool：

- `submit_bom`
- `get_bom_job_result`
- `get_quote`
- `export_quote`

实现入口在 `src/index.ts` 的 `runTool()`，通过 `tool` 字段路由到对应函数。

## 2. 快速上手

### 2.1 命令行调用

```bash
bun mcp/bom-mcp/src/index.ts <tool> '<json-args>'
```

例如提交 CSV：

```bash
bun mcp/bom-mcp/src/index.ts submit_bom '{
  "sourceType": "csv",
  "content": "partNumber,quantity,unitPrice,description\nSTM32F103C8T6,100,12.5,MCU\n0603-10K,200,,Resistor"
}'
```

然后查询任务与报价：

```bash
bun mcp/bom-mcp/src/index.ts get_bom_job_result '{"jobId":"<jobId>"}'
bun mcp/bom-mcp/src/index.ts get_quote '{"jobId":"<jobId>"}'
bun mcp/bom-mcp/src/index.ts export_quote '{"jobId":"<jobId>","format":"json"}'
```

### 2.2 `submit_bom` 入参说明

- `sourceType`: `json | csv | xlsx`
- `content`: BOM 文本
- `fileUrl`: 可选。当前仅支持 `http(s)://`
- `customer`: 可选客户信息
- `quoteParams`: `currency`、`taxRate`、`targetLeadTimeDays`

注意：当前 `xlsx` 会直接报错（仅类型存在，能力未实现）。`quoteParams.taxRate` 仅允许 `0~1`。

## 3. 处理流程（代码真实行为）

1. `submit_bom` 校验输入，并读取 `content` / `fileUrl`。
2. `parseBom` 解析 BOM（仅 csv/json）。
3. `normalizeBomLines` 执行标准化（大写、数量取整、过滤空料号与数量<=0）。
4. 创建内存任务记录（Map 存储），状态 `queued`。
5. 入队异步任务，切换到 `running`。
6. `buildQuoteResult` 计算报价并落回内存，状态 `succeeded`；异常则 `failed`。

## 3.1 cases1（客户意图拆解）测试支持

为支持“一个客户消息包含多个 BOM 表”的场景，新增了 `intent-analyzer`：

- 输入：客户自然语言 + BOM 表格文本（可含多个 BOM 段）
- 输出：`tasks[]`，每个任务对应一份可提交的 BOM 内容
- 支持两种路径：
  - 启发式拆解（默认）：从 markdown fenced block 中提取 BOM 表
  - 大模型拆解（可选）：通过 `llmExtractBomBlocks` 注入 LLM 提取结果

`cases1` 测试中会基于 `cases/multibom/92712 PG - BOM(1).xlsx` 的真实片段，将 3 个 BOM 拆成 3 个独立 `submit_bom` 任务并验证全部完成。

## 4. 已识别问题（按影响优先级）

### P0/P1：稳定性与可用性

1. **任务数据仅在进程内存**
   - `infra/store.ts` 使用 `Map`，重启即丢数据，无法用于真实生产异步任务。

2. **伪异步队列，缺乏恢复与并发控制**
   - `infra/queue.ts` 基于 `queueMicrotask` 顺序执行；没有持久化、重试策略、超时控制、死信队列。

3. **`fileUrl` 存在 SSRF/本地文件读取风险**
   - 可读取任意 `http(s)` 与本地路径，未做 allowlist、协议限制、路径沙箱与大小限制。

4. **导出接口是 mock**
   - `export_quote` 只返回伪下载链接，不生成真实文件，不可审计。

### P1：业务正确性

5. **CSV 解析过于简化**
   - 使用 `line.split(",")`，无法正确处理带引号逗号、转义、换行字段。

6. **`xlsx` 名义支持但实际不支持**
   - 类型声明里有 `xlsx`，解析直接抛错，容易误导调用方。

7. **价格兜底策略会掩盖异常**
   - 缺失/非法单价默认 `1`，可能产生看似成功但业务错误的报价。

8. **税率无边界验证**
   - `taxRate` 可为负值或极端值，结果会失真。

### P2：接口一致性与扩展性

9. **工具命名与文档不一致**
   - 文档中常提 `get_job_status`，代码实际是 `get_bom_job_result`。

10. **错误模型过于粗糙**
    - 全部抛字符串错误，缺少错误码、可定位字段、可重试标记。

11. **唯一 ID 生成不可追溯**
    - `Date.now + Math.random` 可用但不可排序追踪（跨实例也无全局唯一保证）。

## 5. 改进建议（最小可落地）

1. **先做安全收敛**：限制 `fileUrl` 源（禁本地路径/内网），增加内容大小与超时限制。
2. **先做可靠异步**：把 `store+queue` 替换为持久化任务表 + 队列系统（如 Redis/BullMQ 或 DB job queue）。
3. **统一接口契约**：工具名与文档一致，补充错误码与状态机（queued/running/succeeded/failed/canceled）。
4. **提升解析正确性**：CSV 用标准解析器；补齐 xlsx 或从类型中移除。
5. **避免静默兜底**：单价缺失不直接按 1 计算，至少设“可配置策略 + 显式风险等级”。

## 6. 结论

`bom-mcp` 目前更像“可演示的最小雏形”，已经体现了异步任务模型和粗粒度 MCP 工具边界；但在持久化、安全性、解析正确性和导出真实性上仍有明显短板。建议优先补齐安全与可靠性，再做能力扩展。
