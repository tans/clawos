# MCP Examples

## bom-mcp

用于 `bom-mcp` 的最小接入样例文件：

- `bom-mcp.env.example`
  - 运行时目录、数据库、导出目录、缓存目录、可选 `publicBaseUrl`
- `bom-mcp.doctor.json`
  - `doctor` 的空参数示例
- `bom-mcp.quote_customer_message.json`
  - 多 BOM 消息聚合报价示例
- `bom-mcp.export_customer_quote.json`
  - 直接导出业务文件的示例

仓库内可直接这样调用：

```bash
bash scripts/run-bom-mcp.sh doctor examples/mcp/bom-mcp.env.example
bash scripts/run-bom-mcp.sh serve examples/mcp/bom-mcp.env.example

bash scripts/call-bom-mcp.sh doctor examples/mcp/bom-mcp.doctor.json examples/mcp/bom-mcp.env.example
bash scripts/call-bom-mcp.sh quote_customer_message examples/mcp/bom-mcp.quote_customer_message.json examples/mcp/bom-mcp.env.example
bash scripts/call-bom-mcp.sh export_customer_quote examples/mcp/bom-mcp.export_customer_quote.json examples/mcp/bom-mcp.env.example
```
