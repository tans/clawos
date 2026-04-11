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
import { getBrandConfig } from "../lib/branding";
import { renderMarketingShell } from "./marketing-shell";

function HomePage() {
  const { brandName, heroBannerUrl } = getBrandConfig();
  return (
    <>
      <HomeHero brandName={brandName} heroBannerUrl={heroBannerUrl} />
      <CoreValueSection />
      <CapabilityMatrixSection />
      <ArchitectureSection brandName={brandName} />
      <ScenarioSection />
      <HardwareSection />
      <GovernanceSection />
      <PocPathSection />
      <OemSection />
      <FaqSection brandName={brandName} />
      <FinalCtaSection />
    </>
  );
}

export function renderHomePage() {
  const { brandName } = getBrandConfig();
  return renderMarketingShell({
    title: "企业 AI 部署解决方案",
    description: `${brandName} 帮助企业完成 AI 能力的部署、接入、治理与长期运行，虾壳主机提供预装 OpenClaw 的交付形态。`,
    currentPath: "/",
    children: <HomePage />,
  });
}
