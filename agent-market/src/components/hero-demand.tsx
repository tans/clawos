import type { MarketStat, MarketTask, NavItem, RoleEntry } from "../lib/portal-types";

interface HeroDemandProps {
  ctaLinks: NavItem[];
  heroTasks: MarketTask[];
  marketStats: MarketStat[];
  roleEntries: RoleEntry[];
}

export function HeroDemand({ ctaLinks, heroTasks, marketStats, roleEntries }: HeroDemandProps) {
  return (
    <section className="portal-hero">
      <div className="portal-hero-copy">
        <p className="portal-kicker">Agent 协作市场</p>
        <h1>把企业需求转成可协作、可交付、可复用的 Agent 任务</h1>
        <p className="portal-lead">
          优先面向企业业务任务，把需求、交付能力与生态支持组织成可持续协作关系。
        </p>
        <div className="portal-action-row">
          {ctaLinks.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="portal-stat-row">
          {marketStats.map((item) => (
            <article
              key={item.label}
              className={item.tone === "accent" ? "is-accent" : undefined}
            >
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </div>
      <aside className="hero-task-panel">
        {heroTasks.map((task) => (
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
