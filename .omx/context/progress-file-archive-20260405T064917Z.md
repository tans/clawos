Task statement
- 项目存在很多没用的进度文件，整理归档。

Desired outcome
- 明确哪些“进度文件”属于应归档对象，哪些属于运行态或应保留文档。
- 产出可执行的归档边界，供后续规划或执行使用。

Stated solution
- 整理归档项目中的无用进度文件。

Probable intent hypothesis
- 降低仓库噪音，保留必要历史，同时避免误删仍参与运行或协作的状态文件。

Known facts / evidence
- 仓库存在 `.omx/state/*` 与 `.omx/logs/*` 等 OMX 运行态文件。
- 仓库存在 `team/PROJECT_PROGRESS_AND_PLAN_2026-03-25.md` 与 `team/PROJECT_PROGRESS_AND_PLAN_2026-04-01.md` 两份历史进度文档。
- `git status --short` 显示整个 `.omx/` 当前未跟踪。
- 全仓 `rg` 未发现源码直接引用这些具体进度文件名。

Constraints
- 当前处于 `deep-interview` 模式，只做澄清，不直接实施归档。
- 不能把可恢复状态、工具运行态文件和人工进度文档混为一类。
- 需要保留可验证的 brownfield 证据。

Unknowns / open questions
- 用户所说“进度文件”是否仅指 `team/PROJECT_PROGRESS_AND_PLAN_*.md`，还是也包括 `.omx/` 下的状态/日志。
- 用户希望“归档”到仓库内历史目录、移动到 `.archive/`，还是仅停止跟踪/加入 `.gitignore`。
- 是否存在必须长期保留的里程碑文档。

Decision-boundary unknowns
- OMX 可以自行决定的归档目录命名与结构边界尚未明确。
- 是否允许把 `.omx/` 视为纯运行时垃圾并排除在版本控制外，尚未明确。

Likely codebase touchpoints
- `/Users/ke/code/clawos/team/PROJECT_PROGRESS_AND_PLAN_2026-03-25.md`
- `/Users/ke/code/clawos/team/PROJECT_PROGRESS_AND_PLAN_2026-04-01.md`
- `/Users/ke/code/clawos/.omx/state/`
- `/Users/ke/code/clawos/.omx/logs/`
- `/Users/ke/code/clawos/.gitignore`
