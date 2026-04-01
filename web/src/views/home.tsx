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
  OemSection,
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
      <OemSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}

export function renderHomePage() {
  return renderMarketingShell({
    title: "企业 AI 部署解决方案",
    description: "ClawOS 帮助企业完成 AI 能力的部署、接入、治理与长期运行，虾壳主机提供预装 OpenClaw 的交付形态。",
    currentPath: "/",
    children: <HomePage />,
  });
}
