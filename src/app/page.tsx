import { DisclosureBanner } from "@/components/disclosure-banner";
import { HeroSection } from "@/components/hero-section";
import { FeatureCards } from "@/components/feature-cards";
import { ToolsSection } from "@/components/tools-section";
import { ZeroStackSection } from "@/components/zero-stack-section";
import { WipeBanner } from "@/components/wipe-banner";

export default function HomePage() {
  return (
    <>
      <DisclosureBanner />
      <HeroSection />
      <FeatureCards />
      <ToolsSection />
      <ZeroStackSection />
      <WipeBanner />
    </>
  );
}
