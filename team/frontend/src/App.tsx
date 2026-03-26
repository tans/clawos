import { ArrowUpRight, LayoutGrid, Server, ShieldCheck, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "./components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { LinkButton } from "./components/ui/button";

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

const ICONS: Record<string, typeof LayoutGrid> = {
  workspace: LayoutGrid,
  hosts: Server,
  commands: TerminalSquare,
  audit: ShieldCheck,
};

export function App() {
  const [modules, setModules] = useState<TeamModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/team/modules");
        const data = (await response.json()) as { modules?: TeamModule[] };
        if (!alive) return;
        setModules(Array.isArray(data.modules) ? data.modules : []);
      } catch {
        if (!alive) return;
        setModules([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const totalReady = useMemo(() => modules.filter((item) => item.status === "ready").length, [modules]);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <h1>ClawOS Team · 前后端分离控制台</h1>
          <p>前端（React + shadcn 风格组件）与后端（Hono API）解耦，当前使用 mock 数据渲染模块能力。</p>
        </div>
        <div className="hero-kpis">
          <div>
            <span>模块数</span>
            <strong>{modules.length || "-"}</strong>
          </div>
          <div>
            <span>已就绪</span>
            <strong>{totalReady || "-"}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{loading ? "加载中" : "可用"}</strong>
          </div>
        </div>
      </section>

      <section className="module-grid">
        {modules.map((module) => {
          const Icon = ICONS[module.id] || LayoutGrid;
          return (
            <Card key={module.id}>
              <CardHeader>
                <div className="card-top">
                  <div className="card-title-wrap">
                    <Icon size={18} />
                    <CardTitle>{module.title}</CardTitle>
                  </div>
                  <Badge className={module.status === "ready" ? "badge-ready" : "badge-dev"}>
                    {module.status === "ready" ? "可用" : "开发中"}
                  </Badge>
                </div>
                <CardDescription>{module.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="metric-box">
                  <p>{module.metricLabel}</p>
                  <strong>{module.metricValue}</strong>
                </div>
                <ul className="highlights">
                  {module.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="action-row">
                  {module.actions.map((action) => (
                    <LinkButton key={action.href + action.label} href={action.href} variant="outline">
                      {action.label}
                      <ArrowUpRight size={14} />
                    </LinkButton>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && modules.length === 0 ? <p className="empty">暂无模块数据，请检查 /api/team/modules。</p> : null}
      </section>
    </main>
  );
}
