import { MoonPhase, type MoonPhaseName } from "@/components/moon-phase";

const phases: Array<{
  phase: MoonPhaseName;
  title: string;
  description: string;
}> = [
  {
    phase: "new",
    title: "Your agent picks the issue",
    description:
      "Ask Codex, Cursor, or Claude Code to investigate open issues. The agent decides what matters and calls relunar — you never leave the editor.",
  },
  {
    phase: "crescent",
    title: "Relunar spins the sandbox",
    description:
      "The CLI reads the issue, creates a fresh Daytona sandbox with your own credentials, and clones the linked repository.",
  },
  {
    phase: "gibbous",
    title: "The baseline runs",
    description:
      "Setup and baseline commands from .relunar.yml execute deterministically. A failing test is a reproduction — captured, not described.",
  },
  {
    phase: "full",
    title: "Evidence lands locally",
    description:
      "report.md, report.json, and logs.txt are written to .relunar/runs. Your agent reads them and decides what happens next.",
  },
];

export function PhasesSection() {
  return (
    <section id="how-it-works" className="border-t border-border bg-background-deep">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
        <div className="max-w-2xl">
          <h2 className="display display-section">
            Agent drives.
            <br />
            <span className="text-accent">Relunar executes.</span>
          </h2>
          <p className="text-pretty mt-7 text-lg leading-[1.65] text-foreground-muted">
            One run moves through four phases — the same phases, in the same order, every
            time. That is the whole point.
          </p>
        </div>

        <ol className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {phases.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-4">
                <MoonPhase
                  phase={step.phase}
                  id={`phase-${index}`}
                  className="size-12 text-accent"
                />
                {index < phases.length - 1 ? (
                  <span className="hairline-x hidden flex-1 lg:block" aria-hidden />
                ) : null}
              </div>
              <h3 className="mt-6 text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                {step.title}
              </h3>
              <p className="text-pretty mt-2.5 text-[0.9375rem] leading-[1.65] text-foreground-muted">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
