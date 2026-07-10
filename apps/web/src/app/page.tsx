import { CtaSection } from "@/components/landing/cta";
import { EvidenceSection } from "@/components/landing/evidence";
import { FaqSection } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { PhasesSection } from "@/components/landing/phases";
import { QuickStartSection } from "@/components/landing/quick-start";
import { RulesSection } from "@/components/landing/rules";
import { siteConfig } from "@/lib/site";

export const metadata = {
  title: {
    default: "Relunar — Reproduce issues. Keep the evidence.",
    template: "%s · Relunar",
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: "Relunar — Reproduce issues. Keep the evidence.",
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: "Relunar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Relunar — Reproduce issues. Keep the evidence.",
    description: siteConfig.description,
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <EvidenceSection />
      <PhasesSection />
      <RulesSection />
      <QuickStartSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
