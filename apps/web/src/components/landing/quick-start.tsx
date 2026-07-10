import { CodePanel } from "@/components/code-panel";
import { CopyButton } from "@/components/copy-button";
import { siteConfig } from "@/lib/site";

const configExample = `version: 1

setup:
  - bun install

baseline:
  - bun run typecheck
  - bun test

report:
  maxLogLines: 200`;

const steps = [
  {
    label: "install",
    lines: [siteConfig.installCommand, "relunar setup"],
    note: "First launch walks through GitHub and Daytona auth. Credentials go to your keychain, not our servers — we don't have servers.",
  },
  {
    label: "link",
    lines: ["relunar repo link owner/repo", "relunar init"],
    note: "init drops a .relunar.yml in the target repo. Declare setup and baseline once; every run obeys it.",
  },
  {
    label: "reproduce",
    lines: ["relunar repro 123", "relunar repro --all-open --limit 5"],
    note: "Or skip the typing entirely — tell your agent to run it. Codex, Cursor, and Claude Code learn the workflow from one skill install.",
  },
] as const;

export function QuickStartSection() {
  return (
    <section className="border-t border-border bg-background-deep">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
        <div className="max-w-2xl">
          <h2 className="display display-section">
            First report
            <br />
            <span className="text-accent">before the coffee cools.</span>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <ol className="space-y-10">
            {steps.map((step, index) => (
              <li key={step.label} className="grid gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                <p className="mono-label pt-1 text-accent-bright">
                  {String(index + 1).padStart(2, "0")} · {step.label}
                </p>
                <div>
                  <div className="mono-data overflow-x-auto rounded-lg border border-border bg-code-bg px-4 py-3.5 text-foreground">
                    {step.lines.map((line) => (
                      <p key={line} className="whitespace-nowrap">
                        <span className="select-none text-accent">$ </span>
                        <span className="text-foreground-muted">{line}</span>
                      </p>
                    ))}
                  </div>
                  <p className="text-pretty mt-3 text-sm leading-[1.65] text-foreground-muted">
                    {step.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="space-y-5">
            <CodePanel
              title=".relunar.yml"
              actions={<CopyButton value={configExample} label="Copy" />}
            >
              <pre className="mono-data overflow-x-auto px-5 py-4 text-foreground-muted">
                {configExample}
              </pre>
            </CodePanel>

            <div className="rounded-lg border border-border px-5 py-5">
              <p className="mono-label text-foreground-subtle">Teach your agent</p>
              <div className="mono-data mt-3 text-foreground-muted">
                <p>
                  <span className="select-none text-accent">$ </span>relunar skills install codex
                </p>
              </div>
              <p className="text-pretty mt-3 text-sm leading-[1.65] text-foreground-muted">
                Ships workflow skills for Codex, Cursor, and Claude Code so your agent knows
                when to reproduce, how to read reports, and when to stop.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
