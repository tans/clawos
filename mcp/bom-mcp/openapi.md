对，你这个判断是对的。

**“交给大模型的能力，不应该都做成 MCP 接口。”**
上一版把一些本应在应用内部编排、甚至只适合做普通函数调用的能力，也包装成了 MCP tools，这会导致边界混乱。

更合理的做法是：

# 一、先重新划分边界

你的 BOM 项目里，其实有 3 类能力：

### 1. 纯系统能力

这类是确定性、可审计、可重复执行的。

比如：

* 导入 BOM
* 字段映射
* 数据清洗
* 标准化
* 数据库存取
* 价格聚合
* 报价计算
* 导出报价单

这类应该由你自己的服务层实现，不应该“交给大模型决定”。

---

### 2. 大模型辅助能力

这类适合让模型参与，但不适合做成核心 MCP 工具。

比如：

* 识别用户自然语言里的导入意图
* 解释哪些 BOM 行有问题
* 总结报价风险
* 给采购员生成备注
* 对模糊匹配结果做“候选解释”
* 从自由文本里提取结构化字段

这类更适合：

* 放在应用内部作为 LLM Service
* 或做单独的 AI 辅助模块
* 而不是暴露成对外 MCP 工具

---

### 3. 真正适合 MCP 暴露的能力

MCP 更适合暴露 **“外部 Agent 需要调用的稳定业务能力”**。

比如：

* 上传一个 BOM
* 查询一个报价任务状态
* 获取某次报价结果
* 导出报价单
* 查询某个料号价格

也就是说，MCP 适合暴露的是 **业务边界清晰的能力**，不是内部推理链路。

---

# 二、哪些不该做成 MCP

你提到的点，本质上是在说：

> **MCP 是系统之间的能力接口，不是把内部所有步骤都公开。**

这个判断非常重要。

下面这些，我建议不要直接做成 MCP tool：

### 不建议暴露的

* `bom_normalize`
* `bom_match_parts`
* `quote-review`
* `missing-fields-review`
* `substitute-risk-review`

原因很简单：

### 1. 这些是内部流水线步骤

调用方并不关心你内部先 normalize 还是先 match。

调用方真正关心的是：

* 我提交了 BOM
* 你给我报价结果
* 哪些失败了
* 为什么失败

### 2. 这些步骤高度依赖内部实现

今天你用规则清洗，明天你改成规则 + embedding + rerank，如果这些都暴露成 MCP 接口，外部就被你内部实现绑死了。

### 3. 大模型参与的步骤不够稳定

比如 `quote-review` 这种“让模型分析风险”的能力，本质上是解释层，不是交易主链路。
不适合作为公开标准接口。

---

# 三、正确的设计方式：MCP 只暴露粗粒度业务接口

你这个项目更合理的对外开放方式，应该是 **粗粒度接口**。

我建议 MCP 只保留 4 类 tool。

## 1）提交 BOM

例如：

* `submit_bom`

输入：

* 文件内容 / JSON
* 客户信息
* 报价参数

输出：

* `jobId`

---

## 2）查询处理结果

例如：

* `get_bom_job_result`

返回：

* 解析状态
* 识别成功数
* 未识别项
* 报价结果
* 风险项

---

## 3）获取报价单

例如：

* `get_quote`

返回：

* 报价主表
* 报价明细
* 缺失项
* 风险标签

---

## 4）导出报价单

例如：

* `export_quote`

返回：

* 文件地址
* 格式信息

---

# 四、内部流程不要暴露，改成应用服务编排

你内部真正应该这样设计：

```text
submit_bom
  -> parser service
  -> normalize service
  -> matcher service
  -> pricing service
  -> quote engine
  -> persistence
  -> return jobId
```

然后外部只能看到：

```text
submit_bom -> get_bom_job_result -> export_quote
```

这样才合理。

---

# 五、大模型应该放在哪一层

大模型最适合放在 **辅助判断层**，不是协议层。

建议单独抽一个：

```text
src/domain/ai/
  ├─ bom-intent-analyzer.ts
  ├─ free-text-part-extractor.ts
  ├─ quote-risk-summarizer.ts
  └─ candidate-explainer.ts
```

这些模块只被内部 service 调用。

例如：

### 场景 1：用户上传的是一段自然语言

> “帮我给这批 STM32、阻容、连接器做个报价，大概 2k 套”

这时可以让 LLM 先提取结构化字段。

### 场景 2：某些 BOM 行无法精确匹配

LLM 可以只做辅助解释：

* 这一行可能缺封装
* 这一行品牌歧义较大
* 这一行描述像是客户自定义料

### 场景 3：报价生成后

LLM 可以帮你输出人类可读总结：

* 3 个高风险料
* 2 个缺库存料
* 5 个使用了 web fallback 的料

注意：
**LLM 只负责“解释、提取、辅助判断”，不负责最终价格和报价结论。**

---

# 六、重新定义“开放文档”里的接口层次

你前面那版文档最大的问题，是把：

* 内部管道步骤
* AI 辅助步骤
* 对外业务接口

混在了一起。

更合理的是分三层文档：

## A. 外部开放接口文档

只写真正给外部调用的 MCP Tools。

例如：

* `submit_bom`
* `get_quote`
* `export_quote`
* `query_part_price`

---

## B. 内部服务设计文档

只给研发看，不开放。

例如：

* `BomParserService`
* `BomNormalizeService`
* `PartMatchService`
* `PricingEngine`
* `QuoteEngine`

---

## C. AI 辅助能力文档

描述哪些地方用 LLM，输入输出是什么，置信度怎么处理。

例如：

* 文本提取
* 异常解释
* 风险总结

---

# 七、推荐的最终架构

## 对外：MCP

只提供业务入口。

```text
MCP Tools
  ├─ submit_bom
  ├─ get_job_status
  ├─ get_quote
  ├─ export_quote
  └─ query_part_price
```

---

## 对内：应用服务

负责执行确定性主流程。

```text
Application Services
  ├─ BomImportAppService
  ├─ QuoteAppService
  ├─ ExportAppService
  └─ PartPriceQueryAppService
```

---

## 核心领域层

```text
Domain Services
  ├─ BomParser
  ├─ BomNormalizer
  ├─ PartResolver
  ├─ PriceAggregator
  ├─ QuoteCalculator
  └─ RiskMarker
```

---

## AI 辅助层

```text
AI Services
  ├─ FreeTextExtractor
  ├─ AmbiguityExplainer
  ├─ RiskSummarizer
  └─ RemarkGenerator
```

---

# 八、一个更合理的 MCP 接口设计

我建议公开文档改成下面这套。

## 1. `submit_bom`

提交 BOM 并触发处理。

### 输入

```json
{
  "input": {
    "type": "csv|xlsx|json|text",
    "content": "..."
  },
  "options": {
    "currency": "CNY",
    "taxRate": 0.13,
    "pricingStrategy": "best_price"
  }
}
```

### 输出

```json
{
  "jobId": "job_xxx",
  "status": "processing"
}
```

---

## 2. `get_job_status`

查询任务状态。

### 输出

```json
{
  "jobId": "job_xxx",
  "status": "completed",
  "progress": 100,
  "summary": {
    "totalRows": 120,
    "matchedRows": 112,
    "unmatchedRows": 8,
    "pricedRows": 109
  }
}
```

---

## 3. `get_quote`

获取报价结果。

### 输出

```json
{
  "quoteId": "quote_xxx",
  "currency": "CNY",
  "subtotal": 10000,
  "tax": 1300,
  "total": 11300,
  "lines": [],
  "unmatchedItems": [],
  "riskSummary": {
    "webFallbackCount": 5,
    "fuzzyMatchCount": 3,
    "lowStockCount": 2
  }
}
```

---

## 4. `export_quote`

导出报价单。

### 输入

```json
{
  "quoteId": "quote_xxx",
  "format": "xlsx|pdf|json"
}
```

---

## 5. `query_part_price`

单独查询某个料号价格。

### 输入

```json
{
  "manufacturer": "STMicroelectronics",
  "mpn": "STM32F103C8T6",
  "quantity": 1000,
  "currency": "CNY"
}
```

这个接口很适合公开，因为它是明确业务能力。

---

# 九、你这个项目里，LLM 最好只做这几件事

我给你一个明确结论：

## 应该让 LLM 做的

* 自由文本 BOM 提取
* 异常数据解释
* 候选匹配解释
* 风险摘要
* 采购备注生成

## 不应该让 LLM 决定的

* 最终匹配结果直接落库
* 最终价格选择
* 税率计算
* 总价计算
* 供应商优先级执行
* 正式报价单主结果

---

# 十、最核心的一句话

你可以把整个系统理解成：

> **MCP 是“业务入口协议”，不是“算法步骤暴露协议”；
> LLM 是“辅助认知模块”，不是“主交易引擎”。**

这个边界一旦分清，整个系统就会非常顺。

---
