# Agent Market Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `agent-market/` portal site that presents a demand-first enterprise Agent marketplace homepage, while keeping the current `web` `/agent-market` page as the explanation layer and adding a configurable handoff into the new portal.

**Architecture:** Create a new Vite + React + TypeScript frontend in `agent-market/` using static local data shaped like future marketplace data. Keep the visual system white, restrained, and enterprise-facing with plain CSS variables and section-specific layout classes. Update the current `web` app to expose a configurable portal URL and link the static `/agent-market` page into the standalone portal without removing the current page.

**Tech Stack:** Bun, Vite, React 19, TypeScript, Vitest, Testing Library, plain CSS with CSS custom properties, existing `web` Hono app for the static entry page.

---

## File Structure

### New project: `agent-market/`

- Create: `agent-market/package.json`
  - Independent package scripts for `dev`, `build`, `preview`, and `test`
- Create: `agent-market/tsconfig.json`
  - TypeScript config matching existing Vite React projects in the repo
- Create: `agent-market/vite.config.ts`
  - Vite config with React plugin, dev port, and `dist` output
- Create: `agent-market/index.html`
  - App mount shell
- Create: `agent-market/src/main.tsx`
  - React bootstrap entry
- Create: `agent-market/src/app.tsx`
  - Top-level portal composition
- Create: `agent-market/src/styles.css`
  - Entire visual system for the portal
- Create: `agent-market/src/content/portal-data.ts`
  - Static market stats, featured tasks, filters, role cards, capability cards, and case cards
- Create: `agent-market/src/lib/portal-types.ts`
  - Shared TypeScript types for content groups
- Create: `agent-market/src/components/portal-header.tsx`
  - Top navigation and role shortcuts
- Create: `agent-market/src/components/hero-demand.tsx`
  - Headline, market stats, and hero task panel
- Create: `agent-market/src/components/task-stream.tsx`
  - Demand overview chips and featured task cards
- Create: `agent-market/src/components/role-entries.tsx`
  - Enterprise, provider, and ecosystem role routing cards
- Create: `agent-market/src/components/market-proof.tsx`
  - Capability supply, case outcomes, process, rules, and CTA sections
- Create: `agent-market/src/app.test.tsx`
  - Smoke and content tests for the portal homepage
- Create: `agent-market/src/vitest.setup.ts`
  - Testing Library matcher setup

### Existing `web` integration

- Modify: `web/src/lib/env.ts`
  - Add `agentMarketPortalUrl` config parsing
- Modify: `web/src/views/agent-market.tsx`
  - Add demand-first copy refinements and a portal handoff CTA
- Modify: `web/test/env.test.ts`
  - Cover `AGENT_MARKET_PORTAL_URL`
- Modify: `web/test/marketing-pages.test.ts`
  - Assert the static page links into the standalone portal when configured

---

### Task 1: Scaffold the standalone `agent-market/` project

**Files:**
- Create: `agent-market/package.json`
- Create: `agent-market/tsconfig.json`
- Create: `agent-market/vite.config.ts`
- Create: `agent-market/index.html`
- Create: `agent-market/src/main.tsx`
- Create: `agent-market/src/app.tsx`
- Create: `agent-market/src/vitest.setup.ts`
- Create: `agent-market/src/app.test.tsx`

- [ ] **Step 1: Write the failing homepage smoke test**

```tsx
// agent-market/src/app.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { App } from "./app";

describe("AgentMarket portal", () => {
  test("renders the demand-first market headline and role CTAs", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /把企业需求转成可协作、可交付、可复用的 agent 任务/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /提交企业需求/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /申请成为服务方/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify the project does not exist yet**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
FAIL
error: No such file or directory
```

- [ ] **Step 3: Create the package and TypeScript/Vite scaffolding**

```json
// agent-market/package.json
{
  "name": "clawos-agent-market",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^26.1.0",
    "typescript": "^5.9.3",
    "vite": "^8.0.1",
    "vitest": "^3.2.4"
  }
}
```

```json
// agent-market/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

```ts
// agent-market/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5186,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/vitest.setup.ts",
  },
});
```

```html
<!-- agent-market/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClawOS Agent Market</title>
    <meta
      name="description"
      content="ClawOS Agent 协作市场门户，面向企业需求、服务方能力与生态合作。"
    />
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

- [ ] **Step 4: Create the minimal React bootstrap and App shell**

```tsx
// agent-market/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

```tsx
// agent-market/src/app.tsx
export function App() {
  return (
    <main>
      <h1>把企业需求转成可协作、可交付、可复用的 Agent 任务</h1>
      <a href="#enterprise-entry">提交企业需求</a>
      <a href="#provider-entry">申请成为服务方</a>
    </main>
  );
}
```

```ts
// agent-market/src/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Install dependencies and run the smoke test**

Run:

```bash
cd agent-market
bun install
bun test src/app.test.tsx
```

Expected:

```text
1 pass
0 fail
```

- [ ] **Step 6: Commit the scaffold**

```bash
git add agent-market/package.json agent-market/tsconfig.json agent-market/vite.config.ts agent-market/index.html agent-market/src/main.tsx agent-market/src/app.tsx agent-market/src/vitest.setup.ts agent-market/src/app.test.tsx
git commit -m "feat: scaffold agent market portal app"
```

### Task 2: Add typed portal content and assemble the demand-first page structure

**Files:**
- Create: `agent-market/src/lib/portal-types.ts`
- Create: `agent-market/src/content/portal-data.ts`
- Modify: `agent-market/src/app.tsx`

- [ ] **Step 1: Write the failing content structure test**

```tsx
// agent-market/src/app.test.tsx
test("renders demand filters, featured tasks, and role sections", () => {
  render(<App />);

  expect(screen.getByText("热门需求")).toBeInTheDocument();
  expect(screen.getByText("销售")).toBeInTheDocument();
  expect(screen.getByText("客服")).toBeInTheDocument();
  expect(screen.getByText("企业方")).toBeInTheDocument();
  expect(screen.getByText("服务方")).toBeInTheDocument();
  expect(screen.getByText("生态伙伴")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails on missing market content**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
FAIL
Unable to find an element with the text: 热门需求
```

- [ ] **Step 3: Define content types for the portal sections**

```ts
// agent-market/src/lib/portal-types.ts
export interface MarketStat {
  label: string;
  value: string;
  tone?: "default" | "accent";
}

export interface MarketTask {
  title: string;
  scenario: string;
  scope: string;
  mode: string;
  phase: string;
  period: string;
}

export interface RoleEntry {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}
```

- [ ] **Step 4: Add static market data shaped like future real data**

```ts
// agent-market/src/content/portal-data.ts
import type { MarketStat, MarketTask, RoleEntry } from "../lib/portal-types";

export const marketStats: MarketStat[] = [
  { label: "活跃需求方向", value: "24" },
  { label: "标准化任务类型", value: "11" },
  { label: "本周新增需求", value: "08", tone: "accent" },
];

export const demandFilters = ["销售", "客服", "运营", "知识库", "私有部署"] as const;

export const featuredTasks: MarketTask[] = [
  {
    title: "销售知识库搭建与问答助手",
    scenario: "销售支持",
    scope: "知识接入 + Agent 编排",
    mode: "按阶段协作",
    phase: "需求评估中",
    period: "2-3 周",
  },
  {
    title: "客服 SOP 分流与质检工作流",
    scenario: "客户服务",
    scope: "流程自动化",
    mode: "持续协作",
    phase: "供给匹配中",
    period: "3-4 周",
  },
  {
    title: "虾壳主机私有部署支持",
    scenario: "部署上线",
    scope: "OpenClaw 预装交付",
    mode: "联合交付",
    phase: "准备启动",
    period: "1-2 周",
  },
];

export const roleEntries: RoleEntry[] = [
  {
    title: "企业方",
    description: "提交业务需求，判断哪些任务适合进入可持续协作。",
    actionLabel: "提交企业需求",
    actionHref: "#enterprise-entry",
  },
  {
    title: "服务方",
    description: "展示交付能力、标准化经验与持续服务方式。",
    actionLabel: "申请成为服务方",
    actionHref: "#provider-entry",
  },
  {
    title: "生态伙伴",
    description: "参与部署、实施、硬件与联合交付支持。",
    actionLabel: "申请生态合作",
    actionHref: "#partner-entry",
  },
];
```

- [ ] **Step 5: Replace the placeholder App with the portal section skeleton**

```tsx
// agent-market/src/app.tsx
import { demandFilters, featuredTasks, marketStats, roleEntries } from "./content/portal-data";

export function App() {
  return (
    <main className="portal-page">
      <section className="portal-hero">
        <p className="portal-kicker">Agent 协作市场</p>
        <h1>把企业需求转成可协作、可交付、可复用的 Agent 任务</h1>
        <p className="portal-lead">
          面向企业需求、交付能力与生态支持的市场门户，优先展示真实业务任务的协作机会。
        </p>
        <div className="portal-stat-row">
          {marketStats.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-section">
        <h2>热门需求</h2>
        <div className="portal-filter-row">
          {demandFilters.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="portal-task-list">
          {featuredTasks.map((task) => (
            <article key={task.title}>
              <h3>{task.title}</h3>
              <p>{task.scenario}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-section">
        <h2>角色入口</h2>
        <div className="portal-role-grid">
          {roleEntries.map((role) => (
            <article key={role.title}>
              <h3>{role.title}</h3>
              <p>{role.description}</p>
              <a href={role.actionHref}>{role.actionLabel}</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Run the updated test to verify the core IA renders**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
2 pass
0 fail
```

- [ ] **Step 7: Commit the typed content model**

```bash
git add agent-market/src/lib/portal-types.ts agent-market/src/content/portal-data.ts agent-market/src/app.tsx agent-market/src/app.test.tsx
git commit -m "feat: add agent market portal content model"
```

### Task 3: Split the homepage into focused portal components

**Files:**
- Create: `agent-market/src/components/portal-header.tsx`
- Create: `agent-market/src/components/hero-demand.tsx`
- Create: `agent-market/src/components/task-stream.tsx`
- Create: `agent-market/src/components/role-entries.tsx`
- Modify: `agent-market/src/app.tsx`
- Test: `agent-market/src/app.test.tsx`

- [ ] **Step 1: Write the failing component-composition test**

```tsx
// agent-market/src/app.test.tsx
test("renders task-card metadata and role actions", () => {
  render(<App />);

  expect(screen.getByText("按阶段协作")).toBeInTheDocument();
  expect(screen.getByText("需求评估中")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "申请生态合作" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and confirm the metadata is still missing**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
FAIL
Unable to find an element with the text: 按阶段协作
```

- [ ] **Step 3: Create a focused hero component with portal stats and shortcuts**

```tsx
// agent-market/src/components/hero-demand.tsx
import { marketStats, roleEntries, featuredTasks } from "../content/portal-data";

export function HeroDemand() {
  return (
    <section className="portal-hero">
      <div className="portal-hero-copy">
        <p className="portal-kicker">Agent 协作市场</p>
        <h1>把企业需求转成可协作、可交付、可复用的 Agent 任务</h1>
        <p className="portal-lead">
          优先面向企业业务任务，把需求、交付能力与生态支持组织成可持续协作关系。
        </p>
        <div className="portal-action-row">
          <a href="#enterprise-entry">提交企业需求</a>
          <a href="#provider-entry">申请成为服务方</a>
        </div>
        <div className="portal-stat-row">
          {marketStats.map((item) => (
            <article key={item.label} className={item.tone === "accent" ? "is-accent" : ""}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </div>
      <aside className="hero-task-panel">
        {featuredTasks.slice(0, 2).map((task) => (
          <article key={task.title}>
            <span>{task.phase}</span>
            <h2>{task.title}</h2>
            <p>{task.scope}</p>
          </article>
        ))}
        <nav className="hero-role-shortcuts">
          {roleEntries.map((role) => (
            <a key={role.title} href={role.actionHref}>
              {role.title}
            </a>
          ))}
        </nav>
      </aside>
    </section>
  );
}
```

- [ ] **Step 4: Create task stream and role entry components**

```tsx
// agent-market/src/components/task-stream.tsx
import { demandFilters, featuredTasks } from "../content/portal-data";

export function TaskStream() {
  return (
    <section className="portal-section">
      <div className="section-heading">
        <p>热门需求</p>
        <h2>优先展示已经进入结构化协作路径的企业任务</h2>
      </div>
      <div className="portal-filter-row">
        {demandFilters.map((label) => (
          <span key={label} className="filter-chip">
            {label}
          </span>
        ))}
      </div>
      <div className="portal-task-grid">
        {featuredTasks.map((task) => (
          <article key={task.title} className="task-card">
            <div className="task-card-meta">
              <span>{task.scenario}</span>
              <span>{task.phase}</span>
            </div>
            <h3>{task.title}</h3>
            <p>{task.scope}</p>
            <div className="task-card-foot">
              <span>{task.mode}</span>
              <span>{task.period}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

```tsx
// agent-market/src/components/role-entries.tsx
import { roleEntries } from "../content/portal-data";

export function RoleEntries() {
  return (
    <section className="portal-section">
      <div className="section-heading">
        <p>角色入口</p>
        <h2>按参与角色进入不同合作路径</h2>
      </div>
      <div className="portal-role-grid">
        {roleEntries.map((role) => (
          <article key={role.title} className="role-card" id={role.actionHref.replace("#", "")}>
            <h3>{role.title}</h3>
            <p>{role.description}</p>
            <a href={role.actionHref}>{role.actionLabel}</a>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create a simple header and recompose `App`**

```tsx
// agent-market/src/components/portal-header.tsx
export function PortalHeader() {
  return (
    <header className="portal-header">
      <a className="portal-brand" href="#top">
        ClawOS Agent Market
      </a>
      <nav className="portal-nav" aria-label="市场主导航">
        <a href="#tasks">热门需求</a>
        <a href="#roles">角色入口</a>
        <a href="#proof">交付能力</a>
        <a href="#rules">流程与规则</a>
      </nav>
    </header>
  );
}
```

```tsx
// agent-market/src/app.tsx
import { PortalHeader } from "./components/portal-header";
import { HeroDemand } from "./components/hero-demand";
import { TaskStream } from "./components/task-stream";
import { RoleEntries } from "./components/role-entries";

export function App() {
  return (
    <div className="portal-shell" id="top">
      <PortalHeader />
      <HeroDemand />
      <div id="tasks">
        <TaskStream />
      </div>
      <div id="roles">
        <RoleEntries />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests to confirm the split keeps the page rendering**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
3 pass
0 fail
```

- [ ] **Step 7: Commit the page composition split**

```bash
git add agent-market/src/components/portal-header.tsx agent-market/src/components/hero-demand.tsx agent-market/src/components/task-stream.tsx agent-market/src/components/role-entries.tsx agent-market/src/app.tsx agent-market/src/app.test.tsx
git commit -m "feat: compose agent market portal sections"
```

### Task 4: Add capability, case, process, and CTA proof sections

**Files:**
- Create: `agent-market/src/components/market-proof.tsx`
- Modify: `agent-market/src/content/portal-data.ts`
- Modify: `agent-market/src/lib/portal-types.ts`
- Modify: `agent-market/src/app.tsx`
- Test: `agent-market/src/app.test.tsx`

- [ ] **Step 1: Extend the failing test to cover proof and governance content**

```tsx
// agent-market/src/app.test.tsx
test("renders capability proof, case outcomes, and rules content", () => {
  render(<App />);

  expect(screen.getByText("交付能力")).toBeInTheDocument();
  expect(screen.getByText("案例结果")).toBeInTheDocument();
  expect(screen.getByText("流程与规则")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "申请生态合作" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to confirm those sections are missing**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
FAIL
Unable to find an element with the text: 交付能力
```

- [ ] **Step 3: Extend the content model with capability cards and case cards**

```ts
// agent-market/src/lib/portal-types.ts
export interface CapabilityCard {
  title: string;
  description: string;
}

export interface CaseCard {
  title: string;
  scenario: string;
  outcome: string;
}
```

```ts
// agent-market/src/content/portal-data.ts
import type { CapabilityCard, CaseCard } from "../lib/portal-types";

export const capabilityCards: CapabilityCard[] = [
  { title: "工作流设计与 Agent 编排", description: "把复杂业务动作拆成可协作的执行链路。" },
  { title: "企业知识结构化", description: "把知识库、SOP 与问答能力组织成可维护资产。" },
  { title: "私有部署与运行支持", description: "结合 OpenClaw 与虾壳主机形成更稳定的本地优先交付。" },
];

export const caseCards: CaseCard[] = [
  { title: "销售知识库升级", scenario: "销售支持", outcome: "常见问答整理时间缩短，交付材料复用率提升。" },
  { title: "客服流程自动化", scenario: "客户服务", outcome: "重复分流动作下降，人工介入点更清晰。" },
  { title: "内部运营内容流水线", scenario: "运营执行", outcome: "固定模板任务进入持续协作方式。" },
];
```

- [ ] **Step 4: Implement the proof and governance component**

```tsx
// agent-market/src/components/market-proof.tsx
import { capabilityCards, caseCards } from "../content/portal-data";

const flowSteps = [
  "识别任务方向并明确范围",
  "结构化需求与交付边界",
  "匹配执行能力与协作方式",
  "进入交付、验收与复盘",
];

const rulePoints = ["结构化范围", "可验证交付", "可复用结果", "合作边界清晰"];

export function MarketProof() {
  return (
    <>
      <section className="portal-section" id="proof">
        <div className="section-heading">
          <p>交付能力</p>
          <h2>让需求侧知道市场里有哪些可持续协作能力</h2>
        </div>
        <div className="portal-proof-grid">
          {capabilityCards.map((item) => (
            <article key={item.title} className="proof-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-section">
        <div className="section-heading">
          <p>案例结果</p>
          <h2>用匿名结果展示市场协作的业务价值</h2>
        </div>
        <div className="portal-case-grid">
          {caseCards.map((item) => (
            <article key={item.title} className="case-card">
              <span>{item.scenario}</span>
              <h3>{item.title}</h3>
              <p>{item.outcome}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-section portal-rule-section" id="rules">
        <div className="portal-rule-panel">
          <div>
            <p className="section-label">流程与规则</p>
            <h2>不是无边界众包，而是有治理的协作市场</h2>
            <ol>
              {flowSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <ul className="rule-chip-list">
            {rulePoints.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="portal-section portal-final-cta">
        <div className="portal-cta-grid">
          <a href="#enterprise-entry">提交企业需求</a>
          <a href="#provider-entry">申请成为服务方</a>
          <a href="#partner-entry">申请生态合作</a>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Compose the proof component into the page**

```tsx
// agent-market/src/app.tsx
import { MarketProof } from "./components/market-proof";

export function App() {
  return (
    <div className="portal-shell" id="top">
      <PortalHeader />
      <HeroDemand />
      <div id="tasks">
        <TaskStream />
      </div>
      <div id="roles">
        <RoleEntries />
      </div>
      <MarketProof />
    </div>
  );
}
```

- [ ] **Step 6: Run tests to verify the portal now covers the full IA**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
4 pass
0 fail
```

- [ ] **Step 7: Commit the proof sections**

```bash
git add agent-market/src/lib/portal-types.ts agent-market/src/content/portal-data.ts agent-market/src/components/market-proof.tsx agent-market/src/app.tsx agent-market/src/app.test.tsx
git commit -m "feat: add portal proof and governance sections"
```

### Task 5: Apply the restrained white-theme visual system

**Files:**
- Modify: `agent-market/src/styles.css`
- Test: `agent-market/src/app.test.tsx`

- [ ] **Step 1: Add a CSS smoke test for banned portal language**

```tsx
// agent-market/src/app.test.tsx
test("avoids low-trust marketplace wording", () => {
  render(<App />);

  expect(screen.queryByText(/poc/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/抢单/)).not.toBeInTheDocument();
  expect(screen.queryByText(/接单/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to keep the wording guard active before styling**

Run:

```bash
cd agent-market && bun test src/app.test.tsx
```

Expected:

```text
5 pass
0 fail
```

- [ ] **Step 3: Replace the bare styles with the full portal visual system**

```css
/* agent-market/src/styles.css */
:root {
  --bg: #ffffff;
  --bg-muted: #f7f8fa;
  --panel: #fbfbfc;
  --line: #e7e9ee;
  --ink-strong: #0f172a;
  --ink-normal: #1f2937;
  --ink-soft: #6b7280;
  --accent: #1d4ed8;
  --accent-soft: rgba(29, 78, 216, 0.08);
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
  background: linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #f8fafc 100%);
  color: var(--ink-normal);
  font-family:
    "Source Han Sans SC",
    "PingFang SC",
    "Noto Sans CJK SC",
    "Microsoft YaHei",
    sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.portal-shell {
  min-height: 100vh;
}

.portal-header,
.portal-hero,
.portal-section {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 84px;
}

.portal-nav {
  display: flex;
  gap: 28px;
  color: var(--ink-soft);
  font-size: 14px;
}

.portal-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 48px;
  padding: 52px 0 56px;
}

.portal-kicker,
.section-label,
.section-heading > p {
  margin: 0 0 16px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.portal-hero h1,
.section-heading h2,
.portal-rule-panel h2 {
  margin: 0;
  color: var(--ink-strong);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.portal-hero h1 {
  max-width: 11ch;
  font-size: clamp(3rem, 7vw, 6rem);
}

.portal-lead {
  max-width: 46rem;
  margin: 20px 0 0;
  color: var(--ink-soft);
  font-size: 17px;
  line-height: 1.9;
}

.portal-action-row,
.portal-stat-row,
.portal-filter-row,
.portal-cta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.portal-action-row {
  margin-top: 24px;
}

.portal-action-row a,
.portal-cta-grid a,
.role-card a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border-radius: 14px;
  background: var(--ink-strong);
  color: #ffffff;
  font-weight: 600;
}

.portal-stat-row {
  margin-top: 28px;
}

.portal-stat-row article,
.hero-task-panel,
.task-card,
.role-card,
.proof-card,
.case-card,
.portal-rule-panel {
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.05);
}

.portal-stat-row article {
  min-width: 140px;
  padding: 18px 20px;
}

.portal-stat-row strong {
  display: block;
  color: var(--ink-strong);
  font-size: 28px;
}

.hero-task-panel,
.task-card,
.role-card,
.proof-card,
.case-card {
  padding: 24px;
}

.portal-section {
  padding: 54px 0 0;
}

.portal-task-grid,
.portal-role-grid,
.portal-proof-grid,
.portal-case-grid {
  display: grid;
  gap: 20px;
}

.portal-task-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.portal-role-grid,
.portal-proof-grid,
.portal-case-grid,
.portal-cta-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.filter-chip,
.task-card-meta span,
.rule-chip-list li {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--bg-muted);
  color: var(--ink-soft);
  font-size: 13px;
}

.portal-rule-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 32px;
  padding: 32px;
}

.rule-chip-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.portal-final-cta {
  padding-bottom: 72px;
}

@media (max-width: 980px) {
  .portal-hero,
  .portal-rule-panel,
  .portal-task-grid,
  .portal-role-grid,
  .portal-proof-grid,
  .portal-case-grid,
  .portal-cta-grid {
    grid-template-columns: 1fr;
  }

  .portal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding-top: 16px;
  }

  .portal-nav {
    flex-wrap: wrap;
    gap: 14px;
  }
}
```

- [ ] **Step 4: Run the app tests and production build**

Run:

```bash
cd agent-market
bun test
bun run build
```

Expected:

```text
5 pass
0 fail
vite build ... ✓ built
```

- [ ] **Step 5: Commit the visual system**

```bash
git add agent-market/src/styles.css agent-market/src/app.test.tsx
git commit -m "style: add agent market portal visual system"
```

### Task 6: Wire the `web` static page into the standalone portal with config

**Files:**
- Modify: `web/src/lib/env.ts`
- Modify: `web/src/views/agent-market.tsx`
- Modify: `web/test/env.test.ts`
- Modify: `web/test/marketing-pages.test.ts`

- [ ] **Step 1: Add the failing config and handoff tests**

```ts
// web/test/env.test.ts
it("reads AGENT_MARKET_PORTAL_URL when set", async () => {
  process.env.AGENT_MARKET_PORTAL_URL = "https://market.clawos.cc";
  const { getEnv, resetEnvCacheForTests } = await import("../src/lib/env");
  resetEnvCacheForTests();

  expect(getEnv().agentMarketPortalUrl).toBe("https://market.clawos.cc");
});
```

```ts
// web/test/marketing-pages.test.ts
it("links the static market page to the standalone portal when configured", async () => {
  process.env.AGENT_MARKET_PORTAL_URL = "https://market.clawos.cc";
  const { resetEnvCacheForTests } = await import("../src/lib/env");
  resetEnvCacheForTests();

  const response = await app.request("http://localhost/agent-market");
  const html = await response.text();

  expect(html).toContain("进入市场门户");
  expect(html).toContain('href="https://market.clawos.cc"');
});
```

- [ ] **Step 2: Run the targeted `web` tests to verify the new config is missing**

Run:

```bash
cd web && bun test test/env.test.ts test/marketing-pages.test.ts
```

Expected:

```text
FAIL
Property 'agentMarketPortalUrl' does not exist
```

- [ ] **Step 3: Add portal URL parsing to the web environment contract**

```ts
// web/src/lib/env.ts
export interface AppEnv {
  port: number;
  uploadToken: string | null;
  adminUsername: string | null;
  adminPassword: string | null;
  maxInstallerSizeBytes: number;
  maxConfigSizeBytes: number;
  maxMcpPackageSizeBytes: number;
  storageDir: string;
  marketplaceEnabled: boolean;
  agentMarketPortalUrl: string | null;
}

function readOptionalUrl(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

const agentMarketPortalUrl = readOptionalUrl(process.env.AGENT_MARKET_PORTAL_URL);

cachedEnv = {
  port,
  uploadToken: process.env.UPLOAD_TOKEN?.trim() || "clawos",
  adminUsername: process.env.ADMIN_USERNAME?.trim() || null,
  adminPassword: process.env.ADMIN_PASSWORD?.trim() || null,
  maxInstallerSizeBytes: mbToBytes(maxInstallerSizeMb),
  maxConfigSizeBytes: mbToBytes(maxConfigSizeMb),
  maxMcpPackageSizeBytes: mbToBytes(maxMcpPackageSizeMb),
  storageDir: resolve(process.env.STORAGE_DIR || resolve(process.cwd(), "storage")),
  marketplaceEnabled,
  agentMarketPortalUrl,
};
```

- [ ] **Step 4: Add the portal handoff CTA to the current static page**

```tsx
// web/src/views/agent-market.tsx
import { getEnv } from "../lib/env";

export function renderAgentMarketPage(): string {
  const { agentMarketPortalUrl } = getEnv();

  return renderMarketingShell({
    title: "Agent 协作",
    description: "面向企业的 Agent 协作市场介绍与合作沟通入口。",
    currentPath: "/agent-market",
    children: (
      <div class="marketing-hero market-page">
        <section class="marketing-section marketing-section-hero market-section">
          <div class="marketing-section-inner market-hero-grid">
            <div class="market-hero-copy">
              <p class="marketing-kicker">Agent 协作市场</p>
              <h1 class="marketing-h1">让企业任务更适合由 Agent 协作完成</h1>
              <p class="marketing-lead">
                先了解市场协作方式，再进入市场门户查看需求方向、参与角色与合作入口。
              </p>
              <div class="marketing-hero-actions">
                {agentMarketPortalUrl ? (
                  <a class="marketing-primary-button" href={agentMarketPortalUrl}>
                    进入市场门户
                  </a>
                ) : null}
                <a class="marketing-secondary-button" href="/contact">
                  预约合作沟通
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    ),
  });
}
```

- [ ] **Step 5: Run the targeted tests and then the full web marketing tests**

Run:

```bash
cd web
bun test test/env.test.ts test/marketing-pages.test.ts
```

Expected:

```text
pass
```

Run:

```bash
cd /Users/ke/code/clawos
bun test web/test/env.test.ts web/test/marketing-pages.test.ts
```

Expected:

```text
pass
```

- [ ] **Step 6: Commit the web handoff**

```bash
git add web/src/lib/env.ts web/src/views/agent-market.tsx web/test/env.test.ts web/test/marketing-pages.test.ts
git commit -m "feat(web): link static market page to portal"
```

### Task 7: Final verification and operator notes

**Files:**
- Modify: `agent-market/package.json`
- Modify: `web/ecosystem.config.cjs` (only if the deployment URL should be set in repo-managed env)
- Optional: `agent-market/README.md`

- [ ] **Step 1: Add an operator-facing README for the new portal**

```md
<!-- agent-market/README.md -->
# Agent Market Portal

## Scripts

- `bun install`
- `bun run dev`
- `bun run build`
- `bun test`

## Deployment notes

- Build output: `agent-market/dist`
- The `web` static `/agent-market` page can link here through `AGENT_MARKET_PORTAL_URL`
```

- [ ] **Step 2: Run full verification for the new portal and the touched `web` tests**

Run:

```bash
cd agent-market && bun test && bun run build
cd /Users/ke/code/clawos && bun test web/test/env.test.ts web/test/marketing-pages.test.ts
```

Expected:

```text
portal tests pass
portal build succeeds
web env and marketing tests pass
```

- [ ] **Step 3: If deployment is repo-managed, set the portal URL in `web` PM2 env**

```js
// web/ecosystem.config.cjs
env: {
  NODE_ENV: "production",
  PORT: "26222",
  UPLOAD_TOKEN: "clawos",
  MARKETPLACE_ENABLED: "1",
  AGENT_MARKET_PORTAL_URL: "https://market.clawos.cc",
},
```

- [ ] **Step 4: Commit the deployment notes**

```bash
git add agent-market/README.md web/ecosystem.config.cjs
git commit -m "docs: add agent market portal deployment notes"
```

---

## Self-Review

### Spec coverage

- Standalone `agent-market/` project: covered by Tasks 1-5
- Demand-side-first portal IA: covered by Tasks 2-5
- Fake tasks, counts, and anonymous cases: covered by Tasks 2 and 4
- White, restrained visual system: covered by Task 5
- Keep current `web` static page: preserved in Task 6
- Add handoff from static page into portal: covered by Task 6
- Configurable portal URL: covered by Task 6

### Placeholder scan

- No `TBD`, `TODO`, or deferred implementation placeholders remain
- All code-changing steps include concrete code
- All verification steps include exact commands and expected outcomes

### Type consistency

- `MarketStat`, `MarketTask`, `RoleEntry`, `CapabilityCard`, and `CaseCard` are introduced before use
- `agentMarketPortalUrl` is introduced in the `web` env contract before tests expect it
- Component names used in `app.tsx` match the files created in Tasks 3 and 4
