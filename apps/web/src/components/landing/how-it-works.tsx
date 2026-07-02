import { Cloud, FileText, Search, Terminal } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";

const steps = [
  {
    icon: Search,
    title: "Your agent chooses the issue",
    description:
      "Ask Cursor, Codex, or Claude Code to investigate open issues. The agent decides priority and whether more context is needed.",
  },
  {
    icon: Terminal,
    title: "Relunar runs the harness",
    description:
      "The CLI fetches the issue, creates a Daytona sandbox, clones the repo, runs setup and baseline from .relunar.yml.",
  },
  {
    icon: FileText,
    title: "Evidence lands locally",
    description:
      "Each run writes report.md, report.json, and logs under .relunar/runs — ready for your agent to inspect and iterate.",
  },
  {
    icon: Cloud,
    title: "Comment when you mean it",
    description:
      "GitHub comments require --comment. No surprise public writes. You stay in control of what maintainers see publicly.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Agent drives. Relunar executes."
      description="Relunar is the local plumbing layer between your coding agent and reproducible issue evidence."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {steps.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.06}>
            <article className="card-interactive group relative h-full rounded-[1.35rem] border border-border bg-background-elevated p-6 md:p-7">
              <div className="mb-6 flex items-center justify-between">
                <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-surface-strong text-accent transition-colors group-hover:border-accent/20 group-hover:bg-accent-soft">
                  <step.icon className="size-5" strokeWidth={1.5} />
                </div>
                <span className="text-[0.7rem] font-medium tabular-nums tracking-[0.12em] text-foreground-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-[1.05rem] font-medium leading-snug tracking-[-0.02em] text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-[1.65] text-foreground-muted">{step.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
