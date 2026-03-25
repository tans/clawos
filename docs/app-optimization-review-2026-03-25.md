# ClawOS App 代码优化建议（2026-03-25）

## 分析范围
- 桌面启动与单实例控制：`app/main/index.ts`、`app/main/single-instance.ts`
- 桌面窗口生命周期：`app/main/window.ts`
- 任务执行与日志：`app/server/tasks/store.ts`、`app/server/tasks/runner.ts`、`app/server/tasks/shell.ts`
- 浏览器/CDP 相关任务：`app/server/tasks/browser.ts`
- WebView API 客户端：`app/webview/src/lib/api.ts`

## 优化优先级（建议先做）

### P0（高收益、低风险）
1. **为任务日志增加“每任务上限 + 截断标记”**
   - 当前 `appendTaskLog` 会无限增长单任务日志数组，长时间运行或高频任务会造成内存持续上升。
   - 建议增加 `MAX_LOGS_PER_TASK`（如 500~2000），超限后丢弃最旧日志，并写入“日志已截断”标记。

2. **为 WebView `request()` 增加超时与取消机制**
   - 目前 `fetch()` 无超时、无 `AbortController`，网络异常会导致页面操作长时间挂起。
   - 建议统一加默认超时（如 10s/20s），并允许调用方覆盖。

### P1（中收益）
3. **将 `runTask` 增加并发限流队列**
   - 目前通过 `findRunningTask(type)` 只限制“同类型”重复，无法限制总体并发。
   - 建议增加全局 task scheduler，按任务类别配置并发度（例如 I/O 任务 2，重任务 1）。

4. **标准化错误码与错误类型**
   - 目前以字符串错误为主，前端只能展示文案，无法基于错误类别做精细化引导。
   - 建议引入 `AppError(code, message, details)` 并在 API 层统一映射。

5. **配置读取增加短时缓存/快照**
   - 一些任务链路中会多次 `readOpenclawConfig()`，可以在请求级或任务级做快照，减少重复 IO。

### P2（可持续治理）
6. **抽离平台分支逻辑（Windows/WSL）到独立适配层**
   - `shell.ts` 与 `browser.ts` 中平台条件较多，后续维护成本会持续上升。
   - 建议引入 `PlatformAdapter`，将命令拼接、编码处理、权限提升等能力模块化。

7. **补齐关键路径的可观测性指标**
   - 建议记录任务耗时、失败率、超时率、重试次数，并输出结构化日志，便于定位线上问题。

8. **前后端类型共享进一步收敛**
   - `app/webview/src/lib/api.ts` 中有大量本地类型定义，建议逐步迁移到 `app/shared` 统一导出，避免漂移。

## 建议落地顺序（两周版）
- **第 1 周**：完成 P0 两项（日志上限、请求超时）。
- **第 2 周**：完成 P1 前两项（任务并发限流、错误码标准化），并启动指标埋点。

## 预期效果
- 内存与稳定性：降低长会话内存抖动，减少“卡住不返回”感知。
- 安全性：通过任务/接口层治理减少异常操作扩散面。
- 运维效率：任务失败定位时间可明显缩短。
