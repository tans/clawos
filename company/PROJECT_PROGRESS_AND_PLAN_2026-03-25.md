# ClawOS Team 项目进度分析与一次性执行方案（2026-03-25）

## 1. 当前进度结论（基于现有代码与文档）

### 1.1 已完成
1. **账号与控制台基础能力可用**
   - 手机号注册/登录、会话机制已具备。
2. **主机管理链路可用**
   - 可查看主机列表、主机详情、最近命令与事件。
3. **Agent 关键接口已打通**
   - `hello / heartbeat / commands / result / events / insights` 已实现。
   - 兼容 `/api/agent/*` 与 `/api/gateway/*` 前缀。
4. **核心控制动作已可下发**
   - `clawos.gateway.status`
   - `clawos.gateway.action(restart)`
   - `wsl.exec`
5. **命令队列具备基础治理能力**
   - pending 队列、短窗口去重、超时标记基础能力已存在。

### 1.2 关键缺口（P0）
1. **Token 使用量未形成完整闭环**（采集/存储/查询/展示）
2. **config.get / config.set 端到端未完成**（控制台入口、执行回传、审计）
3. **restart 防误触需加强**（独立限流 + 二次确认 + 审计）
4. **术语与模型尚未完全统一**（历史 company/group/project 残留需收敛）
5. **运营视角可观测性不足**（在线率、成功率、异常趋势等 KPI）

---

## 2. 产品与模型统一（一次性定稿）

## 2.1 产品名（最终）
- 产品名统一为：**Team（ClawOS Team）**
- 对外文案统一使用 Team，不再使用其它并行产品名。

## 2.2 租户语义（最终）
- 租户实体统一为：**team**。
- 注册流程统一为：**注册成功即自动创建一个 team 并进入 team 控制台**。
- 移除 company/group/project 在产品层的并行表述，仅保留数据迁移语义说明。

## 2.3 Web 呈现方式（最终）
- **不建设独立官网**。
- 在现有 `web` 中完成两处落地：
  1. Team 独立介绍页（站内路由页面）
  2. 首页 Team 专属 section（价值、能力、CTA）

---

## 3. 一次性执行计划（6 周，按里程碑交付）

## Phase A（第 1-2 周）：补齐 P0 核心闭环

### 目标
- 打通 token、config、restart 三条关键能力链路。

### 任务
1. **Token 使用量闭环**
   - 新增采集结构：`host_id + timestamp + tokens + raw_json`。
   - 提供查询 API：按设备/时间窗口聚合。
   - 控制台展示时序数据（先可用后美化）。
2. **配置管理闭环**
   - 落地命令：`clawos.gateway.config.get / set`。
   - 控制台提供“读配置/写配置”入口。
   - 回传结果写入命令结果与审计。
3. **重启动作加固**
   - restart 使用独立限流窗口（建议 2-5 分钟）。
   - 控制台二次确认（主机名确认/确认词）。
   - 审计记录触发人、主机、原因与结果。

### 交付物
- 主机详情页新增「Token 使用量」与「配置管理」面板。
- restart 的防误触机制与审计链路可验收。

## Phase B（第 3-4 周）：稳定性与可运营能力

### 目标
- 从“可用”升级到“稳定可运营”。

### 任务
1. 状态机完善：`pending/running/succeeded/failed/timeout/canceled`。
2. 命令重试机制与关联追踪（`retry_of_command_id`）。
3. KPI 看板：在线率、任务成功率、失败类型分布、重启失败率。
4. 异常诊断增强：按主机/时间窗快速定位。

### 交付物
- Insights 升级版（含 KPI 卡片）。
- 周报统计模板（自动产出）。

## Phase C（第 5-6 周）：web 页面上线与对外表达统一

### 目标
- 在 `web` 内形成对外可展示、可转化的 Team 页面能力。

### 任务
1. 新增 Team 介绍页（能力、场景、安全、CTA）。
2. 首页新增 Team section（价值主张 + 快速入口）。
3. 完成中英文核心文案与 FAQ/案例模板。

### 交付物
- web 站内 Team 页面 + 首页 Team section 上线。
- 品牌与文案规范（中英文）。

---

## 4. `~/.openclaw` 远端集中管理方案

## 4.1 目标
- 支持在 Team 控制台集中访问远端 `~/.openclaw`，用于：
  1. 配置直接维护；
  2. 生产资料读取（日志/快照等）；
  3. 远端运维效率提升与故障定位加速。

## 4.2 能力边界（安全优先）
1. **路径白名单**：仅允许 `~/.openclaw/**`。
2. **权限分级**：Viewer（读）/ Operator（改配置）/ Admin（高风险写删）。
3. **强审计**：记录操作者、主机、文件、diff 摘要、时间、结果。
4. **高风险双确认**：关键配置与密钥相关文件需二次确认。

## 4.3 API 草案
- `POST /api/console/hosts/:id/fs/list`
- `POST /api/console/hosts/:id/fs/read`
- `POST /api/console/hosts/:id/fs/write`
- `POST /api/console/hosts/:id/fs/download`
- `POST /api/console/hosts/:id/fs/tail`

## 4.4 落地顺序
- Week 1：list/read/download + 审计
- Week 2：write + diff 审计
- Week 3：tail + 高风险双确认

---

## 5. 可直接使用的 web 文案（Team）

## 5.1 首页 section（中文）
- 标题：**让每一台 OpenClaw，都在 Team 的掌控之中。**
- 副标题：Team 是 ClawOS 的 AI Native 控制面子产品。统一查看状态、追踪 Token、远程改配置、访问 `~/.openclaw` 并安全重启。
- 按钮：`立即体验 Team` / `查看接入文档`

## 5.2 Team 介绍页（中文）
- 能力点：状态可见 / Token 可视 / 配置可控 / 安全重启 / 全程审计
- 场景：远程运维团队、多设备 AI 工作室、企业内网部署
- 结尾 CTA：**7 天完成从接入到首轮稳定运行。**

## 5.3 English one-liner
**ClawOS Team is the AI-native control plane for OpenClaw: observe, configure, access ~/.openclaw, restart, and audit every node with confidence.**

---

## 6. 人员分工与里程碑

## 6.1 团队分工
- 后端（2）：命令链路、token usage、审计、FS API
- 前端（1）：主机详情改版、KPI、web 首页 section、Team 介绍页
- Agent（1）：config/token 上报、错误码与执行回传
- 产品运营（1）：文案、案例、演示脚本、指标看板

## 6.2 里程碑（固定日期）
- **M1（2026-04-05）**：P0 三闭环（token/config/restart）
- **M2（2026-04-19）**：稳定性与 KPI 版本
- **M3（2026-05-03）**：web 内 Team 页面与首页 section 上线
