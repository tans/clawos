export type ToolName =
  | "submit_bom"
  | "get_bom_job_result"
  | "get_job_status"
  | "get_quote"
  | "export_quote"
  | "export_customer_quote"
  | "apply_nl_price_update"
  | "quote_customer_message"
  | "doctor";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "submit_bom",
    description: "提交单个 BOM 进行异步解析与报价。",
    inputSchema: {
      type: "object",
      properties: {
        sourceType: { type: "string", enum: ["csv", "json", "xlsx"] },
        content: { type: "string" },
        fileUrl: { type: "string" },
        customer: { type: "object" },
        quoteParams: { type: "object" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "get_bom_job_result",
    description: "查询 BOM 报价任务状态与汇总结果。",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_job_status",
    description: "get_bom_job_result 的兼容别名。",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_quote",
    description: "获取单个 BOM 的详细报价行、待确认项与失败信息。",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
      },
      required: ["jobId"],
      additionalProperties: false,
    },
  },
  {
    name: "export_quote",
    description: "导出业务可读的报价结果，支持 JSON、CSV 和 XLSX。",
    inputSchema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        format: { type: "string", enum: ["json", "csv", "xlsx"] },
      },
      required: ["jobId"],
      additionalProperties: false,
    },
  },
  {
    name: "export_customer_quote",
    description: "从客户消息识别多个 BOM 并直接导出业务文件，支持 JSON、CSV 和 XLSX。",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        format: { type: "string", enum: ["json", "csv", "xlsx"] },
        currency: { type: "string" },
        taxRate: { type: "number" },
        webPricing: { type: "boolean" },
        webSuppliers: {
          type: "array",
          items: { type: "string", enum: ["digikey_cn", "ickey_cn", "ic_net"] },
        },
      },
      required: ["message"],
      additionalProperties: true,
    },
  },
  {
    name: "apply_nl_price_update",
    description: "从自然语言消息中提取并更新已知价格。",
    inputSchema: {
      type: "object",
      properties: {
        partNumber: { type: "string" },
        unitPrice: { type: "number" },
        supplier: { type: "string" },
        currency: { type: "string" },
        reason: { type: "string" },
        operatorId: { type: "string" },
      },
      required: ["partNumber", "unitPrice"],
      additionalProperties: false,
    },
  },
  {
    name: "quote_customer_message",
    description: "从客户消息中识别多个 BOM 并聚合报价结果。",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
        currency: { type: "string" },
        taxRate: { type: "number" },
        webPricing: { type: "boolean" },
        webSuppliers: {
          type: "array",
          items: { type: "string", enum: ["digikey_cn", "ickey_cn", "ic_net"] },
        },
      },
      required: ["message"],
      additionalProperties: true,
    },
  },
  {
    name: "doctor",
    description: "检查 bom-mcp 运行时依赖并报告健康状态。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export function isToolName(value: string): value is ToolName {
  return TOOL_DEFINITIONS.some((tool) => tool.name === value);
}
