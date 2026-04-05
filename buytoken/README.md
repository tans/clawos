# buytoken - Token 充值码购买小站

基于 OnePay 收银台 + NewAPI 兑换码实现的充值码销售系统。

## 访问地址

- 🌐 **https://buytoken.clawos.cc**（生产环境，SSL 使用 regou.app 证书）
- 🔧 本地开发：`http://127.0.0.1:26450`

## 系统架构

```
用户浏览器
    │
    ├─→ [选购产品] ──→ POST /api/create-order ──→ OnePay 收银台
    │                                                       │
    │                          ◄─── 支付完成 ◄──────────────┘
    │
    └─→ 轮询 GET /api/check/:orderId
              │
              ├─ 未支付 → 继续轮询
              └─ 已支付 → GET /api/order/:orderId
                         ├─→ 确认订单已支付
                         └─→ 从 NewAPI 取兑换码 ──→ 展示给用户
```

## 服务信息

| 项目 | 值 |
|------|-----|
| 域名 | `buytoken.clawos.cc` |
| 后端端口 | `26450` |
| 服务器 | `root@clawos.cc` |
| SSH Key | `~/code/clawos/ssh/id_ed25519_1panel` |
| 进程管理 | PM2 (`buytoken`) |
| Nginx | Docker 容器 `1Panel-openresty-IZie` |

## 一键部署

```bash
cd ~/code/clawos
bun run scripts/deploy_buytoken.ts
```

### 分步部署

```bash
# 1. 打包上传
cd ~/code/clawos
tar czf /tmp/buytoken-deploy.tar.gz --exclude='.git' --exclude='node_modules' -C buytoken .
scp -i ssh/id_ed25519_1panel -o StrictHostKeyChecking=no /tmp/buytoken-deploy.tar.gz root@clawos.cc:/root/

# 2. 服务器解压安装
ssh -i ssh/id_ed25519_1panel -o StrictHostKeyChecking=no root@clawos.cc
export PATH="$HOME/.bun/bin:$PATH"
cd /root/buytoken
bun install
pm2 start ecosystem.config.json

# 3. 配置 Nginx（Docker 内）
# 创建目录
docker exec 1Panel-openresty-IZie mkdir -p /www/sites/buytoken.clawos.cc/{proxy,ssl,log}
# 复制 SSL 证书
docker exec 1Panel-openresty-IZie sh -c "cp /www/sites/regou.app/ssl/fullchain.pem /www/sites/buytoken.clawos.cc/ssl/ && cp /www/sites/regou.app/ssl/privkey.pem /www/sites/buytoken.clawos.cc/ssl/"
# 创建站点配置（参考 deploy_buytoken.ts）
# 重载 nginx
docker exec 1Panel-openresty-IZie nginx -t && docker exec 1Panel-openresty-IZie nginx -s reload
```

## PM2 管理

```bash
# 查看状态
ssh -i ssh/id_ed25519_1panel root@clawos.cc "pm2 list buytoken"

# 重启
ssh -i ssh/id_ed25519_1panel root@clawos.cc "pm2 restart buytoken"

# 查看日志
ssh -i ssh/id_ed25519_1panel root@clawos.cc "pm2 logs buytoken --lines 50"
```

## 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `PORT` | `26450` | 服务端口 |
| `NODE_ENV` | `production` | 生产模式 |
| `BASE_URL` | `https://buytoken.clawos.cc` | 访问基础 URL |
| `ONEPAY_NOTIFY_URL` | `https://buytoken.clawos.cc/api/notify` | OnePay 回调 |
| `NEWAPI_ACCESS_TOKEN` | `Fnzzd8OghB74fPugHFUXZ57aFYxXb+AW` | NewAPI 令牌 |

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
1. `POST /api/create-order` 创建订单 → 获取 `paymentUrl`
2. 跳转用户到 `paymentUrl` 收银台
3. OnePay `POST` 到 `notifyUrl`（支付成功通知）
4. 前端轮询 `GET /api/check/:orderId` 直到 `status: true`

## NewAPI 兑换码

- Base URL：`https://token.minapp.xin`
- 接口：`GET /api/redemption/`
- 鉴权：`Authorization: Bearer <access_token>`

## 产品配置

编辑 `src/lib/products.ts` 中的 `PRODUCTS` 数组。

## SSL 证书

当前使用 `regou.app` 的证书（通配符或共享证书）。如需独立证书，通过 Let's Encrypt 申请：

```bash
docker exec 1Panel-openresty-IZie certbot --nginx -d buytoken.clawos.cc
```
