import type { MarketTask } from "../lib/portal-types";

interface TaskStreamProps {
  demandFilters: readonly string[];
  featuredTasks: MarketTask[];
  sectionId: string;
}

export function TaskStream({ demandFilters, featuredTasks, sectionId }: TaskStreamProps) {
  return (
    <section className="portal-section" id={sectionId}>
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
