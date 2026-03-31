import type { CapabilityCard, CaseCard, NavItem } from "../lib/portal-types";

interface CapabilityProofSectionProps {
  sectionId: string;
  capabilityCards: CapabilityCard[];
}

interface CaseOutcomesSectionProps {
  caseCards: CaseCard[];
}

interface ProcessRulesSectionProps {
  flowSteps: readonly string[];
  rulePoints: readonly string[];
  sectionId: string;
}

interface FinalCtaSectionProps {
  finalCtaLinks: NavItem[];
}

export function CapabilityProofSection({
  capabilityCards,
  sectionId,
}: CapabilityProofSectionProps) {
  return (
    <section className="portal-section" id={sectionId} aria-label="交付能力">
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
  );
}

export function CaseOutcomesSection({ caseCards }: CaseOutcomesSectionProps) {
  return (
    <section className="portal-section" aria-label="案例结果">
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
  );
}

export function ProcessRulesSection({
  flowSteps,
  rulePoints,
  sectionId,
}: ProcessRulesSectionProps) {
  return (
    <section
      className="portal-section portal-rule-section"
      id={sectionId}
      aria-label="流程与规则"
    >
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
  );
}

export function FinalCtaSection({ finalCtaLinks }: FinalCtaSectionProps) {
  return (
    <section className="portal-section portal-final-cta">
      <div className="portal-cta-grid">
        {finalCtaLinks.map((item) => (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}
