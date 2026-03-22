# /app 重构方案

## 目标

基于 `https://github.com/mattgi/electrobun-starter.git` 的思路，对当前 `/app` 做结构性重构，但不直接照搬模板代码。

参考仓库的核心特点是：

- 按职责拆成 `main / webview / shared / scripts`
- 主进程只负责窗口、生命周期、RPC 接线
- Web UI 独立为前端工程
- 主进程和前端之间通过共享 schema 通信
- 构建和产物拷贝规则集中管理

当前 `/app` 的问题不是功能缺失，而是职责边界不清，导致后续页面演进、桌面桥接、测试和构建维护成本都偏高。

另外，当前样式体系基于 `tailwindcss + daisyui`，如果目标是迁到 `shadcn/ui`，那这次重构就不只是目录调整，还包含组件和设计令牌体系的替换。

## 当前需要重构的地方

### 1. 目录结构混杂

当前主要代码都堆在 `src/` 下：

- `src/bun`
- `src/desktop-ui`
- `src/pages`
- `src/routes`
- `src/tasks`
- `src/system`
- `src/gateway`
- `src/config`

问题：

- 主进程代码和桌面前端代码没有物理隔离
- 页面模板、页面路由、桌面桥接脚本互相穿插
- RPC schema 放在 `desktop-ui` 下，不利于共享边界清晰化

### 2. 主进程文件过重

`src/bun/index.ts` 当前承担了过多职责：

- 单实例处理
- 窗口创建和聚焦
- 更新状态维护
- 更新流程触发
- 桌面 RPC handler 注册
- 启动时任务调度
- 环境检测

问题：

- 文件过大，改动风险高
- 生命周期逻辑与业务逻辑耦合
- 后续如果增加更多桌面能力，主入口会继续膨胀

### 3. 桌面桥接层职责过多

`src/desktop-ui/bridge.ts` 当前承担了：

- Hash 路由解析
- 页面渲染调度
- API 代理
- 外链打开
- 错误页渲染
- 链接拦截

问题：

- 它已经不是单纯的 bridge，而是一个轻量前端 runtime
- 路由、错误处理、RPC 调用、导航行为耦合在同一个文件
- 不利于后续迁移到真正的前端工程

### 4. 页面系统仍然是静态 HTML 拼装

当前 `src/pages/*.html` 体量很大，例如：

- `config-skills.html`
- `index.html`
- `config-channels.html`

配合 `src/routes/pages.ts` 通过文本导入和字符串替换完成渲染。

问题：

- 页面无法组件化复用
- 共享布局靠正则替换 `<aside>`
- 资源注入靠字符串替换 `href/src`
- 测试和局部演进困难

### 5. 页面路由与资源注入写死在服务层

`src/routes/pages.ts` 当前承担了：

- 页面路径表
- 侧边栏渲染
- CSS/JS 静态资源响应
- 页面 HTML 包装

问题：

- 路由表和视图实现耦合
- 页面壳、导航、资源注入逻辑没有独立层
- 未来切到 React/Vite 时需要整体推倒

### 6. RPC schema 位置不合理

`src/desktop-ui/rpc-schema.ts` 定义了主进程和 webview 之间的协议，但它被放在 `desktop-ui` 下。

问题：

- 从职责上它应该属于 shared contract
- 当前目录暗示它只服务于前端，实际上主进程也依赖它

### 7. 构建流程仍然偏“脚本拼接”

当前 `electrobun.config.ts` 与 `package.json` 的脚本中，明显还能看到旧页面架构痕迹：

- `tailwind:build` 输出到 `dist/output.css`
- `copy` 里直接复制 `shell.html`、`sidebar-update.js`、`pages-shell.css`
- 桌面 view 入口还是 `src/desktop-ui/bridge.ts`

问题：

- 构建物是“页面文件 + CSS + bridge”组合，不是独立 webview 应用
- 静态资源和逻辑资源分散
- 构建产物组织方式与 starter 的分层思路不一致

### 8. API、任务、系统能力缺少更稳定的分层

当前：

- `routes/api.ts` 很重
- `tasks/*` 负责任务执行
- `system/*` 负责系统能力
- `gateway/*` 负责网关能力

问题：

- 这些层已经接近“应用服务层”，但还没有明确按 domain / service / transport 分层
- API 层可能直接知道过多底层细节

### 9. 样式体系仍然绑定 daisyui

当前 `package.json` 里仍然存在：

- `daisyui`
- `tailwindcss`

当前页面也广泛使用了 daisyui 的语义类名，例如：

- `btn`
- `btn-primary`
- `btn-ghost`
- `card`
- `input`
- `select`

问题：

- 页面结构和 daisyui 组件类强绑定
- 后续切到 `shadcn/ui` 时，不能只替换依赖，必须同步改页面结构
- 设计 token、表单样式、弹层样式、按钮层级都需要重建

## 建议的目标结构

建议把 `/app` 重构到接近下面的结构：

```text
app/
  main/
    index.ts
    window/
    lifecycle/
    rpc/
    updater/
    bootstrap/
  webview/
    index.html
    src/
      main.ts
      router/
      pages/
      layouts/
      components/
      components/ui/
      services/
      styles/
  shared/
    rpc/
      schema.ts
      types.ts
    constants/
  server/
    api/
    pages/
    services/
    domains/
      gateway/
      system/
      config/
      tasks/
  scripts/
    ...
  electrobun.config.ts
  package.json
```

说明：

- `main/` 对应 starter 的主进程层
- `webview/` 对应 starter 的前端工程层
- `shared/` 放共享协议和常量
- `server/` 承接当前 `routes / tasks / system / gateway / config` 的服务端逻辑
- `webview/src/components/ui/` 用来承接 shadcn/ui 生成或整理后的基础组件

这不是一次性全部迁完的目标，而是重构后的稳定方向。

## 重构步骤

### 阶段 1：先做目录分层，不改行为

目标：先把职责边界划清，保持现有功能可运行。

步骤：

1. 新建目录骨架：
   - `main/`
   - `webview/`
   - `shared/`
   - `server/`
2. 将 `src/desktop-ui/rpc-schema.ts` 迁到 `shared/rpc/schema.ts`
3. 将 `src/bun/*` 迁到 `main/`
4. 将 `src/routes/*` 迁到 `server/api` 和 `server/pages`
5. 将 `src/tasks/*`、`src/system/*`、`src/gateway/*`、`src/config/*` 迁到 `server/services` 或 `server/domains/*`
6. 保持 import 兼容，优先通过路径调整完成，不先改逻辑

交付标准：

- 构建脚本还能跑
- 功能行为不变
- 主进程、共享协议、服务逻辑、页面资源在目录上已经分开

### 阶段 2：拆主进程入口

目标：把 `main/index.ts` 从“大总管”拆成多个独立模块。

建议拆分为：

- `main/index.ts`：应用启动入口
- `main/window/create-main-window.ts`
- `main/lifecycle/single-instance.ts`
- `main/rpc/register-rpc.ts`
- `main/updater/update-state.ts`
- `main/updater/check-for-updates.ts`
- `main/bootstrap/startup-tasks.ts`

重点：

- 让窗口创建、更新逻辑、启动任务、RPC 注册彼此隔离
- 主入口只负责组装

交付标准：

- `main/index.ts` 明显缩小
- 更新逻辑和窗口逻辑可以独立阅读、独立测试

### 阶段 3：把桌面 bridge 拆成真正的 webview runtime

目标：先不急着上 React，也要先把 `bridge.ts` 拆小。

建议拆分为：

- `webview/src/main.ts`
- `webview/src/router/hash-router.ts`
- `webview/src/runtime/render-route.ts`
- `webview/src/runtime/error-screen.ts`
- `webview/src/runtime/navigation.ts`
- `webview/src/services/desktop-rpc.ts`

重点：

- RPC 客户端单独封装
- 路由解析和导航拦截拆开
- 错误屏渲染独立
- 页面加载超时和 API 代理超时独立配置

交付标准：

- 不再出现一个几百行的 `bridge.ts` 文件承担全部前端运行时职责

### 阶段 4：把“静态 HTML 页面系统”迁到 `webview/`

目标：把当前页面从文本模板系统，迁到独立前端工程。

这里有两条路线：

#### 路线 A：先做轻量模块化，不立即引入 React

- 将每个页面改成 `webview/src/pages/*`
- 用原生 TS + 模板函数 + 小型组件组织页面
- 先保留现有 UI 和交互

适合：

- 想先快速降耦合
- 避免一次性改 UI 架构过大

#### 路线 B：直接对齐 starter，引入 React + Vite

- 新建 `webview/` 前端工程
- 用 React 管理页面、布局、组件和状态
- 通过 shared schema 调 RPC

适合：

- 你明确希望 `/app` 后续长期以 starter 作为基础继续发展
- 接受一次较大的页面迁移成本

建议：

- 先按 A 清边界，再切 B
- 除非你准备同步重写大部分配置页面，否则不建议一步到位全切 React

### 阶段 5：样式体系从 daisyui 迁到 shadcn/ui

目标：把当前依赖 daisyui class 的页面，迁到 `tailwindcss + shadcn/ui + 自定义 tokens`。

这一步建议默认按 `shadcn/ui` 处理。你消息里的 `shadcn/uui` 我先按 `shadcn/ui` 理解，如果你指的是别的 UI 库，再单独调整。

建议步骤：

1. 在 `webview/` 建立新的样式基础设施
   - `tailwind.config` 或对应 Tailwind 4 配置
   - `components.json`
   - `lib/utils.ts`
   - 全局 `theme.css` 或 `globals.css`
2. 建立设计 token
   - 颜色
   - 圆角
   - 间距
   - 阴影
   - 字体层级
3. 初始化基础 shadcn/ui 组件
   - `Button`
   - `Input`
   - `Textarea`
   - `Select`
   - `Dialog`
   - `DropdownMenu`
   - `Tabs`
   - `Card`
   - `Tooltip`
   - `Toast`
4. 把布局层先从 daisyui class 中脱钩
   - 先替换导航
   - 再替换表单
   - 最后替换复杂交互区块
5. 完成后再移除 `daisyui` 依赖和遗留 class

迁移原则：

- 不要一边保留大面积 daisyui class，一边局部塞 shadcn/ui
- 优先迁移基础组件和布局组件，再迁移业务页面
- 允许过渡期保留 Tailwind，但不再新增 daisyui 语义类

交付标准：

- 新页面和被迁移页面不再依赖 daisyui
- 组件样式主要通过 shadcn/ui 组件和本项目 token 控制
- `package.json` 可以移除 `daisyui`

### 阶段 6：重写页面服务边界

目标：减少 `server/pages` 对页面实现细节的感知。

重构后建议：

- `server/pages` 只负责页面请求分发
- 共享布局由 webview 自己处理
- 不再在服务端用正则替换 `<aside>`
- 不再在服务端做大量 `href/src` 文本替换

交付标准：

- 页面布局、导航、资源注入移出服务端字符串处理
- 服务端只返回页面入口或必要数据

### 阶段 7：建立 shared contract 层

目标：完全对齐 starter 的 shared schema 思路。

建议内容：

- `shared/rpc/schema.ts`
- `shared/rpc/requests.ts`
- `shared/rpc/responses.ts`
- `shared/constants/routes.ts`

作用：

- 主进程和 webview 共用协议
- 减少魔法字符串和重复类型
- 为后续测试和演进提供稳定接口

### 阶段 8：整理服务层

目标：把当前“按技术类型划分”的模块，收敛成更稳定的业务域。

建议方向：

- `server/domains/gateway/*`
- `server/domains/system/*`
- `server/domains/config/*`
- `server/domains/update/*`
- `server/domains/openclaw/*`

同时增加：

- `server/services/*` 作为应用编排层
- `server/api/*` 作为 HTTP/RPC 暴露层

原则：

- domain 负责核心能力
- service 负责流程编排
- api 负责输入输出适配

### 阶段 9：构建系统对齐 starter

目标：让构建输出围绕 `main + webview + shared` 组织。

需要调整的点：

1. `electrobun.config.ts`
   - 主入口从旧 `src/bun/index.ts` 指向新 `main/index.ts`
   - view 入口从 `src/desktop-ui/bridge.ts` 指向新 `webview` 入口
2. `package.json`
   - 拆分桌面主进程和 webview 构建脚本
   - 如果上 React/Vite，则增加 `webview:dev` 和 `webview:build`
3. 资源拷贝规则
   - 不再围绕 `shell.html + sidebar-update.js + output.css` 拼装
   - 改成复制 webview build 产物

交付标准：

- 构建产物结构清晰
- 主进程和 webview 都有明确入口
- 能接近 starter 的开发体验

## 推荐执行顺序

建议不要一次性重写所有页面，按下面顺序推进：

1. 先迁目录和 shared schema
2. 再拆主进程入口
3. 再拆 bridge/runtime
4. 再迁页面系统
5. 再切样式体系到 shadcn/ui
6. 最后调整构建链路

原因：

- 先改结构，风险最小
- 先清边界，再改实现
- 先把页面运行时稳定，再处理 daisyui 到 shadcn/ui 的样式迁移
- 避免“目录、协议、UI、样式、构建”同时变更导致难以回归

## 第一批优先重构文件

建议第一批先动这些文件：

- `src/bun/index.ts`
- `src/bun/desktop-ui.ts`
- `src/desktop-ui/bridge.ts`
- `src/desktop-ui/rpc-schema.ts`
- `src/routes/pages.ts`
- `electrobun.config.ts`
- `package.json`

原因：

- 这是当前与 starter 结构差异最大的部分
- 它们决定了后续能不能顺利切到 `main / webview / shared`

## 第二批再处理的内容

- `src/pages/*.html`
- `src/routes/api.ts`
- `src/tasks/*`
- `src/system/*`
- `src/gateway/*`
- `src/config/*`
- `src/styles/input.css`

这部分适合在边界稳定后，按领域逐步迁移。

## 本次重构建议的落地策略

建议采用“两步走”：

### 第一步：结构重构

目标是：

- 改目录
- 拆入口
- 拆协议
- 不改核心业务行为

### 第二步：页面现代化

目标是：

- 把页面体系从静态 HTML 字符串迁到真正的 webview 应用
- 逐步向 `electrobun-starter` 的 React/Vite 方式靠拢

### 第三步：组件和样式现代化

目标是：

- 把 `daisyui` 依赖迁到 `shadcn/ui`
- 统一基础组件、表单、弹层和导航样式
- 让 UI 层从“页面写 class”转向“页面组合组件”

## 风险点

- 当前页面大量依赖内联脚本，迁移时容易出现作用域和加载时序问题
- `routes/pages.ts` 里有较多字符串替换逻辑，切换时容易漏资源引用
- `src/bun/index.ts` 中更新流程与窗口生命周期耦合，拆分时要保留行为顺序
- `routes/api.ts` 体量较大，后续服务层拆分要配合回归测试
- daisyui 到 shadcn/ui 不是纯样式替换，很多页面 DOM 结构需要一起改
- 如果直接大批量替换 class，容易出现视觉回归和交互退化

## 结论

这次重构的核心不是“换个目录名”，而是把当前 `/app` 从：

- `src` 下的混合式 Electrobun 应用

重构成：

- `main + webview + shared + server` 的分层结构

并逐步向 `electrobun-starter` 的架构方式靠拢。

如果把样式目标也算进去，这次重构的完整目标应理解为：

- 架构向 `electrobun-starter` 靠拢
- 页面系统从静态 HTML 迁到独立 webview
- 样式体系从 `daisyui` 迁到 `shadcn/ui`

如果继续执行，下一步建议直接开始“阶段 1：目录分层，不改行为”的实际迁移。
