import { Hono } from "hono";
import type { AppEnv } from "../types";

type TeamModule = {
  id: string;
  title: string;
  summary: string;
  status: "ready" | "developing";
  metricLabel: string;
  metricValue: string;
  highlights: string[];
  actions: Array<{ label: string; href: string }>;
};

const MODULES: TeamModule[] = [
  {
    id: "workspace",
    title: "Team 空间",
    summary: "管理 Team 基础信息、环境与运行模式（标准 / 无人公司）。",
    status: "ready",
    metricLabel: "活跃 Team",
    metricValue: "4",
    highlights: ["空间模式切换", "成员邀请入口", "基础信息维护"],
    actions: [
      { label: "进入 Team 工作台", href: "/app" },
      { label: "创建公司", href: "/app/company/new" },
    ],
  },
  {
    id: "hosts",
    title: "设备与网关",
    summary: "统一查看主机在线状态、Gateway 状态与最近一次巡检结果。",
    status: "ready",
    metricLabel: "在线设备",
    metricValue: "18 / 23",
    highlights: ["在线 / 降级 / 离线", "WSL 运行状态", "Gateway 版本"],
    actions: [
      { label: "进入主机控制台", href: "/console" },
      { label: "查看 Agent 洞察", href: "/console/insights" },
    ],
  },
  {
    id: "commands",
    title: "命令中心",
    summary: "支持重启、配置修改、状态查询等命令下发与结果回传。",
    status: "ready",
    metricLabel: "今日命令",
    metricValue: "126",
    highlights: ["队列执行", "幂等去重", "失败重试"],
    actions: [
      { label: "打开控制台", href: "/console" },
      { label: "查看示例主机", href: "/console/hosts/demo-host-01" },
    ],
  },
  {
    id: "audit",
    title: "审计与告警",
    summary: "追踪关键动作审计记录，并按严重级别过滤异常事件。",
    status: "developing",
    metricLabel: "高危告警",
    metricValue: "3",
    highlights: ["配置修改留痕", "重启动作追溯", "风险等级过滤"],
    actions: [
      { label: "审计 API", href: "/api/audit/logs?limit=20" },
      { label: "回到洞察页", href: "/console/insights" },
    ],
  },
];

export function createTeamApiController(): Hono<AppEnv> {
  const controller = new Hono<AppEnv>();

  controller.get("/api/team/modules", (c) => {
    return c.json({ ok: true, modules: MODULES, ts: new Date().toISOString() });
  });

  return controller;
}
