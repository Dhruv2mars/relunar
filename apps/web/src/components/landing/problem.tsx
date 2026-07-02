import { Reveal } from "@/components/reveal";
import { Section } from "@/components/section";
import { cn } from "@/lib/cn";

const withoutItems = [
  "Issues missing reproduction steps and environment context.",
  "Ad-hoc sandbox scripts that are hard to repeat or audit.",
  "Agents improvising infrastructure instead of investigating bugs.",
] as const;

const withItems = [
  "Deterministic clone, setup, and baseline in a fresh sandbox.",
  "Structured local reports your agent can read and extend.",
  "Optional GitHub comments only when you explicitly ask.",
] as const;

function ListItem({ children, inverse = false }: { children: string; inverse?: boolean }) {
  return (
    <li className="flex gap-3 leading-relaxed">
      <span
        className={cn(
          "mt-2 size-1.5 shrink-0 rounded-full",
          inverse ? "bg-inverse-muted" : "bg-foreground-subtle",
        )}
        aria-hidden
      />
      <span className={inverse ? "text-inverse-muted" : "text-foreground-muted"}>{children}</span>
    </li>
  );
}

export function ProblemSection() {
  return (
    <Section
      eyebrow="The problem"
      title="Great issues still arrive without a path to reproduce."
      description="Maintainers spend cycles asking for logs, versions, and steps. Coding agents can help — but they need a clean, trustworthy harness to work inside."
    >
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <Reveal>
          <article className="card-interactive h-full rounded-[1.5rem] border border-border bg-background-elevated p-8 md:p-10">
            <p className="eyebrow !tracking-[0.18em]">Without structure</p>
            <ul className="mt-7 space-y-4">
              {withoutItems.map((item) => (
                <ListItem key={item}>{item}</ListItem>
              ))}
            </ul>
          </article>
        </Reveal>
        <Reveal delay={0.08}>
          <article className="card-interactive inverse-panel h-full rounded-[1.5rem] border border-transparent p-8 md:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-inverse-subtle">With Relunar</p>
            <ul className="mt-7 space-y-4">
              {withItems.map((item) => (
                <ListItem key={item} inverse>
                  {item}
                </ListItem>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>
    </Section>
  );
}
