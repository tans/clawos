/** @jsxImportSource hono/jsx */

import {
  ArchitectureSection,
  CapabilityMatrixSection,
  CoreValueSection,
  FaqSection,
  FinalCtaSection,
  GovernanceSection,
  HardwareSection,
  HomeHero,
  PocPathSection,
  ScenarioSection,
} from "./home-sections";
import { renderMarketingShell } from "./marketing-shell";

function HomePage() {
  return (
    <>
      <HomeHero />
      <CoreValueSection />
      <CapabilityMatrixSection />
      <ArchitectureSection />
      <ScenarioSection />
      <HardwareSection />
      <GovernanceSection />
      <PocPathSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}

export function renderHomePage() {
  return renderMarketingShell({
    title: "企业智能员工操作系统",
    description: "ClawOS 是企业智能员工操作系统，通过技能生态与虾壳主机把 AI 接入真实业务流程。",
    currentPath: "/",
    children: <HomePage />,
  });
}
