import type {
  CapabilityCard,
  CaseCard,
  EntryCta,
  MarketStat,
  MarketTask,
  NavItem,
  RoleEntry,
} from "../lib/portal-types";

export const portalSectionIds = {
  tasks: "tasks",
  roles: "roles",
  proof: "proof",
  rules: "rules",
} as const;

export const portalNavItems: NavItem[] = [
  { label: "热门需求", href: `#${portalSectionIds.tasks}` },
  { label: "角色入口", href: `#${portalSectionIds.roles}` },
  { label: "交付能力", href: `#${portalSectionIds.proof}` },
  { label: "流程与规则", href: `#${portalSectionIds.rules}` },
];

export const entryCtas: EntryCta[] = [
  { id: "enterprise-entry", label: "提交企业需求", href: "#enterprise-entry" },
  { id: "provider-entry", label: "申请成为服务方", href: "#provider-entry" },
  { id: "partner-entry", label: "申请生态合作", href: "#partner-entry" },
];

const [enterpriseEntry, providerEntry, partnerEntry] = entryCtas;

export const heroCtaLinks: NavItem[] = [enterpriseEntry, providerEntry].map((item) => ({
  label: item.label,
  href: item.href,
}));

export const marketStats: MarketStat[] = [
  { label: "活跃需求方向", value: "24" },
  { label: "标准化任务类型", value: "11" },
  { label: "本周新增需求", value: "08", tone: "accent" },
];

export const demandFilters = ["销售", "客服", "运营", "知识库", "私有部署"] as const;

export const featuredTasks: MarketTask[] = [
  {
    id: "sales-knowledge-base",
    title: "销售知识库搭建与问答助手",
    scenario: "销售支持",
    scope: "知识接入 + Agent 编排",
    mode: "按阶段协作",
    phase: "需求评估中",
    period: "2-3 周",
  },
  {
    id: "service-sop-routing",
    title: "客服 SOP 分流与质检工作流",
    scenario: "客户服务",
    scope: "流程自动化",
    mode: "持续协作",
    phase: "供给匹配中",
    period: "3-4 周",
  },
  {
    id: "private-deploy-support",
    title: "虾壳主机私有部署支持",
    scenario: "部署上线",
    scope: "OpenClaw 预装交付",
    mode: "联合交付",
    phase: "准备启动",
    period: "1-2 周",
  },
];

const featuredTaskLookup = new Map(featuredTasks.map((task) => [task.id, task] as const));
const heroTaskIds = ["sales-knowledge-base", "service-sop-routing"] as const;

export const heroTasks: MarketTask[] = heroTaskIds.map((id) => {
  const task = featuredTaskLookup.get(id);
  if (!task) {
    throw new Error(`Missing featured task for hero id: ${id}`);
  }
  return task;
});

export const roleEntries: RoleEntry[] = [
  {
    title: "企业方",
    description: "提交业务需求，判断哪些任务适合进入可持续协作。",
    actionLabel: enterpriseEntry.label,
    actionHref: enterpriseEntry.href,
  },
  {
    title: "服务方",
    description: "展示交付能力、标准化经验与持续服务方式。",
    actionLabel: providerEntry.label,
    actionHref: providerEntry.href,
  },
  {
    title: "生态伙伴",
    description: "参与部署、实施、硬件与联合交付支持。",
    actionLabel: partnerEntry.label,
    actionHref: partnerEntry.href,
  },
];

export const capabilityCards: CapabilityCard[] = [
  { title: "工作流设计与 Agent 编排", description: "把复杂业务动作拆成可协作的执行链路。" },
  { title: "企业知识结构化", description: "把知识库、SOP 与问答能力组织成可维护资产。" },
  {
    title: "私有部署与运行支持",
    description: "结合 OpenClaw 与虾壳主机形成更稳定的本地优先交付。",
  },
];

export const caseCards: CaseCard[] = [
  {
    title: "销售知识库升级",
    scenario: "销售支持",
    outcome: "常见问答整理时间缩短，交付材料复用率提升。",
  },
  {
    title: "客服流程自动化",
    scenario: "客户服务",
    outcome: "重复分流动作下降，人工介入点更清晰。",
  },
  {
    title: "内部运营内容流水线",
    scenario: "运营执行",
    outcome: "固定模板任务进入持续协作方式。",
  },
];

export const flowSteps = [
  "识别任务方向并明确范围",
  "结构化需求与交付边界",
  "匹配执行能力与协作方式",
  "进入交付、验收与复盘",
] as const;

export const rulePoints = ["结构化范围", "可验证交付", "可复用结果", "合作边界清晰"] as const;

export const finalCtaLinks: NavItem[] = entryCtas.map((item) => ({
  label: item.label,
  href: item.href,
}));
