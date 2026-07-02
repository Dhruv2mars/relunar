import { Button } from "@/components/button";
import { Reveal } from "@/components/reveal";
import { siteConfig } from "@/lib/site";

export function CtaSection() {
  return (
    <section className="px-6 pb-28 md:pb-36">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="inverse-panel relative overflow-hidden rounded-[2rem] border border-transparent px-8 py-16 md:px-14 md:py-20">
            <div
              className="pointer-events-none absolute inset-0 opacity-100"
              style={{
                background: "radial-gradient(circle at top right, var(--cta-glow), transparent 42%)",
              }}
            />
            <div className="relative max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-inverse-subtle">Ready when you are</p>
              <h2 className="display-serif mt-5 text-balance text-4xl leading-[1.02] tracking-[-0.035em] md:text-[3.25rem]">
                Give your agent a better way to reproduce issues.
              </h2>
              <p className="mt-5 text-base leading-[1.65] text-inverse-muted md:text-lg">
                Install Relunar locally, link your repository, and let your coding agent handle the rest — with
                evidence you can trust.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/docs/getting-started" variant="inverse">
                  Read the docs
                </Button>
                <Button href={siteConfig.npm} variant="inverseGhost" external>
                  Install from npm
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
