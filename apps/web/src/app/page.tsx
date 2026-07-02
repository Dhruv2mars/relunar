import type { Metadata } from "next";
import { CtaSection } from "@/components/landing/cta";
import { FaqSection } from "@/components/landing/faq";
import { FeaturesSection } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { ProblemSection } from "@/components/landing/problem";
import { QuickStartSection } from "@/components/landing/quick-start";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
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
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <QuickStartSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
