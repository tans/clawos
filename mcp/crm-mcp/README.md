# crm-mcp

一个**无界面（Headless）**的简易 CRM，基于 **Bun + SQLite**，支持客户/跟进/商机管理与 CSV 导出。

## 功能

- 客户管理：创建客户、分页查询
- 跟进记录：记录客户沟通备注与渠道
- 商机管理：创建商机并记录金额/阶段
- 导出：按客户聚合导出 CSV（含跟进数、商机数、商机总额）

## 数据库

默认数据库路径：

```text
mcp/crm-mcp/data/crm.sqlite
```

可在 CLI 第三个参数自定义 `dbPath`。

## CLI 用法

```bash
bun mcp/crm-mcp/src/index.ts <tool> '<json-args>' [dbPath]
```

### 初始化

```bash
bun mcp/crm-mcp/src/index.ts init '{}'
```

### 创建客户

```bash
bun mcp/crm-mcp/src/index.ts create_customer '{"name":"Alice","email":"alice@example.com","company":"Acme"}'
```

### 记录跟进

```bash
bun mcp/crm-mcp/src/index.ts create_interaction '{"customerId":1,"note":"首次电话沟通","channel":"phone"}'
```

### 创建商机

```bash
bun mcp/crm-mcp/src/index.ts create_deal '{"customerId":1,"title":"年度采购","amount":50000,"stage":"proposal"}'
```

### 导出 CSV

```bash
bun mcp/crm-mcp/src/index.ts export_customers_csv '{"filePath":"mcp/crm-mcp/exports/customers.csv"}'
```

## MCP Tool 接口（runTool）

- `init`
- `create_customer`
- `list_customers`
- `create_interaction`
- `create_deal`
- `list_deals`
- `export_customers_csv`

## Windows 打包

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\mcp\crm-mcp\build.ps1
```

产物默认输出：

```text
mcp/crm-mcp/dist/crm-mcp.exe
```
