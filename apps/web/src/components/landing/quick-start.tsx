import { CopyButton } from "@/components/copy-button";
import { Section } from "@/components/section";

const configExample = `version: 1

setup:
  - bun install

baseline:
  - bun run typecheck
  - bun test

report:
  maxLogLines: 200`;

export function QuickStartSection() {
  return (
    <Section
      eyebrow="Quick start"
      title="Three commands to your first report."
      description="Link a repository, configure .relunar.yml, and let your agent call relunar repro. Reports land in .relunar/runs."
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel overflow-hidden rounded-[1.5rem] border border-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
              Workflow
            </p>
          </div>
          <div className="space-y-1 bg-code-bg px-5 py-6 font-mono text-[0.92rem] leading-7 text-foreground md:px-7">
            <p>
              <span className="text-foreground-subtle">$</span> relunar repo link owner/repo
            </p>
            <p>
              <span className="text-foreground-subtle">$</span> relunar init
            </p>
            <p>
              <span className="text-foreground-subtle">$</span> relunar repro 123
            </p>
            <p>
              <span className="text-foreground-subtle">$</span> relunar runs show &lt;run-id&gt; --json
            </p>
          </div>
        </div>

        <div className="glass-panel overflow-hidden rounded-[1.5rem] border border-border">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
              .relunar.yml
            </p>
            <CopyButton value={configExample} label="Copy" />
          </div>
          <pre className="overflow-x-auto bg-code-bg px-5 py-6 font-mono text-[0.86rem] leading-7 text-foreground-muted md:px-7">
            {configExample}
          </pre>
        </div>
      </div>
    </Section>
  );
}
