import { Lock, Shield, Sparkles, Workflow } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";

const features = [
  {
    icon: Workflow,
    title: "Deterministic by design",
    description: "Same commands, same evidence shape, every run. Built for agents that need reliable machine-readable output.",
  },
  {
    icon: Lock,
    title: "Local-first credentials",
    description: "Your GitHub token and Daytona API key stay on your machine — env, gh, or OS keychain. Nothing hosted by Relunar.",
  },
  {
    icon: Shield,
    title: "Explicit public actions",
    description: "Batch limits, local reports by default, and comments only with --comment. Safety is part of the product surface.",
  },
  {
    icon: Sparkles,
    title: "Made for maintainers",
    description: "Built for OSS repo owners who already work with coding agents — not for drive-by issue reporters.",
  },
] as const;

export function FeaturesSection() {
  return (
    <Section eyebrow="Principles" title="Trustworthy automation starts with restraint." align="center">
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        {features.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.05}>
            <article className="card-interactive h-full rounded-[1.5rem] border border-border bg-background-elevated p-8 md:p-9">
              <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                <feature.icon className="size-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-medium tracking-[-0.025em] text-foreground">{feature.title}</h3>
              <p className="mt-3 max-w-md text-sm leading-[1.65] text-foreground-muted">{feature.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
