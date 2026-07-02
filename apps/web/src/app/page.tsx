import { CtaSection } from "@/components/landing/cta";
import { FaqSection } from "@/components/landing/faq";
import { FeaturesSection } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { ProblemSection } from "@/components/landing/problem";
import { QuickStartSection } from "@/components/landing/quick-start";
import { SectionDivider } from "@/components/section-divider";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: {
    default: "Relunar — Reproduce GitHub issues with evidence",
    template: "%s · Relunar",
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: "Relunar — Reproduce GitHub issues with evidence",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: "Relunar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relunar — Reproduce GitHub issues with evidence",
    description: siteConfig.description,
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionDivider />
      <ProblemSection />
      <SectionDivider />
      <HowItWorksSection />
      <SectionDivider />
      <FeaturesSection />
      <SectionDivider />
      <QuickStartSection />
      <SectionDivider />
      <FaqSection />
      <CtaSection />
    </>
  );
}
