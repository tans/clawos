# 日志窗口合并设计与实施计划（log-modal）

## 1. 背景与目标

当前 `app/webview` 内多个页面都各自内嵌了一块日志区域（`<pre className="log-console">`），日志渲染、轮询结束处理、任务状态提示逻辑散落在不同页面里，导致：

- 交互形态不统一（有的是 `Card` 内日志，有的是独立 `meta-banner + pre`）。
- 代码重复（任务日志字符串拼接、空态文案、状态文案在多处重复）。
- 后续扩展困难（例如“复制日志”“下载日志”“按级别筛选”“自动滚动”要改多处）。

本次目标：**把散布在各页面的日志展示整合为一个统一的 Log Modal（或侧滑面板）能力**，并通过共享状态/共享组件复用，替代页面内分散的日志窗口。

> 本文先给出设计与计划，不直接改页面逻辑。

---

## 2. 当前日志窗口盘点（现状）

以下页面存在独立日志区并直接渲染 `task.logs`：

1. `dashboard-page.tsx`
   - 任务日志在控制台主页右侧卡片内。
   - `taskLines.join("\n")` 直出。

2. `environment-page.tsx`
   - 使用 `taskOutput` 本地状态保存日志字符串。
   - 任务执行相关场景多（环境安装、MCP 构建、ClawHub 安装）。

3. `backups-page.tsx`
   - 回滚任务有独立日志区与任务元信息。

4. `browser-page.tsx`
   - 浏览器检测/修复/CDP 操作后展示任务日志。

5. `desktop-control-page.tsx`
   - MCP 启动与轮询过程展示调用日志。

共同点：

- 都基于 `fetchTask(taskId)` 轮询后读 `task.logs`。
- 都需要任务标题、状态、步骤信息、日志内容。
- 都有“暂无日志 / 等待中 / 任务启动中”等空态文案。

差异点：

- 状态文案不完全一致（执行中/运行中/等待中等）。
- 布局位置不同（卡片内、页面底部、信息条下方）。
- 部分页面轮询结束后还会触发额外刷新（如环境页、备份页）。

---

## 3. 设计方案

## 3.1 统一组件

新增一个可复用的日志弹层组件（建议放在 `app/webview/src/components/`）：

- 组件名建议：`TaskLogModal`。
- 展示容器建议：复用现有 `Sheet`（`components/ui/sheet.tsx`），先做右侧滑出面板；后续可切换为居中 Dialog。
- 输入 props（建议）：
  - `open: boolean`
  - `onOpenChange: (next: boolean) => void`
  - `title: string`（如“任务日志”）
  - `taskMeta?: string`
  - `logsText: string`
  - `status?: "idle" | "pending" | "running" | "success" | "failed"`
  - `taskId?: string`
  - `actions?: ReactNode`（预留：复制/清空/下载）

核心行为：

- 统一日志区域样式（沿用 `.log-console`，在 Modal 内做固定高度+滚动）。
- 统一空态文案策略（例如：`等待任务执行...` / `暂无日志`）。
- 支持自动滚动到底部（可配置）。

## 3.2 统一状态模型

新增共享日志状态（两种可选，推荐 A）：

### A. App 级全局日志中心（推荐）

在 `App.tsx` 挂一个 `log modal store`（`useState` + context 或轻量 hook）：

- `activeTaskId`
- `taskMeta`
- `logsText`
- `owner`（哪个页面触发）
- `open`

页面通过统一方法调用：

- `openLogModal({ taskId, initialMeta, owner })`
- `updateLogModal({ taskMeta, logsText, status })`
- `closeLogModal()`

优点：

- 真正实现“全局只有一个日志窗口”。
- 页面切换时日志窗口可持续（可选）。
- 便于后续接入全局任务历史。

### B. 页面内复用同一个展示组件

每个页面仍本地维护状态，只是把 `<pre>` 换成 `TaskLogModal`。

优点：改动小。
缺点：只是 UI 合并，不是状态合并。

> 结合“把它们全部合并”的诉求，推荐方案 A。

## 3.3 任务轮询职责拆分

抽出共享 hook：`useTaskLogPolling`（建议放 `app/webview/src/hooks/`）

输入：

- `taskId`
- `onFinish?: (task) => Promise<void> | void`
- `onError?: (message) => void`

输出：

- `task`
- `taskMeta`
- `logsText`
- `status`
- `start(taskId)` / `stop()`

并把以下共性收敛：

- `fetchTask` 的轮询间隔（统一 1000ms，后续可配置）。
- 成功/失败完成态判断。
- 日志拼接模板 `[timestamp] LEVEL message`。

---

## 4. 页面改造策略（分批）

### 第 1 批（低风险）

- `browser-page.tsx`
- `desktop-control-page.tsx`

原因：结构相对简单，先验证 `TaskLogModal + useTaskLogPolling` 的可行性。

### 第 2 批（中风险）

- `backups-page.tsx`
- `dashboard-page.tsx`

原因：涉及更多元信息（步骤、备份刷新、首页布局）。

### 第 3 批（高风险）

- `environment-page.tsx`

原因：动作分支最多（安装、构建、ClawHub），并且成功后联动刷新较多。

---

## 5. 交互与体验规范（拟定）

- 触发方式：
  - 页面主操作区保留“查看日志”按钮；任务启动后自动打开 Modal（可配置）。
- 打开策略：
  - 同一页面重复触发时，复用当前弹层并切换到最新任务。
- 关闭策略：
  - 用户可手动关闭；任务仍继续执行，不影响后端任务。
- 文案统一：
  - `pending/running` => “执行中”
  - `success` => “已完成”
  - `failed` => “失败”
  - 无任务 => “暂无任务”

## 5.1 多任务并行日志（新增要求）

当多个日志任务同时执行时，不能只显示“最后一个任务”的日志，应维护**多日志列表 + 当前详情**双层视图。

建议交互：

- 日常默认态（缩略态）：
  - 在页面右下角或顶栏保留一个“日志中心入口”。
  - 展示最近任务数量与简要状态，例如：`日志(3) | 2 执行中 | 1 失败`。
  - 不主动打断当前操作，避免频繁弹层抢焦点。
- 展开态（详细态）：
  - 打开 `TaskLogModal` 后左侧（或上方）显示任务列表（可滚动）。
  - 右侧显示当前选中任务的实时日志详情（可滚动、自动到底）。
  - 支持在任务之间切换，不丢失每个任务的历史输出。

建议数据结构（示意）：

- `tasks: Array<{ taskId, title, owner, status, updatedAt, unread, logsText }>`
- `activeTaskId: string | null`
- `collapsed: boolean`（缩略/展开状态）

状态更新策略：

- 任务启动：插入或复用对应 `taskId` 项，置顶显示。
- 日志追加：更新该任务 `logsText` 与 `updatedAt`。
- 未读标识：当任务非当前选中时有新日志，`unread = true`。
- 任务结束：保留在列表中，按 `updatedAt` 排序；可由用户手动清理。

这样可以避免“并行任务互相覆盖日志”的问题，同时满足“平时缩略、点开看详情滚动”的使用习惯。

---

## 6. 技术实施清单（执行计划）

## 阶段 A：基础设施

1. 新增 `TaskLogModal` 组件。
2. 新增 `formatTaskLogs(task.logs)` 工具函数（统一日志拼接）。
3. 新增 `useTaskLogPolling` hook（统一轮询与停止逻辑）。
4. 在 `App.tsx` 增加全局日志中心状态与 provider（若采用方案 A）。
5. 日志中心状态改为 `tasks[] + activeTaskId + collapsed`，支持并行任务。

## 阶段 B：页面接入

1. 先接入 `browser-page.tsx` 与 `desktop-control-page.tsx`。
2. 再接入 `backups-page.tsx` 与 `dashboard-page.tsx`。
3. 最后接入 `environment-page.tsx`。
4. 删除各页面冗余的 `taskOutput`、重复 `renderTask` 拼接代码。

## 阶段 C：收尾与一致性

1. 统一状态文案与空态文案。
2. 样式收敛到 `globals.css` 的同一段（避免页面私有日志样式分叉）。
3. 验证页面切换、轮询停止、任务结束自动收敛行为。
4. 验证并行任务场景下，列表与详情切换、未读标记、滚动行为都正确。

---

## 7. 风险与回滚策略

风险：

- 全局 modal 状态与页面生命周期耦合不当，可能出现“页面切换后仍轮询旧任务”。
- 多任务并行时日志归属不清（后触发覆盖先触发）。

缓解：

- 在共享 store 增加 `owner + taskId` 双键保护。
- 每次 `start(taskId)` 时显式 `stop(previousTaskId)`。
- 保留页面级 fallback（必要时允许页面不接入全局 modal，先走兼容路径）。
- 改为“按 `taskId` 维护多日志列表”，禁止单一 `logsText` 覆盖模型。

回滚：

- 保留原 `<pre className="log-console">` 渲染分支开关（短期 feature flag），出现问题可快速切回页面内日志。

---

## 8. 验收标准（Definition of Done）

- 所有涉及任务执行的页面不再各自维护独立日志窗口 UI。
- 用户在任一任务页面看到统一样式/统一交互的日志 Modal。
- 日志轮询逻辑不再在每个页面重复实现。
- 多任务并行执行时可在列表中同时看到多个日志项，且互不覆盖。
- 日常为缩略状态，点击可展开详细日志并保持滚动查看体验。
- 页面切换、任务完成、任务失败场景下日志展示行为一致。
- 现有任务功能（安装、回滚、检测、MCP 启动等）行为不回退。

---

## 9. 建议后续增强（非本次必做）

- 增加“复制日志”“下载日志”。
- 增加按级别筛选（INFO/WARN/ERROR）。
- 增加“仅看最近 N 行”。
- 接入任务历史抽屉（查看最近执行记录）。
