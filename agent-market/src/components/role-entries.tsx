import type { RoleEntry } from "../lib/portal-types";

interface RoleEntriesProps {
  roleEntries: RoleEntry[];
  sectionId: string;
}

export function RoleEntries({ roleEntries, sectionId }: RoleEntriesProps) {
  return (
    <section className="portal-section" id={sectionId}>
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
