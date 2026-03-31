export interface MarketStat {
  label: string;
  value: string;
  tone?: "default" | "accent";
}

export interface NavItem {
  label: string;
  href: string;
}

export interface MarketTask {
  id: string;
  title: string;
  scenario: string;
  scope: string;
  mode: string;
  phase: string;
  period: string;
}

export interface EntryCta extends NavItem {
  id: "enterprise-entry" | "provider-entry" | "partner-entry";
}

export interface RoleEntry {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

export interface CapabilityCard {
  title: string;
  description: string;
}

export interface CaseCard {
  title: string;
  scenario: string;
  outcome: string;
}
