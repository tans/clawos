# case1 新增“客户结果”能力拆解（按反馈修订）

> 修订原则：
> 1) **文件导出不是重点，只是最后交付动作**；
> 2) **核心是数据持久化与可回溯处理链路**；
> 3) **默认 CSV 即可**；
> 4) **以 SQLite 作为业务核心存储**；
> 5) **流程要支持 Agent 自动运作 + 人工参与纠偏**。

---

## 1. 目标重排（优先级）

## P0（必须先做）
1. 建立 SQLite 持久化模型，覆盖客户请求、BOM 行、零件候选、价格来源、人工修正、任务状态。
2. 每个零件进入可追溯处理流水线：标准化 -> 识别匹配 -> 价格获取 -> 置信度评估 -> 待确认/确认。
3. 支持自动与人工混合闭环：
   - Agent 自动抓价、自动更新；
   - 人工可通过自然语言或上传真实报价单修正价格。

## P1（次优先）
4. 任务级交付：在用户请求“导出”时按任务生成文件（默认 CSV）。

> 结论：导出文件是结果视图，不是主流程引擎。

---

## 2. 核心架构：SQLite-first

## 2.1 为什么 SQLite 先行
- 当前流程以内存为主，重启丢失、不可审计。
- 此场景需要“多轮更新 + 人工纠偏 + 版本回溯”，SQLite 适合先快速落地。
- 后续可平滑迁移到 PostgreSQL（表结构与 DAO 接口保持一致）。

## 2.2 建议表结构（MVP）

### `quote_requests`
- `id`：请求 ID
- `customer_id`
- `source_case`（如 `cases/multibom/case1.md`）
- `status`（queued/running/needs_human/succeeded/failed）
- `created_at` / `updated_at`

### `quote_tasks`
- `id`
- `request_id`
- `task_name`（bom_task_1...）
- `bom_raw_text`
- `status`
- `created_at` / `updated_at`

### `bom_lines`
- `id`
- `task_id`
- `line_no`
- `part_number_raw`
- `part_number_norm`
- `description`
- `qty`
- `uom`
- `parse_confidence`

### `part_match_candidates`
- `id`
- `bom_line_id`
- `candidate_part_no`
- `source`（catalog/supplier/manual）
- `score`
- `is_selected`

### `part_prices`
- `id`
- `part_number_norm`
- `supplier`
- `currency`
- `unit_price`
- `moq`
- `lead_time_days`
- `effective_at`
- `expires_at`
- `source_type`（crawler/api/nl/manual_quote_sheet）
- `source_ref`

### `price_adjustments`
- `id`
- `part_number_norm`
- `old_price`
- `new_price`
- `reason`
- `operator_type`（agent/human）
- `operator_id`
- `created_at`

### `task_events`
- `id`
- `task_id`
- `event_type`
- `payload_json`
- `created_at`

### `exports`
- `id`
- `task_id`
- `format`（先只开 csv）
- `file_path`
- `checksum`
- `created_by`
- `created_at`

---

## 3. 零件级处理链路（主流程）

每条 `bom_line` 都走统一状态机：

1. `parsed`：解析并标准化料号（去空格、统一大小写、别名映射）。
2. `matched`：候选料比对并选主料（保留候选与分数）。
3. `pricing`：拉取价格（多来源），计算建议价。
4. `review_needed`：低置信度或价格冲突时转人工。
5. `confirmed`：Agent 自动确认或人工确认。

### 自动决策阈值（示例）
- 匹配得分 >= 0.92 且价格新鲜（未过期） -> 自动确认。
- 匹配得分 < 0.92 或供应商价格差异 > 15% -> 转人工。

---

## 4. 价格更新机制：自动 + 人工

## 4.1 Agent 自动更新
- 周期任务抓取/刷新 `part_prices`。
- 对已报价任务执行“价格漂移检查”：若涨跌超过阈值，标记任务可重算。
- 自动写入 `task_events`，保证可追踪。

## 4.2 自然语言更新（人工输入）
示例：
- “把 `STM32F103C8T6` 改成 11.8 CNY，供应商 LCSC，今天生效。”

处理：
1. NLP 抽取结构化字段。
2. 写入 `part_prices` + `price_adjustments`。
3. 触发相关任务重算并记录事件。

## 4.3 上传真实报价单更新（人工证据）
- 支持上传 csv/xlsx 报价单。
- 解析后写入 `part_prices(source_type=manual_quote_sheet)`。
- 对冲突价格进入人工确认队列。

---

## 5. Agent 可控编排（含人工参与）

## 5.1 建议 Agent 工具分层

### A. 数据层工具
- `create_quote_request`
- `append_bom_task`
- `list_task_events`

### B. 零件处理工具
- `normalize_bom_line`
- `match_part_candidates`
- `refresh_part_price`
- `confirm_line_price`
- `flag_line_for_human`

### C. 人工协同工具
- `apply_nl_price_update`
- `ingest_manual_quote_sheet`
- `resolve_review_queue`

### D. 结果交付工具（最后）
- `export_task_quote_csv`
- `get_export_file`

## 5.2 编排策略
- Agent 默认自动推进到 `review_needed`。
- 遇到不确定项，自动生成“待人工确认清单”。
- 人工处理后，Agent 自动继续执行并完成任务。

---

## 6. 任务状态设计（request/task 双层）

### `quote_requests.status`
- `queued`
- `running`
- `needs_human`
- `succeeded`
- `failed`

### `quote_tasks.status`
- `parsed`
- `pricing`
- `review_needed`
- `confirmed`
- `exported`

> 重点：`needs_human` 必须是一等状态，而不是异常分支。

---

## 7. 导出策略（降级为交付层）

- 默认只做 `CSV`。
- 导出前提：任务为 `confirmed`。
- 文件内容来源于 SQLite 已确认数据，不直接用内存对象。
- 文件可重建：即使文件丢失，也可依据数据库重新生成。

CSV 建议字段：
- task_name
- part_number
- description
- qty
- selected_supplier
- unit_price
- currency
- lead_time_days
- line_total
- price_source
- reviewed_by
- reviewed_at

---

## 8. 实施拆解（按迭代）

## Iteration 1（核心）
1. 引入 SQLite 与 migration。
2. 落地 `quote_requests/quote_tasks/bom_lines/part_prices/price_adjustments/task_events`。
3. 改造 `submit_bom`：写 DB + 任务状态推进。
4. 改造 `get_quote`：从 DB 计算读取。

## Iteration 2（人机协同）
5. 增加自然语言价格更新入口。
6. 增加人工报价单上传解析入口。
7. 增加 `review_needed` 队列与人工确认接口。

## Iteration 3（交付）
8. 增加 `export_task_quote_csv`。
9. 导出文件索引落 `exports` 表。
10. 增加“按用户/任务取导出文件”接口。

---

## 9. 测试拆解

## 单元测试
- 料号标准化规则。
- 价格冲突判定阈值。
- 自然语言更新解析准确率。

## 集成测试
- case1 拆 3 任务 -> 自动报价 -> 1 条人工修正 -> 重算成功。
- 上传真实报价单 -> 覆盖旧价 -> 重新确认。
- confirmed 后导出 CSV 并校验字段。

## 回归测试
- 原 `submit_bom/get_job_status/get_quote` 行为兼容。

---

## 10. 最小可落地结论（修订版）

围绕“客户要结果”的正确落地路径应是：
1. **先做 SQLite 持久化与零件级可追溯处理**；
2. **建立 Agent 自动 + 人工参与的价格纠偏机制**；
3. **最后按任务导出 CSV 交付**。

这样才能保证结果不是“一次性文件”，而是可持续迭代、可审计、可纠错的报价系统。
