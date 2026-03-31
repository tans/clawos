import { HeroDemand } from "./components/hero-demand";
import {
  CapabilityProofSection,
  CaseOutcomesSection,
  FinalCtaSection,
  ProcessRulesSection,
} from "./components/market-proof";
import { PortalHeader } from "./components/portal-header";
import { RoleEntries } from "./components/role-entries";
import { TaskStream } from "./components/task-stream";
import {
  capabilityCards,
  caseCards,
  demandFilters,
  finalCtaLinks,
  featuredTasks,
  flowSteps,
  heroTasks,
  heroCtaLinks,
  marketStats,
  portalNavItems,
  portalSectionIds,
  roleEntries,
  rulePoints,
} from "./content/portal-data";

export function App() {
  return (
    <div className="portal-shell" id="top">
      <PortalHeader navItems={portalNavItems} />
      <HeroDemand
        ctaLinks={heroCtaLinks}
        heroTasks={heroTasks}
        marketStats={marketStats}
        roleEntries={roleEntries}
      />
      <TaskStream
        demandFilters={demandFilters}
        featuredTasks={featuredTasks}
        sectionId={portalSectionIds.tasks}
      />
      <RoleEntries roleEntries={roleEntries} sectionId={portalSectionIds.roles} />
      <CapabilityProofSection
        capabilityCards={capabilityCards}
        sectionId={portalSectionIds.proof}
      />
      <CaseOutcomesSection caseCards={caseCards} />
      <ProcessRulesSection
        flowSteps={flowSteps}
        rulePoints={rulePoints}
        sectionId={portalSectionIds.rules}
      />
      <FinalCtaSection
        finalCtaLinks={finalCtaLinks}
      />
    </div>
  );
}
