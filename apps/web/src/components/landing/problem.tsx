import { Section } from "@/components/section";

export function ProblemSection() {
  return (
    <Section
      eyebrow="The problem"
      title="Great issues still arrive without a path to reproduce."
      description="Maintainers spend cycles asking for logs, versions, and steps. Coding agents can help — but they need a clean, trustworthy harness to work inside."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <article className="glass-panel rounded-[1.5rem] border border-border p-8 md:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground-subtle">
            Without structure
          </p>
          <ul className="mt-6 space-y-4 text-foreground-muted">
            <li className="leading-relaxed">Issues missing reproduction steps and environment context.</li>
            <li className="leading-relaxed">Ad-hoc sandbox scripts that are hard to repeat or audit.</li>
            <li className="leading-relaxed">Agents improvising infrastructure instead of investigating bugs.</li>
          </ul>
        </article>
        <article className="rounded-[1.5rem] border border-border bg-foreground p-8 text-background md:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-background/60">
            With Relunar
          </p>
          <ul className="mt-6 space-y-4 text-background/82">
            <li className="leading-relaxed">Deterministic clone, setup, and baseline in a fresh sandbox.</li>
            <li className="leading-relaxed">Structured local reports your agent can read and extend.</li>
            <li className="leading-relaxed">Optional GitHub comments only when you explicitly ask.</li>
          </ul>
        </article>
      </div>
    </Section>
  );
}
