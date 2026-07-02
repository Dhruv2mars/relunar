import { Bot, Cloud, FileText, Terminal } from "lucide-react";
import { Section } from "@/components/section";

const steps = [
  {
    icon: Bot,
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
      "GitHub comments require --comment. No surprise bot posts. You stay in control of what maintainers see publicly.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Agent drives. Relunar executes."
      description="Relunar is not another autonomous bot. It is the elegant plumbing layer between your coding agent and reproducible issue evidence."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <article
            key={step.title}
            className="glass-panel group rounded-[1.35rem] border border-border p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-border bg-surface-strong text-accent">
                <step.icon className="size-5" strokeWidth={1.6} />
              </div>
              <span className="text-xs font-medium tabular-nums text-foreground-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-lg font-medium tracking-[-0.02em] text-foreground">{step.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{step.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
