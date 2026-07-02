import { Lock, Shield, Sparkles, Workflow } from "lucide-react";
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
    <Section
      eyebrow="Principles"
      title="Trustworthy automation starts with restraint."
      align="center"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-[1.5rem] border border-border bg-background-elevated p-8">
            <div className="mb-5 inline-flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <feature.icon className="size-5" strokeWidth={1.6} />
            </div>
            <h3 className="text-xl font-medium tracking-[-0.02em]">{feature.title}</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground-muted">{feature.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
