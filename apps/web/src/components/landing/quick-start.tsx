import { CodePanel } from "@/components/code-panel";
import { CopyButton } from "@/components/copy-button";
import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";

const configExample = `version: 1

setup:
  - bun install

baseline:
  - bun run typecheck
  - bun test

report:
  maxLogLines: 200`;

const workflowLines = [
  "relunar repo link owner/repo",
  "relunar init",
  "relunar repro 123",
  "relunar runs show <run-id> --json",
] as const;

export function QuickStartSection() {
  return (
    <Section
      eyebrow="Quick start"
      title="Three commands to your first report."
      description="Link a repository, configure .relunar.yml, and let your agent call relunar repro. Reports land in .relunar/runs."
    >
      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
        <Reveal>
          <CodePanel title="Workflow">
            <div className="space-y-1 px-5 py-6 font-mono text-[0.88rem] leading-8 md:px-7">
              {workflowLines.map((line) => (
                <p key={line}>
                  <span className="select-none text-foreground-subtle">$</span>{" "}
                  <span className="text-foreground-muted">{line}</span>
                </p>
              ))}
            </div>
          </CodePanel>
        </Reveal>

        <Reveal delay={0.08}>
          <CodePanel title=".relunar.yml" actions={<CopyButton value={configExample} label="Copy" />}>
            <pre className="overflow-x-auto px-5 py-6 font-mono text-[0.84rem] leading-8 text-foreground-muted md:px-7">
              {configExample}
            </pre>
          </CodePanel>
        </Reveal>
      </div>
    </Section>
  );
}
