# buytoken - Token 充值码购买小站

基于 OnePay 收银台 + NewAPI 兑换码实现的充值码销售系统。

## 系统架构

```
用户浏览器
    │
    ├─→ [选购产品] ──→ /api/create-order ──→ OnePay ──→ 收银台
    │                                                       │
    │                          ◄─── 支付完成 ◄───────────────┘
    │
    └─→ 轮询 /api/check/:orderId
              │
              ├─ 未支付 → 继续轮询
              │
              └─ 已支付 → /api/order/:orderId ──→ NewAPI 取兑换码 ──→ 展示给用户
```

## 服务端口

- 默认端口：**3003**
- 访问地址：`http://127.0.0.1:3003`

## 快速部署

### 1. 安装依赖

```bash
cd ~/code/clawos/buytoken
bun install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 BASE_URL（公网地址）
```

### 3. 启动服务

```bash
# 开发模式
bun src/index.ts

# PM2 生产模式
pm2 start ecosystem.config.json --only buytoken
```

### 4. 配置 Nginx 反向代理（1Panel）

- 域名：`buytoken.example.com`
- 类型：反向代理（TCP）
- 指向：`127.0.0.1:30082`

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 购买页面 |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/products` | 产品列表 |
| `POST` | `/api/create-order` | 创建支付订单 |
| `GET` | `/api/check/:orderId` | 轮询支付结果 |
| `GET` | `/api/order/:orderId` | 查询已支付订单的兑换码 |
| `POST` | `/api/notify` | OnePay 回调通知 |

## OnePay 集成

文档：https://onepay.minapp.xin/llms.txt

关键流程：
1. 调用 `POST /api/create-order` 创建订单，获取 `paymentUrl`
2. 跳转用户到 `paymentUrl` 收银台
3. 支付成功后 OnePay 会 `POST` 到配置的 `notifyUrl`
4. 前端轮询 `/api/check/:orderId` 直到 `status: true`

## NewAPI 兑换码集成

文档：https://docs.newapi.pro/zh/docs/api/management/redemption/redemption-get

- Base URL：`https://token.minapp.xin`
- 接口：`GET /api/redemption/`
- 鉴权：`Authorization: Bearer <access_token>`

## 产品配置

编辑 `src/lib/products.ts` 中的 `PRODUCTS` 数组来添加/修改产品。

## 部署检查清单

- [ ] 配置公网 `BASE_URL`
- [ ] OnePanel 中创建站点并反向代理到 `127.0.0.1:30082`
- [ ] OnePay 后台配置回调地址为 `https://buytoken.example.com/api/notify`
- [ ] 确认 NewAPI access token 有效
