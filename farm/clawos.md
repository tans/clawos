 # ClawOS 技术架构说明文档（v1.1）

---

## 1. 概述

ClawOS 是一个用于管理、调度和编排多种 AI Agent Runtime 的分布式控制系统。其核心目标是统一调度多个分布式 Agent 系统，实现跨节点、多运行时的协同执行。

系统支持以下 Runtime：

* OpenClaw
* NullClaw
* OpenFang

这些 Runtime 均具备分布式能力，但抽象层级和调度模型不同。

---

## 2. 系统目标

* 统一管理多个分布式 Agent 系统
* 提供跨 Runtime 的任务调度能力
* 支持多节点、多会话执行
* 实现任务编排与资源分配
* 提供标准化接口与扩展能力

---

## 3. Runtime 统一定义

### 3.1 Runtime 本质

所有 Runtime 均定义为：

```ts
Distributed Agent Runtime
```

即：

* 内部可能包含多个节点
* 自带执行与调度能力
* 对外提供统一调用接口

---

### 3.2 Runtime 抽象接口

```ts
interface RuntimeAdapter {
  type: "openclaw" | "nullclaw" | "openfang";

  execute(task: Task): Promise<Result>;

  stream?(task: Task): AsyncIterable<Event>;

  health(): Promise<Status>;
}
```

---

## 4. Runtime 分层模型

| Runtime  | 分布式层级            | 说明                  |
| -------- | ---------------- | ------------------- |
| OpenClaw | Agent-level 分布式  | 多节点 Agent 网络        |
| NullClaw | Worker-level 分布式 | 轻量执行节点集群            |
| OpenFang | Task-level 分布式   | DAG / pipeline 执行系统 |

---

## 5. ClawOS 架构

```text
                ┌──────────────┐
                │   ClawOS UI  │
                └──────┬───────┘
                       ↓
             ┌──────────────────┐
             │  Control Plane   │
             │ (ClawOS Server)  │
             └──────┬───────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
 ┌──────────────┐       ┌──────────────┐
 │ Runtime A    │       │ Runtime B    │
 │ (Cluster)    │       │ (Cluster)    │
 └──────────────┘       └──────────────┘
```

---

## 6. 核心模块

### 6.1 Control Plane

负责：

* Runtime 注册与管理
* 任务调度
* Session 管理
* 资源调度策略
* 权限与访问控制

---

### 6.2 Runtime Adapter 层

用于对接不同分布式 Runtime：

* 统一调用方式
* 屏蔽底层实现差异
* 支持扩展

---

### 6.3 Scheduler

负责 Runtime 级调度：

```ts
type Strategy =
  | "runtime-based"
  | "load-based"
  | "capability-based";
```

---

## 7. 任务模型

```ts
type Task = {
  id: string;
  sessionId: string;
  runtime?: string;
  type: "chat" | "action";
  payload: any;
};
```

---

## 8. 调度模型（关键）

ClawOS 只做：

```text
Runtime 级调度
```

不介入 Runtime 内部调度。

---

### 8.1 调度流程

```text
Task
 ↓
ClawOS Scheduler
 ↓
选择 Runtime
 ↓
Runtime 内部执行
 ↓
返回结果
```

---

## 9. 执行模型

### 9.1 OpenClaw

* 多节点 Agent 网络
* 支持会话与上下文
* 内部完成任务执行

---

### 9.2 NullClaw

* 分布式 Worker
* 支持批处理任务
* 内部执行任务调度

---

### 9.3 OpenFang

* DAG 调度系统
* 多节点并行执行
* 支持复杂任务编排

---

## 10. 分布式设计原则

### 10.1 调度边界

```text
ClawOS → Runtime 级调度
Runtime → 内部任务调度
```

---

### 10.2 解耦原则

* 不修改 Runtime 内部逻辑
* 通过 Adapter 适配
* 保持 Runtime 独立演进

---

## 11. Session 管理

```ts
sessionId → runtime
```

说明：

* 一个 session 绑定一个 Runtime
* 避免跨 Runtime 上下文冲突

---

## 12. 多层调度模型

### 第1层：ClawOS

* 选择 Runtime

### 第2层：Runtime

* 内部调度任务

### 第3层：节点

* 实际执行

---

## 13. Runtime Adapter 示例

### OpenClaw

```ts
class OpenClawRuntime implements RuntimeAdapter {
  async execute(task: Task) {
    return fetch("openclaw-endpoint", {
      method: "POST",
      body: JSON.stringify(task)
    });
  }
}
```

---

### NullClaw

```ts
class NullClawRuntime implements RuntimeAdapter {
  async execute(task: Task) {
    return fetch("nullclaw-endpoint", {
      method: "POST",
      body: JSON.stringify(task)
    });
  }
}
```

---

### OpenFang

```ts
class OpenFangRuntime implements RuntimeAdapter {
  async execute(task: Task) {
    return fetch("openfang-endpoint", {
      method: "POST",
      body: JSON.stringify({
        dag: transform(task)
      })
    });
  }
}
```

---

## 14. 系统演进路径

### 阶段一

* 单 Runtime 接入
* 基础调度

---

### 阶段二

* 多 Runtime 支持
* 调度策略优化

---

### 阶段三

* 分布式 Runtime 协同
* 跨 Runtime 编排

---

### 阶段四

* UI 控制台
* 多租户
* 权限系统
* 监控与日志

---

## 15. 总结

ClawOS 定义为：

```text
Distributed Runtime Orchestrator
```

系统职责：

* 统一调度多个分布式 Runtime
* 提供标准接口与调度能力
* 实现跨系统的任务执行与编排

架构核心：

```text
ClawOS   = 调度层（Runtime Orchestrator）
Runtime  = 分布式执行系统
```

---

如果需要进一步扩展，可以继续补充：

* 通信协议（WebSocket / gRPC）
* 多机网络拓扑
* 安全模型（认证 / 隔离）
* DAG 跨 Runtime 编排（高级能力）
