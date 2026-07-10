const rules = [
  {
    clause: "no. 1",
    title: "Reports stay local",
    description:
      "Every run writes to .relunar/runs on your machine. Nothing is uploaded, synced, or phoned home. There is no hosted service to trust.",
  },
  {
    clause: "no. 2",
    title: "--comment, or silence",
    description:
      "Relunar never posts to a GitHub thread on its own. A public comment requires the explicit flag — every single time.",
  },
  {
    clause: "no. 3",
    title: "Your credentials, your accounts",
    description:
      "GitHub tokens and Daytona keys resolve locally: environment, gh auth, OS keychain. Relunar holds custody of nothing.",
  },
  {
    clause: "no. 4",
    title: "Batch requires --limit",
    description:
      "relunar repro --all-open refuses to run unbounded. You state a ceiling, or nothing happens. No runaway automation.",
  },
  {
    clause: "no. 5",
    title: "Harness, not agent",
    description:
      "Relunar decides nothing. It executes the same deterministic workflow every run, and leaves judgment to the agent you already trust.",
  },
] as const;

export function RulesSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
        <div className="max-w-2xl">
          <h2 className="display display-section">
            Boring by design.
            <br />
            <span className="text-accent">Trusted by default.</span>
          </h2>
          <p className="text-pretty mt-7 text-lg leading-[1.65] text-foreground-muted">
            A harness that touches your repositories and your issue threads has to earn the
            right. These rules are not settings — they are the product.
          </p>
        </div>

        <dl className="mt-16">
          {rules.map((rule) => (
            <div
              key={rule.clause}
              className="grid gap-3 border-t border-border py-7 transition-colors duration-200 hover:bg-surface md:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-8 md:py-8"
            >
              <p className="mono-label pt-1 text-foreground-subtle">{rule.clause}</p>
              <dt className="display display-sub text-foreground">{rule.title}</dt>
              <dd className="text-pretty max-w-xl text-[0.9375rem] leading-[1.7] text-foreground-muted">
                {rule.description}
              </dd>
            </div>
          ))}
          <div className="border-t border-border" aria-hidden />
        </dl>
      </div>
    </section>
  );
}
